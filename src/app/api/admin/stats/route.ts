import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET() {
  const [totalLicenses, activeTrials, perpetualLicenses, confirmedPayments, revenueAgg] =
    await Promise.all([
      prisma.license.count(),
      prisma.license.count({
        where: { isTrial: true, status: 'TRIAL', expiresAt: { gt: new Date() } },
      }),
      prisma.license.count({ where: { isTrial: false, status: 'ACTIVE' } }),
      prisma.payment.count({ where: { status: 'CONFIRMED' } }),
      prisma.payment.aggregate({ where: { status: 'CONFIRMED' }, _sum: { amount: true } }),
    ]);

  return NextResponse.json({
    totalLicenses,
    activeTrials,
    perpetualLicenses,
    confirmedPayments,
    revenueUsd: revenueAgg._sum.amount ?? 0,
  });
}
