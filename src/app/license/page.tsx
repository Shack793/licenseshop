'use client';

import { useState } from 'react';
import Link from 'next/link';

interface LicenseStatus {
  key: string;
  tier: string;
  isTrial: boolean;
  status: string;
  expiresAt: string | null;
  valid: boolean;
}

interface Release {
  id: string;
  version: string;
  changelog: string;
  isLatest: boolean;
}

export default function LicenseCheckPage() {
  const [keyInput, setKeyInput] = useState('');
  const [license, setLicense] = useState<LicenseStatus | null>(null);
  const [releases, setReleases] = useState<Release[]>([]);
  const [error, setError] = useState('');
  const [downloadError, setDownloadError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleCheck(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setDownloadError('');
    setLoading(true);

    const res = await fetch('/api/license/check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: keyInput }),
    });
    const data = await res.json();

    if (!res.ok) {
      setLoading(false);
      setError(data.error || 'Could not find that license');
      setLicense(null);
      return;
    }

    setLicense(data);

    const relRes = await fetch('/api/releases');
    const relData = await relRes.json();
    setReleases(relData.releases || []);
    setLoading(false);
  }

  // The app reads the key from this browser's storage so the customer isn't
  // asked to paste it a second time. Nothing else is stored.
  function openApp() {
    if (!license) return;
    try {
      localStorage.setItem('shoepilot_license_key', license.key);
    } catch {
      /* storage blocked — the app will just ask for the key */
    }
    window.location.href = '/app';
  }

  async function handleDownload(releaseId: string) {
    setDownloadError('');
    const res = await fetch(`/api/download/${releaseId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: keyInput }),
    });
    if (!res.ok) {
      const data = await res.json();
      setDownloadError(data.error || 'Download failed');
      return;
    }
    const data = await res.json();
    window.location.href = data.url;
  }

  if (!license) {
    return (
      <div className="auth-shell">
        <h2>Check your license</h2>
        <p className="lede">
          Paste the key from your email to see its status and download the latest version.
        </p>
        <form onSubmit={handleCheck}>
          <label>License key</label>
          <input
            className="mono-input"
            type="text"
            required
            value={keyInput}
            onChange={(e) => setKeyInput(e.target.value)}
            placeholder="XXXXX-XXXXX-XXXXX-XXXXX"
          />
          {error && <div className="error-text">{error}</div>}
          <button className="btn btn-block" type="submit" disabled={loading}>
            {loading ? 'Checking...' : 'Check key'}
          </button>
        </form>
        <p className="foot-link">
          Don't have a key yet? <Link href="/trial">Get a free trial</Link> or{' '}
          <Link href="/checkout">buy a license</Link>
        </p>
        <p className="foot-link">
          Lost your key? <Link href="/license/forgot">We'll resend it</Link>
        </p>
      </div>
    );
  }

  const expired = license.expiresAt ? new Date(license.expiresAt) < new Date() : false;
  const tagClass =
    license.status === 'REVOKED' || expired ? 'revoked' : license.isTrial ? 'trial' : 'active';

  return (
    <div className="dash-wrap">
      <h2>Your license</h2>

      <div className="license-plate">
        <div className="plate-head">
          <div>
            <strong>{license.isTrial ? 'Trial license' : 'Lifetime license'}</strong>{' '}
            <span className={`tag ${tagClass}`}>{expired ? 'expired' : license.status.toLowerCase()}</span>
          </div>
          {license.expiresAt && (
            <span className="fine-print">
              {expired ? 'expired' : 'expires'} {new Date(license.expiresAt).toLocaleDateString()}
            </span>
          )}
        </div>
        <div className="key-line">{license.key}</div>
      </div>

      {(!license.valid || license.isTrial) && (
        <div className="upsell">
          <p>
            {license.valid
              ? 'Your trial is active. Buy a perpetual license to keep the bot running after it ends.'
              : 'This license is no longer valid. Buy a perpetual license to keep going.'}
          </p>
          <Link href="/checkout" className="btn" style={{ whiteSpace: 'nowrap' }}>
            Buy license
          </Link>
        </div>
      )}

      <h2>Open the app</h2>
      <p className="fine-print">
        Hi-Opt II Counter runs in your browser — nothing to install. Your key is checked every time it
        loads, so it stops working when a trial ends or a license is revoked.
      </p>
      <button className="btn" disabled={!license.valid} onClick={openApp}>
        {license.valid ? 'Open Hi-Opt II Counter' : 'License not active'}
      </button>

      {releases.length > 0 && <h2>Downloads &amp; version history</h2>}
      {downloadError && <div className="error-text">{downloadError}</div>}
      <div className="timeline">
        {releases.map((r) => (
          <div className={`timeline-item ${r.isLatest ? 'latest' : ''}`} key={r.id}>
            <div className="tl-row">
              <div>
                <span className="tl-version">v{r.version}</span>{' '}
                {r.isLatest && <span className="tag active">latest</span>}
                <p className="tl-note">{r.changelog}</p>
              </div>
              <button
                className={r.isLatest ? 'btn' : 'btn-ghost'}
                disabled={!license.valid}
                onClick={() => handleDownload(r.id)}
                title={!license.valid ? 'Requires a valid license' : ''}
              >
                Download
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="note-box">
        Bookmark this page and keep your key handy — there's no account to log back into, so the
        key itself (and this page) is how you check status or grab updates later.
      </div>
    </div>
  );
}
