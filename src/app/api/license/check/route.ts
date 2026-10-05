import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getLicenseStatus } from '@/lib/license';

const schema = z.object({ key: z.string().min(1) });

// Public, read-only lookup for the "check your license" page. No session —
// the key itself, typed in by whoever has it, is the only credential.
export async function POST(req: Request) {
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Enter a license key' }, { status: 400 });
  }

  const status = await getLicenseStatus(parsed.data.key.trim().toUpperCase());
  if (!status) {
    return NextResponse.json({ error: 'No license found for that key' }, { status: 404 });
  }

  return NextResponse.json(status);
}
