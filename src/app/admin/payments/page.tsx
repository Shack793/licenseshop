'use client';

import { useEffect, useState } from 'react';

interface Payment {
  id: string;
  email: string;
  processor: string;
  amount: string;
  currency: string;
  payCurrency: string | null;
  status: string;
  createdAt: string;
  confirmedAt: string | null;
  licenseKey: string | null;
  meta: { lastIpnStatus?: string; lastIpnAt?: string; emailSentAt?: string; emailError?: string };
}

export default function AdminPaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([]);

  const [note, setNote] = useState('');

  function load() {
    fetch('/api/admin/payments')
      .then((r) => r.json())
      .then((data) => setPayments(data.payments || []));
  }
  useEffect(load, []);

  async function act(id: string, action: 'issue' | 'resend') {
    if (action === 'issue' && !confirm('Only do this if you have checked in your NOWPayments dashboard that this payment really arrived. Create the license and email it now?')) return;
    setNote('Working…');
    const res = await fetch(`/api/admin/payments/${id}/fulfill`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    });
    const d = await res.json();
    setNote(
      !res.ok ? d.error || 'Failed' : d.emailed ? 'Done — key emailed to the customer.' : `License created but the email failed: ${d.emailError || 'unknown error'} (check Email settings)`
    );
    load();
  }

  return (
    <div className="admin-wrap">
      <h2>Payments</h2>
      {note && <p className="fine-print" style={{ marginBottom: '1rem' }}>{note}</p>}
      <table className="data-table">
        <thead>
          <tr>
            <th>Email</th>
            <th>Amount</th>
            <th>Paid with</th>
            <th>Status</th>
            <th>Date</th>
            <th>Webhook</th>
            <th>Key email</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {payments.map((p) => {
            const tagClass = p.status === 'CONFIRMED' ? 'active' : p.status === 'FAILED' ? 'revoked' : 'trial';
            return (
              <tr key={p.id}>
                <td data-label="Email">{p.email}</td>
                <td data-label="Amount">${Number(p.amount).toFixed(2)} {p.currency.toUpperCase()}</td>
                <td data-label="Paid with">{p.payCurrency || '—'}</td>
                <td data-label="Status">
                  <span className={`tag ${tagClass}`}>{p.status.toLowerCase()}</span>
                </td>
                <td data-label="Date">{new Date(p.createdAt).toLocaleDateString()}</td>
                <td data-label="Webhook">
                  {p.meta.lastIpnStatus ? (
                    <span title={p.meta.lastIpnAt}>{p.meta.lastIpnStatus}</span>
                  ) : (
                    <span style={{ color: 'var(--ink-faint)' }}>none received</span>
                  )}
                </td>
                <td data-label="Key email">
                  {p.meta.emailSentAt ? (
                    <span className="tag active">sent</span>
                  ) : p.meta.emailError ? (
                    <span className="tag revoked" title={p.meta.emailError}>failed</span>
                  ) : (
                    <span style={{ color: 'var(--ink-faint)' }}>—</span>
                  )}
                </td>
                <td data-label="">
                  {p.status === 'CONFIRMED' && p.licenseKey ? (
                    <button className="btn-ghost btn-sm" onClick={() => act(p.id, 'resend')}>Resend email</button>
                  ) : (
                    <button className="btn-ghost btn-sm" onClick={() => act(p.id, 'issue')}>Issue key</button>
                  )}
                </td>
              </tr>
            );
          })}
          {payments.length === 0 && (
            <tr>
              <td data-label="" colSpan={8} style={{ color: 'var(--ink-faint)' }}>
                No payments yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
