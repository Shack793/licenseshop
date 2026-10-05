'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function CheckoutPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleCheckout(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const res = await fetch('/api/payments/nowpayments/create-invoice', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error || 'Could not start checkout');
      return;
    }

    // Send the buyer to NOWPayments' hosted invoice page to pick a coin
    // and get a deposit address. Their key is emailed automatically once
    // the webhook confirms payment.
    window.location.href = data.invoiceUrl;
  }

  return (
    <div className="auth-shell" style={{ maxWidth: 420 }}>
      <h2>Checkout</h2>
      <p className="lede">
        Enter your email — your license key is sent here once payment confirms.
      </p>
      <form onSubmit={handleCheckout}>
        <label>Email</label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
        />
        <div className="price-row" style={{ marginBottom: '1.4rem' }}>
          <div>License</div>
          <div className="amount">
            ${process.env.NEXT_PUBLIC_PRODUCT_PRICE_USD ?? '49.00'}
            <small>one-time</small>
          </div>
        </div>
        {error && <div className="error-text">{error}</div>}
        <button className="btn btn-block" type="submit" disabled={loading}>
          {loading ? 'Starting checkout...' : 'Pay with crypto'}
        </button>
      </form>
      <p className="foot-link">
        Already have a key? <Link href="/license">Check it here</Link>
      </p>
    </div>
  );
}
