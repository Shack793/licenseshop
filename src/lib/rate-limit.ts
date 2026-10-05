import { prisma } from './db';

// DB-backed on purpose: an in-memory counter doesn't work once you have
// more than one serverless instance (Vercel will run several), since each
// instance would have its own counter. A row per attempt, counted within
// a sliding window, works the same regardless of which database/host
// you're running against (MySQL on Namecheap, Postgres on Neon, etc).
export async function checkRateLimit(
  bucket: string,
  identifier: string,
  max: number,
  windowMinutes: number
): Promise<boolean> {
  const windowStart = new Date(Date.now() - windowMinutes * 60 * 1000);

  const count = await prisma.rateLimitHit.count({
    where: { bucket, identifier, createdAt: { gte: windowStart } },
  });

  if (count >= max) return false;

  await prisma.rateLimitHit.create({ data: { bucket, identifier } });
  return true;
}

export function getClientIp(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0].trim();
  return req.headers.get('x-real-ip') || 'unknown';
}
