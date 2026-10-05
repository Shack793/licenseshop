import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createVerificationToken } from '@/lib/verification';
import { sendResendVerificationEmail } from '@/lib/email';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';
export const dynamic = 'force-dynamic';


const schema = z.object({ email: z.string().email() });

export async function POST(req: Request) {
  const ip = getClientIp(req);
  const ipOk = await checkRateLimit('resend-request-ip', ip, 8, 60);
  if (!ipOk) {
    return NextResponse.json({ error: 'Too many requests. Try again later.' }, { status: 429 });
  }

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Enter a valid email address' }, { status: 400 });
  }

  const email = parsed.data.email.toLowerCase();
  const token = await createVerificationToken(email, 'resend');
  const verifyUrl = `${process.env.NEXTAUTH_URL}/api/license/resend/verify?token=${token}`;
  await sendResendVerificationEmail(email, verifyUrl);

  // Same response whether or not this email actually has any licenses —
  // don't let this endpoint be used to probe which addresses have bought.
  return NextResponse.json({ success: true });
}
