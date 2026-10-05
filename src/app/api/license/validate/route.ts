import { NextResponse } from 'next/server';
import { z } from 'zod';
import { validateLicenseKey } from '@/lib/license';

const validateSchema = z.object({
  key: z.string().min(1),
  deviceHash: z.string().optional(), // sha256 of a machine fingerprint, computed client-side
});

// This is the endpoint the bot binary calls on every launch (or on an
// interval) to confirm the license is still valid, and the one that
// enforces the device limit and trial-device lock on first activation.
// Keep it fast; rate-limit it at the edge/proxy level in production to
// prevent brute-forcing key guesses.
export async function POST(req: Request) {
  const body = await req.json();
  const parsed = validateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ valid: false, reason: 'BAD_REQUEST' }, { status: 400 });
  }

  const result = await validateLicenseKey(parsed.data.key.trim().toUpperCase(), parsed.data.deviceHash);
  return NextResponse.json(result);
}
