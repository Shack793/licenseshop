'use client';

import { useEffect, useState } from 'react';

interface Release {
  id: string;
  version: string;
  changelog: string;
  isLatest: boolean;
  releasedAt: string;
  fileSize: number | null;
}

export default function AdminReleasesPage() {
  const [releases, setReleases] = useState<Release[]>([]);
  const [version, setVersion] = useState('');
  const [changelog, setChangelog] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  function loadReleases() {
    fetch('/api/admin/releases')
      .then((r) => r.json())
      .then((data) => setReleases(data.releases || []));
  }

  useEffect(loadReleases, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (!file) {
      setError('Choose a file to upload');
      return;
    }
    setLoading(true);

    const formData = new FormData();
    formData.append('version', version);
    formData.append('changelog', changelog);
    formData.append('file', file);

    const res = await fetch('/api/admin/releases', { method: 'POST', body: formData });
    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error || 'Could not publish release');
      return;
    }

    setSuccess(`Version ${version} published and marked latest.`);
    setVersion('');
    setChangelog('');
    setFile(null);
    loadReleases();
  }

  return (
    <div className="admin-wrap">
      <h2>Releases</h2>

      <div className="admin-panel">
        <h3 style={{ marginBottom: '1rem' }}>Publish a new version</h3>
        <form onSubmit={handleSubmit}>
          <label>Version</label>
          <input
            type="text"
            required
            placeholder="1.4.3"
            value={version}
            onChange={(e) => setVersion(e.target.value)}
          />
          <label>Changelog</label>
          <textarea
            required
            placeholder="What changed in this version"
            value={changelog}
            onChange={(e) => setChangelog(e.target.value)}
          />
          <label>Bot file</label>
          <input
            type="file"
            required
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
          {error && <div className="error-text">{error}</div>}
          {success && <div className="success-text" style={{ marginBottom: '1rem' }}>{success}</div>}
          <button className="btn" type="submit" disabled={loading}>
            {loading ? 'Uploading...' : 'Publish release'}
          </button>
        </form>
      </div>

      <h2>Version history</h2>
      <table className="data-table">
        <thead>
          <tr>
            <th>Version</th>
            <th>Changelog</th>
            <th>Released</th>
            <th>Size</th>
          </tr>
        </thead>
        <tbody>
          {releases.map((r) => (
            <tr key={r.id}>
              <td data-label="Version">
                v{r.version} {r.isLatest && <span className="tag active">latest</span>}
              </td>
              <td data-label="Changelog">{r.changelog}</td>
              <td data-label="Released">{new Date(r.releasedAt).toLocaleDateString()}</td>
              <td data-label="Size">
                {r.fileSize ? `${(r.fileSize / 1024 / 1024).toFixed(1)} MB` : '—'}
              </td>
            </tr>
          ))}
          {releases.length === 0 && (
            <tr>
              <td data-label="" colSpan={4} style={{ color: 'var(--ink-faint)' }}>
                No releases published yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
