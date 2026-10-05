import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { getSignedDownloadUrl } from '@/lib/storage';
export const dynamic = 'force-dynamic';


const schema = z.object({ key: z.string().min(1) });

// No session — the license key itself, checked fresh against the DB on
// every request, is what gates the download. A revoked/expired key stops
// working immediately, same guarantee an account-based check would give.
export async function POST(req: Request, { params }: { params: { releaseId: string } }) {
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Enter a license key' }, { status: 400 });
  }

  const license = await prisma.license.findUnique({
    where: { key: parsed.data.key.trim().toUpperCase() },
  });
  if (!license) {
    return NextResponse.json({ error: 'No license found for that key' }, { status: 404 });
  }
  if (license.status === 'REVOKED') {
    return NextResponse.json({ error: 'This license has been revoked' }, { status: 403 });
  }
  if (license.expiresAt && license.expiresAt < new Date()) {
    return NextResponse.json({ error: 'This license has expired' }, { status: 403 });
  }

  const release = await prisma.release.findUnique({ where: { id: params.releaseId } });
  if (!release) {
    return NextResponse.json({ error: 'Release not found' }, { status: 404 });
  }

  const url = await getSignedDownloadUrl(release.filePath);
  return NextResponse.json({ url, version: release.version });
}
