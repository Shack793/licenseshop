import crypto from 'crypto';

/**
 * Deliberately simple: one shared admin password (ADMIN_PASSWORD), one
 * HMAC-signed session cookie. There's no admin user table — if you need
 * more than one admin identity later, swap this for real accounts, but
 * for a single-operator storefront this avoids building a whole second
 * auth system on top of the no-accounts customer-facing one.
 */

const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours
export const ADMIN_COOKIE_NAME = 'admin_session';

function sessionSecret(): string {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret) throw new Error('ADMIN_SESSION_SECRET not set');
  return secret;
}

export function checkAdminPassword(password: string): boolean {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) return false;
  // Constant-time compare via hash digests so response timing doesn't leak
  // how many characters of the password were correct.
  const a = crypto.createHash('sha256').update(password).digest();
  const b = crypto.createHash('sha256').update(expected).digest();
  return crypto.timingSafeEqual(a, b);
}

export function createAdminSessionCookie(): string {
  const expires = Date.now() + SESSION_TTL_MS;
  const payload = `admin:${expires}`;
  const sig = crypto.createHmac('sha256', sessionSecret()).update(payload).digest('hex');
  return Buffer.from(`${payload}:${sig}`).toString('base64url');
}

export function verifyAdminSessionCookie(cookie: string | undefined): boolean {
  if (!cookie) return false;
  try {
    const decoded = Buffer.from(cookie, 'base64url').toString('utf8');
    const parts = decoded.split(':');
    if (parts.length !== 3) return false;
    const [prefix, expiresStr, sig] = parts;
    if (prefix !== 'admin') return false;

    const expires = Number(expiresStr);
    if (!Number.isFinite(expires) || Date.now() > expires) return false;

    const payload = `${prefix}:${expiresStr}`;
    const expectedSig = crypto.createHmac('sha256', sessionSecret()).update(payload).digest('hex');
    const sigBuf = Buffer.from(sig, 'hex');
    const expectedBuf = Buffer.from(expectedSig, 'hex');
    if (sigBuf.length !== expectedBuf.length) return false;
    return crypto.timingSafeEqual(sigBuf, expectedBuf);
  } catch {
    return false;
  }
}
