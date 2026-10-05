import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isDisposableEmail } from '@/lib/disposable-email';
import { createVerificationToken } from '@/lib/verification';
import { sendVerificationEmail } from '@/lib/email';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';

const requestSchema = z.object({ email: z.string().email() });

export async function POST(req: Request) {
  // Throttle, don't hard-block: shared IPs/VPNs make a hard block risky,
  // but 8 trial requests/hour from one IP and 3/day for one email address
  // are both well past anything a real visitor would do.
  const ip = getClientIp(req);
  const ipOk = await checkRateLimit('trial-request-ip', ip, 8, 60);
  if (!ipOk) {
    return NextResponse.json({ error: 'Too many requests. Try again later.' }, { status: 429 });
  }

  const body = await req.json();
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Enter a valid email address' }, { status: 400 });
  }

  const email = parsed.data.email.toLowerCase();

  if (isDisposableEmail(email)) {
    return NextResponse.json(
      { error: 'Please use a permanent email address, not a disposable one' },
      { status: 400 }
    );
  }

  const emailOk = await checkRateLimit('trial-request-email', email, 3, 60 * 24);
  if (!emailOk) {
    return NextResponse.json({ error: 'Too many requests for this email. Try again later.' }, { status: 429 });
  }

  const token = await createVerificationToken(email, 'trial');
  const verifyUrl = `${process.env.NEXTAUTH_URL}/api/trial/verify?token=${token}`;
  await sendVerificationEmail(email, verifyUrl);

  // Always return the same success response whether or not the email was
  // valid/deliverable — don't leak which addresses exist or are blocked
  // beyond the format/disposable checks already done above.
  return NextResponse.json({ success: true });
}
