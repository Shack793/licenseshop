'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function TrialRequestPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const res = await fetch('/api/trial/request', {
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
      <h2>Get a trial key</h2>
      {sent ? (
        <p className="success-text">
          Check your inbox — we sent a confirmation link. Click it to get your trial key.
        </p>
      ) : (
        <>
          <p className="lede">
            Enter your email and we'll send a confirmation link, then your trial key.
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
              {loading ? 'Sending...' : 'Email me a trial key'}
            </button>
          </form>
        </>
      )}
      <p className="foot-link">
        Already have a key? <Link href="/license">Check it here</Link>
      </p>
    </div>
  );
}
