import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { uploadRelease } from '@/lib/storage';
export const dynamic = 'force-dynamic';


// Gated by middleware.ts (checks the admin_session cookie for every
// /api/admin/* path) — no auth check needed in here.
export async function GET() {
  const releases = await prisma.release.findMany({ orderBy: { releasedAt: 'desc' } });
  return NextResponse.json({ releases });
}

export async function POST(req: Request) {
  const formData = await req.formData();
  const version = String(formData.get('version') || '').trim();
  const changelog = String(formData.get('changelog') || '').trim();
  const file = formData.get('file') as File | null;

  if (!version || !changelog || !file) {
    return NextResponse.json(
      { error: 'Version, changelog, and a file are all required' },
      { status: 400 }
    );
  }

  const existing = await prisma.release.findUnique({ where: { version } });
  if (existing) {
    return NextResponse.json({ error: `Version ${version} already exists` }, { status: 409 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const { filePath, fileSize } = await uploadRelease(file.name, buffer);

  // Only one release is ever "latest" — unmark the previous one.
  await prisma.release.updateMany({ where: { isLatest: true }, data: { isLatest: false } });

  const release = await prisma.release.create({
    data: { version, changelog, filePath, fileSize, isLatest: true },
  });

  return NextResponse.json({ release });
}
