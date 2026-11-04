'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

type State = { status: string; emailed: boolean } | null;

function Inner() {
  const order = useSearchParams().get('order') || '';
  const [state, setState] = useState<State>(null);
  const [gone, setGone] = useState(false);
  const [tries, setTries] = useState(0);

  useEffect(() => {
    if (!order) return;
    let stop = false;
    async function poll() {
      try {
        const res = await fetch(`/api/payments/status?order=${encodeURIComponent(order)}`, { cache: 'no-store' });
        if (res.status === 404) return setGone(true);
        const d = await res.json();
        if (!stop && res.ok) setState({ status: d.status, emailed: d.emailed });
      } catch {
        /* keep polling */
      }
      if (!stop) setTries((t) => t + 1);
    }
    poll();
    return () => { stop = true; };
  }, [order]);

  // Poll every 5s until the payment is settled (give up after ~15 minutes).
  useEffect(() => {
    if (!order || gone) return;
    if (state && state.status !== 'PENDING') return;
    if (tries > 180) return;
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/payments/status?order=${encodeURIComponent(order)}`, { cache: 'no-store' });
        if (res.ok) {
          const d = await res.json();
          setState({ status: d.status, emailed: d.emailed });
        }
      } catch { /* ignore */ }
      setTries((x) => x + 1);
    }, 5000);
    return () => clearTimeout(t);
  }, [order, state, tries, gone]);

  let title = 'Waiting for your payment to confirm…';
  let body = 'This usually takes a few minutes while the network confirms your transfer. You can leave this page open — it updates by itself, and your key will be emailed to you.';
  if (!order || gone) {
    title = 'Thanks!';
    body = 'If you have paid, your license key will be emailed to you as soon as the payment confirms. Lost it later? Use “Lost your key?” below.';
  } else if (state?.status === 'CONFIRMED') {
    if (state.emailed) {
      title = 'Payment confirmed — check your email';
      body = 'Your license key is on its way to the email address you entered at checkout (check spam if you don’t see it in a minute or two). Paste it into the app to start.';
    } else {
      title = 'Payment confirmed';
      body = 'Your payment went through, but the key email hasn’t been delivered yet. Don’t pay again — we’re resending it automatically, and you can also request it any time with “Lost your key?” below.';
    }
  } else if (state?.status === 'FAILED' || state?.status === 'EXPIRED') {
    title = 'This payment didn’t go through';
    body = 'The payment failed or expired, so no license was issued. You haven’t been charged for a license — you can try again.';
  }

  const done = state?.status === 'CONFIRMED';
  return (
    <div className="auth-shell" style={{ maxWidth: 480 }}>
      <h2>{title}</h2>
      <p className="lede">{body}</p>
      {done && (
        <p>
          <a className="btn" href="/app">Open Hi-Opt II Counter</a>
        </p>
      )}
      {(state?.status === 'FAILED' || state?.status === 'EXPIRED') && (
        <p>
          <Link className="btn" href="/checkout">Try again</Link>
        </p>
      )}
      <p className="foot-link">
        Lost your key? <Link href="/license/forgot">We’ll resend it</Link> · Have a key?{' '}
        <Link href="/license">Check it</Link>
      </p>
    </div>
  );
}

export default function CheckoutSuccessPage() {
  return (
    <Suspense fallback={null}>
      <Inner />
    </Suspense>
  );
}
