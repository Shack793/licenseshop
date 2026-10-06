import crypto from 'crypto';

const API_BASE = 'https://api.nowpayments.io/v1';

function apiKey() {
  const key = process.env.NOWPAYMENTS_API_KEY;
  if (!key) throw new Error('NOWPAYMENTS_API_KEY not set');
  return key;
}

export interface CreateInvoiceParams {
  priceAmount: number; // in fiat, e.g. 19.99
  priceCurrency: string; // e.g. "usd"
  orderId: string; // your internal payment.id, so the webhook can look it up
  orderDescription: string;
  // Make the buyer cover NOWPayments' service fee on top of the price, so you
  // receive the full amount. Off by default; see NOWPAYMENTS_FEE_PAID_BY_USER.
  feePaidByUser?: boolean;
}

export async function createInvoice(params: CreateInvoiceParams) {
  const res = await fetch(`${API_BASE}/invoice`, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      price_amount: params.priceAmount,
      price_currency: params.priceCurrency,
      order_id: params.orderId,
      order_description: params.orderDescription,
      ...(params.feePaidByUser ? { is_fee_paid_by_user: true } : {}),
      ipn_callback_url: `${process.env.NEXTAUTH_URL}/api/payments/nowpayments/webhook`,
      success_url: `${process.env.NEXTAUTH_URL}/license?purchase=success`,
      cancel_url: `${process.env.NEXTAUTH_URL}/checkout?purchase=cancelled`,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`NOWPayments invoice creation failed: ${res.status} ${text}`);
  }

  return res.json() as Promise<{ id: string; invoice_url: string }>;
}

// NOWPayments signs IPN (webhook) payloads with HMAC-SHA512 over the
// JSON body, using a secret you set in your NOWPayments account settings.
// The signature arrives in the `x-nowpayments-sig` header. Always verify
// this before trusting a webhook body — otherwise anyone can POST a fake
// "payment confirmed" event to your endpoint.
export function verifyIpnSignature(rawBody: string, signatureHeader: string | null): boolean {
  if (!signatureHeader) return false;
  const secret = process.env.NOWPAYMENTS_IPN_SECRET;
  if (!secret) throw new Error('NOWPAYMENTS_IPN_SECRET not set');

  // NOWPayments requires the JSON to be sorted by key before hashing.
  const parsed = JSON.parse(rawBody);
  const sorted = JSON.stringify(sortKeysDeep(parsed));

  const hmac = crypto.createHmac('sha512', secret).update(sorted).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(hmac), Buffer.from(signatureHeader));
}

function sortKeysDeep(obj: any): any {
  if (Array.isArray(obj)) return obj.map(sortKeysDeep);
  if (obj !== null && typeof obj === 'object') {
    return Object.keys(obj)
      .sort()
      .reduce((acc: any, key) => {
        acc[key] = sortKeysDeep(obj[key]);
        return acc;
      }, {});
  }
  return obj;
}
