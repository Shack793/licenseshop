import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyIpnSignature } from '@/lib/nowpayments';
import { createPerpetualLicense } from '@/lib/license';
import { sendLicenseEmail } from '@/lib/email';
export const dynamic = 'force-dynamic';


// NOWPayments IPN statuses that mean funds have actually settled. Only
// issue the license on the terminal "finished" state.
const SUCCESS_STATUSES = new Set(['finished']);
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
    // Do NOT process unverified webhooks — this is the check that stops
    // someone from POSTing a fake "payment finished" event to fraudulently
    // grant themselves a license.
    console.warn('Rejected NOWPayments webhook with invalid signature');
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  const event = JSON.parse(rawBody);
  const orderId = event.order_id as string; // our Payment.id
  const status = event.payment_status as string;

  const payment = await prisma.payment.findUnique({ where: { id: orderId } });
  if (!payment) {
    console.error('Webhook for unknown payment/order_id', orderId);
    return NextResponse.json({ error: 'Unknown order' }, { status: 404 });
  }

  // Idempotency: NOWPayments retries webhooks.
  if (payment.status === 'CONFIRMED') {
    return NextResponse.json({ ok: true, alreadyProcessed: true });
  }

  if (SUCCESS_STATUSES.has(status)) {
    const license = await createPerpetualLicense(payment.email);

    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: 'CONFIRMED',
        payCurrency: event.pay_currency ?? null,
        confirmedAt: new Date(),
        licenseId: license.id,
      },
    });

    await sendLicenseEmail(payment.email, license.key, false);
  } else if (TERMINAL_FAILURE_STATUSES.has(status)) {
    await prisma.payment.update({ where: { id: payment.id }, data: { status: 'FAILED' } });
  }
  // Intermediate statuses (waiting, confirming, sending) -> no-op, wait for next callback.

  return NextResponse.json({ ok: true });
}
