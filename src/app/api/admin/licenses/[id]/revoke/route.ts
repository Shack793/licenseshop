import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
export const dynamic = 'force-dynamic';


const schema = z.object({ action: z.enum(['revoke', 'reactivate']) });

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  }

  const license = await prisma.license.findUnique({ where: { id: params.id } });
  if (!license) {
    return NextResponse.json({ error: 'License not found' }, { status: 404 });
  }

  if (parsed.data.action === 'revoke') {
    const updated = await prisma.license.update({
      where: { id: params.id },
      data: { status: 'REVOKED', revokedAt: new Date() },
    });
    return NextResponse.json({ license: updated });
  }

  // Reactivate: restore to its natural status (TRIAL if it's a trial and
  // hasn't expired, ACTIVE otherwise). Doesn't un-expire an expired trial.
  const expired = license.expiresAt ? license.expiresAt < new Date() : false;
  const updated = await prisma.license.update({
    where: { id: params.id },
    data: {
      status: expired ? 'EXPIRED' : license.isTrial ? 'TRIAL' : 'ACTIVE',
      revokedAt: null,
    },
  });
  return NextResponse.json({ license: updated });
}
