import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { validateLicenseKey } from '@/lib/license';
import { createAppToken } from '@/lib/app-session';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';
export const dynamic = 'force-dynamic';


const schema = z.object({
  key: z.string().min(1).max(64),
  deviceHash: z.string().min(16).max(128),
});

// The hosted app calls this on load (and again every few minutes) with the
// customer's key and a device hash. A valid answer hands back a short-lived
// token for /api/engine/*; anything else tells the app to show its lock
// screen. Reuses validateLicenseKey, so the device limit and the
// one-trial-per-device lock apply here exactly as they do for the API.
export async function POST(req: Request) {
  const ip = getClientIp(req);
  if (!(await checkRateLimit('app-session-ip', ip, 120, 60))) {
    return NextResponse.json({ ok: false, reason: 'RATE_LIMITED' }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, reason: 'BAD_REQUEST' }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, reason: 'BAD_REQUEST' }, { status: 400 });
  }

  const key = parsed.data.key.trim().toUpperCase();
  const result = await validateLicenseKey(key, parsed.data.deviceHash);
  if (!result.valid) {
    return NextResponse.json({ ok: false, reason: result.reason }, { status: 403 });
  }

  const license = await prisma.license.findUnique({ where: { key } });
  if (!license) return NextResponse.json({ ok: false, reason: 'NOT_FOUND' }, { status: 403 });

  const { token, expiresAt } = createAppToken(license.id, parsed.data.deviceHash);
  return NextResponse.json({
    ok: true,
    token,
    tokenExpiresAt: expiresAt,
    license: { tier: result.tier, isTrial: result.isTrial, expiresAt: result.expiresAt },
  });
}
