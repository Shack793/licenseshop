import { NextResponse } from 'next/server';
import { consumeVerificationToken } from '@/lib/verification';
import { createTrialLicense } from '@/lib/license';
import { sendLicenseEmail } from '@/lib/email';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get('token');
  const base = process.env.NEXTAUTH_URL;

  if (!token) {
    return NextResponse.redirect(`${base}/trial/sent?status=invalid`);
  }

  const result = await consumeVerificationToken(token);
  if (!result.ok) {
    return NextResponse.redirect(`${base}/trial/sent?status=${result.reason.toLowerCase()}`);
  }

  const trialDays = Number(process.env.TRIAL_DAYS ?? '3');
  const license = await createTrialLicense(result.email, trialDays);
  await sendLicenseEmail(result.email, license.key, true, trialDays);

  return NextResponse.redirect(`${base}/trial/sent?status=ok`);
}
