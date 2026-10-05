import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET() {
  const payments = await prisma.payment.findMany({
    orderBy: { createdAt: 'desc' },
    take: 200,
    include: { license: true },
  });
  return NextResponse.json({ payments });
}
