import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { emailPaymentLicense, fulfillPayment, getPayMeta } from '@/lib/payments';
export const dynamic = 'force-dynamic';

// Admin recovery tools (behind the admin middleware):
//  - issue:  you've verified the money arrived (e.g. in your NOWPayments
//            dashboard) but the webhook never did its job -> create the licence and email it.
//  - resend: payment is confirmed, the key email didn't arrive -> send it again.
const schema = z.object({ action: z.enum(['issue', 'resend']) });

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

  const payment = await prisma.payment.findUnique({ where: { id: params.id } });
  if (!payment) return NextResponse.json({ error: 'Payment not found' }, { status: 404 });

  if (parsed.data.action === 'issue') {
    const r = await fulfillPayment(payment.id);
    const meta = await getPayMeta(payment.id);
    return NextResponse.json({ ok: r.ok, emailed: r.emailed, emailError: meta.emailError || null });
  }

  if (payment.status !== 'CONFIRMED' || !payment.licenseId) {
    return NextResponse.json({ error: 'This payment has no license yet — use “Issue key” instead' }, { status: 400 });
  }
  const emailed = await emailPaymentLicense(payment.id);
  const meta = await getPayMeta(payment.id);
  return NextResponse.json({ ok: emailed, emailed, emailError: meta.emailError || null });
}
