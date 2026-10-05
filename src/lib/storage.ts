import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { prisma } from './db';

// Namecheap shared hosting has real persistent disk (unlike Vercel
// serverless), so release files live under ./local-releases/ and are served
// through a short-lived, DB-backed token (DownloadToken table) via
// /api/local-download/[token]. No S3/R2 needed. Back up local-releases/
// yourself — it has no CDN or redundancy.
const LOCAL_DIR = path.join(process.cwd(), 'local-releases');

export function isUsingLocalStorage(): boolean {
  return true;
}

// Used by the admin "publish release" upload. Returns the stored path and
// size so the caller can save them on the Release row.
export async function uploadRelease(
  fileName: string,
  buffer: Buffer
): Promise<{ filePath: string; fileSize: number }> {
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
  fs.mkdirSync(LOCAL_DIR, { recursive: true });
  const key = `${Date.now()}-${safeName}`;
  fs.writeFileSync(path.join(LOCAL_DIR, key), buffer);
  return { filePath: key, fileSize: buffer.length };
}

// Generates a URL that expires quickly (default 5 min) so it can't be
// shared/reused after the fact. Only call this after confirming the
// requesting license is currently valid.
export async function getSignedDownloadUrl(filePath: string, expiresInSeconds = 300): Promise<string> {
  // Local token standing in for an S3 presigned URL, served by /api/local-download/[token].
  const token = crypto.randomBytes(24).toString('hex');
  await prisma.downloadToken.create({
    data: { token, filePath, expiresAt: new Date(Date.now() + expiresInSeconds * 1000) },
  });
  return `/api/local-download/${token}`;
}

export function readLocalFile(filePath: string): Buffer {
  return fs.readFileSync(path.join(LOCAL_DIR, filePath));
}

export function localFileExists(filePath: string): boolean {
  return fs.existsSync(path.join(LOCAL_DIR, filePath));
}
