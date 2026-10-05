import { NextResponse } from 'next/server';
import { consumeVerificationToken } from '@/lib/verification';
import { prisma } from '@/lib/db';
import { sendLicenseEmail } from '@/lib/email';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get('token');
  const base = process.env.NEXTAUTH_URL;

  if (!token) {
    return NextResponse.redirect(`${base}/license/resend/sent?status=invalid`);
  }

  const result = await consumeVerificationToken(token);
  if (!result.ok) {
    return NextResponse.redirect(`${base}/license/resend/sent?status=${result.reason.toLowerCase()}`);
  }

  const licenses = await prisma.license.findMany({
    where: { email: result.email, status: { not: 'REVOKED' } },
    orderBy: { createdAt: 'desc' },
  });

  if (licenses.length === 0) {
    return NextResponse.redirect(`${base}/license/resend/sent?status=none`);
  }

  // Resend the most recent non-expired license of each kind (one trial,
  // one perpetual) — this is a resend, not a reissue, so it never creates
  // a new license row.
  const sentTiers = new Set<string>();
  for (const lic of licenses) {
    const tierKey = lic.isTrial ? 'trial' : 'perpetual';
    if (sentTiers.has(tierKey)) continue;
    const expired = lic.expiresAt ? lic.expiresAt < new Date() : false;
    if (expired) continue;

    sentTiers.add(tierKey);
    await sendLicenseEmail(result.email, lic.key, lic.isTrial);
  }

  if (sentTiers.size === 0) {
    // Every license on file for this email is expired.
    return NextResponse.redirect(`${base}/license/resend/sent?status=all_expired`);
  }

  return NextResponse.redirect(`${base}/license/resend/sent?status=ok`);
}
