import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';
import { getPayMeta } from '@/lib/payments';
export const dynamic = 'force-dynamic';

// Lets the post-payment page show progress. The order id is an unguessable
// UUID only the buyer's browser holds; nothing sensitive (no key, no email) is returned.
export async function GET(req: Request) {
  const ok = await checkRateLimit('pay-status-ip', getClientIp(req), 400, 60);
  if (!ok) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });

  const order = new URL(req.url).searchParams.get('order') || '';
  if (!/^[0-9a-f-]{36}$/i.test(order)) return NextResponse.json({ error: 'Unknown order' }, { status: 404 });

  const payment = await prisma.payment.findUnique({ where: { id: order } });
  if (!payment) return NextResponse.json({ error: 'Unknown order' }, { status: 404 });

  const meta = await getPayMeta(order);
  return NextResponse.json({ status: payment.status, emailed: Boolean(meta.emailSentAt) });
}
