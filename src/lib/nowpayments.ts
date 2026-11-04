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

function siteUrl(): string {
  const base = (process.env.NEXTAUTH_URL || '').replace(/\/+$/, '');
  // Without a real public URL NOWPayments can't call us back, which looks
  // exactly like "nothing happens after payment" — fail loudly instead.
  if (!/^https?:\/\/[^/]+/.test(base)) {
    throw new Error('NEXTAUTH_URL is not set to your public site URL (e.g. https://blackjack.us)');
  }
  return base;
}

export async function createInvoice(params: CreateInvoiceParams) {
  const base = siteUrl();
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
      ipn_callback_url: `${base}/api/payments/nowpayments/webhook`,
      success_url: `${base}/checkout/success?order=${encodeURIComponent(params.orderId)}`,
      cancel_url: `${base}/checkout?purchase=cancelled`,
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
  const a = Buffer.from(hmac);
  const b = Buffer.from(signatureHeader.trim().toLowerCase());
  // timingSafeEqual throws on different lengths; a wrong-length signature is just invalid.
  return a.length === b.length && crypto.timingSafeEqual(a, b);
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
