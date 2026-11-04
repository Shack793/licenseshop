import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { prisma } from './db';

// Falls back to local disk storage when R2 isn't configured, so the app
// (admin release uploads, customer downloads) is fully testable without
// a Cloudflare account. Whether this is safe to use in PRODUCTION depends
// entirely on where you host:
//   - Serverless hosts (Vercel, etc.) have no persistent writable disk
//     across requests/deploys — production there MUST set the R2_* vars.
//   - A persistent host with real disk (a VPS, or Namecheap's cPanel
//     Node.js Selector / shared-hosting "Business" plans) keeps this
//     directory around across requests, so this fallback is fine to run
//     as the real production storage there — it just isn't CDN-backed or
//     redundant, so back up `local-releases/` yourself.
const useR2 = Boolean(process.env.R2_ENDPOINT && process.env.R2_ACCESS_KEY_ID);

const LOCAL_DIR = path.join(process.cwd(), 'local-releases');

function r2Client() {
  return new S3Client({
    region: 'auto',
    endpoint: process.env.R2_ENDPOINT,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
  });
}

export function isUsingLocalStorage(): boolean {
  return !useR2;
}

// Used by the admin "publish release" upload. Returns the stored path and
// size so the caller can save them on the Release row.
export async function uploadRelease(
  fileName: string,
  buffer: Buffer
): Promise<{ filePath: string; fileSize: number }> {
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');

  if (useR2) {
    const key = `releases/${Date.now()}-${safeName}`;
    await r2Client().send(
      new PutObjectCommand({ Bucket: process.env.R2_BUCKET_NAME, Key: key, Body: buffer })
    );
    return { filePath: key, fileSize: buffer.length };
  }

  fs.mkdirSync(LOCAL_DIR, { recursive: true });
  const key = `${Date.now()}-${safeName}`;
  fs.writeFileSync(path.join(LOCAL_DIR, key), buffer);
  return { filePath: key, fileSize: buffer.length };
}

// Generates a URL that expires quickly (default 5 min) so it can't be
// shared/reused after the fact. Only call this after confirming the
// requesting license is currently valid.
export async function getSignedDownloadUrl(filePath: string, expiresInSeconds = 300): Promise<string> {
  if (useR2) {
    const command = new GetObjectCommand({ Bucket: process.env.R2_BUCKET_NAME, Key: filePath });
    return getSignedUrl(r2Client(), command, { expiresIn: expiresInSeconds });
  }

  // Local fallback: a DB-backed one-time token standing in for an S3
  // presigned URL, served by /api/local-download/[token].
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
