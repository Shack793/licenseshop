import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { readLocalFile, localFileExists, isUsingLocalStorage } from '@/lib/storage';
export const dynamic = 'force-dynamic';


// Only reachable at all when R2 isn't configured — see src/lib/storage.ts.
// Mirrors what an S3 presigned URL gives you: a short-lived, one-purpose
// link that serves the file directly, no license check at this step
// (that already happened in /api/download/[releaseId], which is what
// minted this token).
export async function GET(_req: Request, { params }: { params: { token: string } }) {
  if (!isUsingLocalStorage()) {
    return NextResponse.json({ error: 'Not available' }, { status: 404 });
  }

  const record = await prisma.downloadToken.findUnique({ where: { token: params.token } });
  if (!record || record.expiresAt < new Date()) {
    return NextResponse.json({ error: 'This download link has expired' }, { status: 410 });
  }

  if (!localFileExists(record.filePath)) {
    return NextResponse.json({ error: 'File not found' }, { status: 404 });
  }

  const buffer = readLocalFile(record.filePath);
  const fileName = record.filePath.split('/').pop() || 'download';

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${fileName}"`,
      'Content-Length': String(buffer.length),
    },
  });
}
