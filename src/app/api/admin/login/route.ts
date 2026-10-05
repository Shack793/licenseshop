import { NextResponse } from 'next/server';
import { z } from 'zod';
import { checkAdminPassword, createAdminSessionCookie, ADMIN_COOKIE_NAME } from '@/lib/admin-auth';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';

const schema = z.object({ password: z.string().min(1) });

export async function POST(req: Request) {
  // Rate-limit login attempts by IP — this is the one endpoint where
  // brute-forcing actually matters, since a single password gates the
  // whole admin area.
  const ip = getClientIp(req);
  const allowed = await checkRateLimit('admin-login-ip', ip, 10, 15);
  if (!allowed) {
    return NextResponse.json({ error: 'Too many attempts. Try again later.' }, { status: 429 });
  }

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Enter the admin password' }, { status: 400 });
  }

  if (!checkAdminPassword(parsed.data.password)) {
    return NextResponse.json({ error: 'Incorrect password' }, { status: 401 });
  }

  const res = NextResponse.json({ success: true });
  res.cookies.set(ADMIN_COOKIE_NAME, createAdminSessionCookie(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 12 * 60 * 60,
  });
  return res;
}
