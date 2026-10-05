'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface Stats {
  totalLicenses: number;
  activeTrials: number;
  perpetualLicenses: number;
  confirmedPayments: number;
  revenueUsd: number;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    fetch('/api/admin/stats')
      .then((r) => r.json())
      .then(setStats);
  }, []);

  return (
    <div className="admin-wrap">
      <h2>Dashboard</h2>

      <div className="stat-grid">
        <div className="stat-tile">
          <div className="stat-value">{stats?.totalLicenses ?? '—'}</div>
          <div className="stat-label">Total licenses</div>
        </div>
        <div className="stat-tile">
          <div className="stat-value">{stats?.activeTrials ?? '—'}</div>
          <div className="stat-label">Active trials</div>
        </div>
        <div className="stat-tile">
          <div className="stat-value">{stats?.perpetualLicenses ?? '—'}</div>
          <div className="stat-label">Paid licenses</div>
        </div>
        <div className="stat-tile">
          <div className="stat-value">
            {stats ? `$${Number(stats.revenueUsd).toFixed(0)}` : '—'}
          </div>
          <div className="stat-label">Revenue ({stats?.confirmedPayments ?? 0} sales)</div>
        </div>
      </div>

      <div className="admin-panel">
        <h3 style={{ marginBottom: '0.6rem' }}>Quick links</h3>
        <p className="fine-print" style={{ marginBottom: '1rem' }}>
          Publish a new bot version, look up a license by email or key, or review recent payments.
        </p>
        <div className="hero-actions">
          <Link href="/admin/releases" className="btn-ghost">
            Publish a release
          </Link>
          <Link href="/admin/licenses" className="btn-ghost">
            Search licenses
          </Link>
          <Link href="/admin/payments" className="btn-ghost">
            View payments
          </Link>
        </div>
      </div>
    </div>
  );
}
