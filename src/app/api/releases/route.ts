import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
export const dynamic = 'force-dynamic';


// Public — version history isn't sensitive, only the actual download
// (gated by license key at /api/download/[releaseId]) is.
export async function GET() {
  const releases = await prisma.release.findMany({
    orderBy: { releasedAt: 'desc' },
    select: { id: true, version: true, changelog: true, isLatest: true, releasedAt: true, fileSize: true },
  });

  return NextResponse.json({ releases });
}
