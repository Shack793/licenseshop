'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function ForgotKeyPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const res = await fetch('/api/license/resend/request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });

    setLoading(false);
    if (!res.ok) {
      const data = await res.json();
      setError(data.error || 'Something went wrong');
      return;
    }
    setSent(true);
  }

  return (
    <div className="auth-shell">
      <h2>Forgot your key?</h2>
      {sent ? (
        <p className="success-text">
          If that email has a license on file, we've sent a confirmation link — click it and
          we'll resend your key(s).
        </p>
      ) : (
        <>
          <p className="lede">
            Enter the email you used for your trial or purchase. We'll confirm it's you, then
            resend your existing key — this won't issue a new trial.
          </p>
          <form onSubmit={handleSubmit}>
            <label>Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
            {error && <div className="error-text">{error}</div>}
            <button className="btn btn-block" type="submit" disabled={loading}>
              {loading ? 'Sending...' : 'Send confirmation link'}
            </button>
          </form>
        </>
      )}
      <p className="foot-link">
        Have your key already? <Link href="/license">Check it here</Link>
      </p>
    </div>
  );
}
