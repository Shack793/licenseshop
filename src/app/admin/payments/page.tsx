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
}

export default function AdminPaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([]);

  useEffect(() => {
    fetch('/api/admin/payments')
      .then((r) => r.json())
      .then((data) => setPayments(data.payments || []));
  }, []);

  return (
    <div className="admin-wrap">
      <h2>Payments</h2>
      <table className="data-table">
        <thead>
          <tr>
            <th>Email</th>
            <th>Amount</th>
            <th>Paid with</th>
            <th>Status</th>
            <th>Date</th>
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
              </tr>
            );
          })}
          {payments.length === 0 && (
            <tr>
              <td data-label="" colSpan={5} style={{ color: 'var(--ink-faint)' }}>
                No payments yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
