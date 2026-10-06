/**
 * Deliberately simple: one shared admin password (ADMIN_PASSWORD), one
 * HMAC-signed session cookie. There's no admin user table — if you need
 * more than one admin identity later, swap this for real accounts, but
 * for a single-operator storefront this avoids building a whole second
 * auth system on top of the no-accounts customer-facing one.
 *
 * Runs in BOTH runtimes: the login API route (Node) and middleware.ts
 * (Edge). So this file uses only Web APIs (crypto.subtle, atob/btoa) —
 * never `node:crypto` or `Buffer`. The old version imported `crypto`
 * (Node), which does not exist in Edge: verification threw on every call,
 * the catch returned false, and every admin page bounced to /admin/login
 * with no error — even with the right password.
 */

const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours
export const ADMIN_COOKIE_NAME = 'admin_session';

function sessionSecret(): string {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret) throw new Error('ADMIN_SESSION_SECRET not set');
  return secret;
}

function hexFromBytes(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function sha256Hex(data: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(data));
  return hexFromBytes(digest);
}

async function hmacHex(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
  return hexFromBytes(sig);
}

// Constant-time compare so response timing doesn't leak how many
// characters of the password were correct.
function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function b64urlEncode(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  bytes.forEach((b) => {
    bin += String.fromCharCode(b);
  });
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlDecode(b64url: string): string {
  const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

export async function checkAdminPassword(password: string): Promise<boolean> {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) return false;
  const [a, b] = await Promise.all([sha256Hex(password), sha256Hex(expected)]);
  return timingSafeEqualHex(a, b);
}

export async function createAdminSessionCookie(): Promise<string> {
  const expires = Date.now() + SESSION_TTL_MS;
  const payload = `admin:${expires}`;
  const sig = await hmacHex(sessionSecret(), payload);
  return b64urlEncode(`${payload}:${sig}`);
}

export async function verifyAdminSessionCookie(cookie: string | undefined): Promise<boolean> {
  if (!cookie) return false;
  try {
    const decoded = b64urlDecode(cookie);
    const parts = decoded.split(':');
    if (parts.length !== 3) return false;
    const [prefix, expiresStr, sig] = parts;
    if (prefix !== 'admin') return false;

    const expires = Number(expiresStr);
    if (!Number.isFinite(expires) || Date.now() > expires) return false;

    const expectedSig = await hmacHex(sessionSecret(), `${prefix}:${expiresStr}`);
    return timingSafeEqualHex(sig, expectedSig);
  } catch {
    return false;
  }
}
