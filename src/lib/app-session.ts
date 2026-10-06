import crypto from 'crypto';
import { prisma } from './db';
import { checkRateLimit } from './rate-limit';

/**
 * Short-lived session tokens for the hosted app at /app.
 *
 * The browser proves it holds a valid license by calling /api/app/session
 * with its key + device hash. If that passes, it gets a token good for
 * TOKEN_TTL_MS, which it attaches to every /api/engine/* call. The token is
 * only a convenience (so we don't re-run the full key/device validation on
 * every single decision) — every engine call ALSO re-reads the license row,
 * so revoking a key or an expired trial cuts off decisions immediately, not
 * when the token happens to run out.
 */

const TOKEN_TTL_MS = 20 * 60 * 1000; // 20 minutes; the client refreshes before this

// Daily cap on engine calls per license. A human playing hard uses a few
// hundred decisions a day; the cap exists so someone can't script the engine
// over every possible hand/dealer/count combination and rebuild the tables.
// Trials get a lower cap than paid licenses.
const DAILY_CAP_TRIAL = 1500;
const DAILY_CAP_PAID = 6000;

function secret(): string {
  // Separate key from the admin cookie where possible; falls back to the
  // admin secret (domain-separated below) so there's one less env var to set.
  const s = process.env.APP_SESSION_SECRET || process.env.ADMIN_SESSION_SECRET;
  if (!s) throw new Error('APP_SESSION_SECRET (or ADMIN_SESSION_SECRET) not set');
  return s;
}

function sign(payload: string): string {
  return crypto.createHmac('sha256', secret()).update('app-session:' + payload).digest('base64url');
}

export function createAppToken(licenseId: string, deviceHash: string): { token: string; expiresAt: number } {
  const expiresAt = Date.now() + TOKEN_TTL_MS;
  const payload = Buffer.from(JSON.stringify({ l: licenseId, d: deviceHash, e: expiresAt })).toString('base64url');
  return { token: `${payload}.${sign(payload)}`, expiresAt };
}

export function verifyAppToken(token: unknown): { licenseId: string; deviceHash: string } | null {
  if (typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [payload, sig] = parts;
  try {
    const expected = Buffer.from(sign(payload));
    const given = Buffer.from(sig);
    if (expected.length !== given.length || !crypto.timingSafeEqual(expected, given)) return null;
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (typeof data.l !== 'string' || typeof data.d !== 'string' || typeof data.e !== 'number') return null;
    if (Date.now() > data.e) return null;
    return { licenseId: data.l, deviceHash: data.d };
  } catch {
    return null;
  }
}

export type EngineAccess =
  | { ok: true; licenseId: string }
  | { ok: false; status: number; reason: string };

/**
 * Gate for every /api/engine/* call: valid token, license still good right
 * now (not revoked, not expired), and under the daily cap.
 */
export async function authorizeEngineCall(token: unknown): Promise<EngineAccess> {
  const session = verifyAppToken(token);
  if (!session) return { ok: false, status: 401, reason: 'SESSION_EXPIRED' };

  const license = await prisma.license.findUnique({ where: { id: session.licenseId } });
  if (!license) return { ok: false, status: 403, reason: 'NOT_FOUND' };
  if (license.status === 'REVOKED') return { ok: false, status: 403, reason: 'REVOKED' };
  if (license.expiresAt && license.expiresAt < new Date()) return { ok: false, status: 403, reason: 'EXPIRED' };

  const cap = license.isTrial ? DAILY_CAP_TRIAL : DAILY_CAP_PAID;
  const allowed = await checkRateLimit(`engine-${license.id}`, license.id, cap, 24 * 60);
  if (!allowed) return { ok: false, status: 429, reason: 'DAILY_LIMIT' };

  return { ok: true, licenseId: license.id };
}
