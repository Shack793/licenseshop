'use client';

import { useEffect, useState } from 'react';

interface License {
  id: string;
  key: string;
  email: string;
  tier: string;
  status: string;
  isTrial: boolean;
  expiresAt: string | null;
  deviceLimit: number;
  activationsUsed: number;
  createdAt: string;
}

export default function AdminLicensesPage() {
  const [q, setQ] = useState('');
  const [licenses, setLicenses] = useState<License[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  function load(query: string) {
    const url = query ? `/api/admin/licenses?q=${encodeURIComponent(query)}` : '/api/admin/licenses';
    fetch(url)
      .then((r) => r.json())
      .then((data) => setLicenses(data.licenses || []));
  }

  useEffect(() => load(''), []);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    load(q);
  }

  async function toggleRevoke(license: License) {
    setBusyId(license.id);
    const action = license.status === 'REVOKED' ? 'reactivate' : 'revoke';
    await fetch(`/api/admin/licenses/${license.id}/revoke`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    });
    setBusyId(null);
    load(q);
  }

  return (
    <div className="admin-wrap">
      <h2>Licenses</h2>

      <form className="search-row" onSubmit={handleSearch}>
        <input
          type="text"
          placeholder="Search by email or key..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <button className="btn" type="submit">
          Search
        </button>
      </form>

      <table className="data-table">
        <thead>
          <tr>
            <th>Email</th>
            <th>Key</th>
            <th>Type</th>
            <th>Status</th>
            <th>Devices</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {licenses.map((l) => {
            const expired = l.expiresAt ? new Date(l.expiresAt) < new Date() : false;
            const displayStatus = expired && l.status !== 'REVOKED' ? 'EXPIRED' : l.status;
            const tagClass = displayStatus === 'REVOKED' || displayStatus === 'EXPIRED'
              ? 'revoked'
              : l.isTrial
                ? 'trial'
                : 'active';
            return (
              <tr key={l.id}>
                <td data-label="Email">{l.email}</td>
                <td data-label="Key" className="mono">{l.key}</td>
                <td data-label="Type">{l.isTrial ? 'Trial' : 'Perpetual'}</td>
                <td data-label="Status">
                  <span className={`tag ${tagClass}`}>{displayStatus.toLowerCase()}</span>
                </td>
                <td data-label="Devices">{l.activationsUsed}/{l.deviceLimit}</td>
                <td data-label="Action">
                  <button
                    className="btn-ghost btn-sm"
                    disabled={busyId === l.id}
                    onClick={() => toggleRevoke(l)}
                  >
                    {l.status === 'REVOKED' ? 'Reactivate' : 'Revoke'}
                  </button>
                </td>
              </tr>
            );
          })}
          {licenses.length === 0 && (
            <tr>
              <td data-label="" colSpan={6} style={{ color: 'var(--ink-faint)' }}>
                No licenses found.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
