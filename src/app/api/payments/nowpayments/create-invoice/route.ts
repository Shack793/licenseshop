import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { createInvoice } from '@/lib/nowpayments';
import { isDisposableEmail } from '@/lib/disposable-email';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';

const checkoutSchema = z.object({ email: z.string().email() });

export async function POST(req: Request) {
  const ip = getClientIp(req);
  const ipOk = await checkRateLimit('checkout-ip', ip, 10, 60);
  if (!ipOk) {
    return NextResponse.json({ error: 'Too many requests. Try again later.' }, { status: 429 });
  }

  const body = await req.json();
  const parsed = checkoutSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Enter a valid email address' }, { status: 400 });
  }

  const email = parsed.data.email.toLowerCase();
  if (isDisposableEmail(email)) {
    return NextResponse.json(
      {
        error:
          'Please use a permanent email address, not a disposable one — your license key is sent there',
      },
      { status: 400 }
    );
  }

  const priceUsd = Number(process.env.PRODUCT_PRICE_USD ?? '49.00');

  // Payment row is keyed by email, not a session/user id — there's no
  // account here, so the email the buyer typed IS the record of who paid.
  const payment = await prisma.payment.create({
    data: {
      email,
      processor: 'nowpayments',
      processorRef: '',
      amount: priceUsd,
      currency: 'usd',
      status: 'PENDING',
    },
  });

  try {
    const invoice = await createInvoice({
      priceAmount: priceUsd,
      priceCurrency: 'usd',
      orderId: payment.id,
      orderDescription: 'Shoepilot Pro — perpetual license',
    });

    await prisma.payment.update({
      where: { id: payment.id },
      data: { processorRef: invoice.id },
    });

    return NextResponse.json({ invoiceUrl: invoice.invoice_url });
  } catch (err) {
    await prisma.payment.update({ where: { id: payment.id }, data: { status: 'FAILED' } });
    console.error('Invoice creation failed', err);
    return NextResponse.json({ error: 'Could not start checkout' }, { status: 502 });
  }
}
