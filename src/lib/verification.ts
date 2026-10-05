import crypto from 'crypto';
import { prisma } from './db';

const TOKEN_TTL_MINUTES = 30;

export async function createVerificationToken(email: string, purpose = 'trial') {
  const token = crypto.randomBytes(24).toString('hex');
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MINUTES * 60 * 1000);

  await prisma.emailVerification.create({
    data: { email: email.toLowerCase(), token, purpose, expiresAt },
  });

  return token;
}

export type ConsumeResult =
  | { ok: true; email: string }
  | { ok: false; reason: 'NOT_FOUND' | 'EXPIRED' | 'ALREADY_USED' };

// Consumes (marks used) a verification token. One-time use: calling this
// twice with the same token returns ALREADY_USED on the second call.
export async function consumeVerificationToken(token: string): Promise<ConsumeResult> {
  const record = await prisma.emailVerification.findUnique({ where: { token } });
  if (!record) return { ok: false, reason: 'NOT_FOUND' };
  if (record.verifiedAt) return { ok: false, reason: 'ALREADY_USED' };
  if (record.expiresAt < new Date()) return { ok: false, reason: 'EXPIRED' };

  await prisma.emailVerification.update({
    where: { token },
    data: { verifiedAt: new Date() },
  });

  return { ok: true, email: record.email };
}
