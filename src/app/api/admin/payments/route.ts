import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import type { PayMeta } from '@/lib/payments';
export const dynamic = 'force-dynamic';

export async function GET() {
  const payments = await prisma.payment.findMany({
    orderBy: { createdAt: 'desc' },
    take: 200,
    include: { license: true },
  });

  // Diagnostics (last webhook seen, email outcome). Missing table/rows = no info, not an error.
  const meta: Record<string, PayMeta> = {};
  try {
    const rows = await prisma.setting.findMany({ where: { key: { startsWith: 'pay.' } } });
    for (const r of rows) {
      try { meta[r.key.slice(4)] = JSON.parse(r.value); } catch { /* skip */ }
    }
  } catch { /* ignore */ }

  return NextResponse.json({
    payments: payments.map((p: any) => ({ ...p, meta: meta[p.id] ?? {}, licenseKey: p.license?.key ?? null })),
  });
}
