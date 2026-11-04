import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyIpnSignature } from '@/lib/nowpayments';
import { fulfillPayment, setPayMeta } from '@/lib/payments';
export const dynamic = 'force-dynamic';

// "confirmed" = the network has confirmed the buyer's transfer; "finished" =
// NOWPayments has also forwarded the funds to you. For a $20 digital licence
// there is no reason to make the buyer wait for the second step.
const SUCCESS_STATUSES = new Set(['confirmed', 'finished']);
const TERMINAL_FAILURE_STATUSES = new Set(['failed', 'expired', 'refunded']);

export async function POST(req: Request) {
  const rawBody = await req.text();
  const signature = req.headers.get('x-nowpayments-sig');

  let valid = false;
  try {
    valid = verifyIpnSignature(rawBody, signature);
  } catch (err) {
    console.error('IPN verification error', err);
    return NextResponse.json({ error: 'Signature verification misconfigured' }, { status: 500 });
  }

  if (!valid) {
    // Do NOT process unverified webhooks — this is what stops someone POSTing a
    // fake "payment finished" event to grant themselves a licence. If real
    // payments land here, the IPN secret in NOWPayments doesn't match
    // NOWPAYMENTS_IPN_SECRET on the server.
    console.warn('Rejected NOWPayments webhook with invalid signature');
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  const event = JSON.parse(rawBody);
  const orderId = String(event.order_id ?? '');
  const status = String(event.payment_status ?? '');
  console.log('NOWPayments IPN', { orderId, status });

  const payment = orderId ? await prisma.payment.findUnique({ where: { id: orderId } }) : null;
  if (!payment) {
    console.error('Webhook for unknown payment/order_id', orderId);
    return NextResponse.json({ error: 'Unknown order' }, { status: 404 });
  }

  await setPayMeta(payment.id, { lastIpnStatus: status, lastIpnAt: new Date().toISOString() });

  if (SUCCESS_STATUSES.has(status)) {
    // Idempotent: retries and the second (finished) callback just re-check that
    // the licence exists and the key email went out.
    await fulfillPayment(payment.id, event.pay_currency ?? null);
  } else if (TERMINAL_FAILURE_STATUSES.has(status) && payment.status !== 'CONFIRMED') {
    await prisma.payment.update({ where: { id: payment.id }, data: { status: 'FAILED' } });
  }
  // Intermediate statuses (waiting, confirming, sending, partially_paid) -> wait for the next callback.

  return NextResponse.json({ ok: true });
}
