import crypto from 'crypto';
import { prisma } from '@/lib/db';

// Key/value settings stored in the `settings` table, edited from /admin/email.
// Reads are cached for a few seconds (cheap on shared hosting, and still picks
// up a save made in another Passenger process quickly).

const TTL_MS = 10_000;
let cache: { at: number; data: Map<string, string> } | null = null;

export function invalidateSettingsCache() {
  cache = null;
}

async function loadAll(): Promise<Map<string, string>> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.data;
  const rows: { key: string; value: string }[] = await prisma.setting.findMany();
  const data = new Map(rows.map((r) => [r.key, r.value]));
  cache = { at: Date.now(), data };
  return data;
}

/** Never throws: if the table doesn't exist yet (db push not run) we behave as "nothing set". */
export async function getSettings(): Promise<Map<string, string>> {
  try {
    return await loadAll();
  } catch (e) {
    console.error('settings: could not read settings table, using defaults', e);
    return new Map();
  }
}

export async function saveSettings(values: Record<string, string>, deleteKeys: string[] = []) {
  await prisma.$transaction([
    ...Object.entries(values).map(([key, value]) =>
      prisma.setting.upsert({ where: { key }, create: { key, value }, update: { value } })
    ),
    ...(deleteKeys.length ? [prisma.setting.deleteMany({ where: { key: { in: deleteKeys } } })] : []),
  ]);
  invalidateSettingsCache();
}

// --- Secret storage (SMTP password) ---------------------------------------
// AES-256-GCM with a key derived from ADMIN_SESSION_SECRET. This protects the
// password from a casual look at a DB dump/backup; it can't protect against
// someone who has both the database AND your environment variables.
// Consequence: if you change ADMIN_SESSION_SECRET, re-enter the SMTP password.

function secretKey(): Buffer {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret) throw new Error('ADMIN_SESSION_SECRET not set');
  return crypto.createHash('sha256').update(`settings-v1:${secret}`).digest();
}

export function encryptSecret(plain: string): string {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', secretKey(), iv);
  const enc = Buffer.concat([c.update(plain, 'utf8'), c.final()]);
  return `v1:${Buffer.concat([iv, c.getAuthTag(), enc]).toString('base64')}`;
}

export function decryptSecret(stored: string): string | null {
  try {
    if (!stored.startsWith('v1:')) return null;
    const buf = Buffer.from(stored.slice(3), 'base64');
    const d = crypto.createDecipheriv('aes-256-gcm', secretKey(), buf.subarray(0, 12));
    d.setAuthTag(buf.subarray(12, 28));
    return Buffer.concat([d.update(buf.subarray(28)), d.final()]).toString('utf8');
  } catch {
    return null;
  }
}
