'use client';

import { useEffect, useMemo, useState } from 'react';

interface Meta {
  kind: string;
  label: string;
  when: string;
  placeholders: string[];
  required: string[];
}
interface Tpl {
  subject: string;
  body: string;
  isCustom?: boolean;
}
interface SmtpForm {
  host: string;
  port: string;
  secure: boolean;
  user: string;
  password: string;
  fromEmail: string;
  fromName: string;
  replyTo: string;
}

export default function AdminEmailPage() {
  const [loaded, setLoaded] = useState(false);
  const [smtp, setSmtp] = useState<SmtpForm>({
    host: '', port: '465', secure: true, user: '', password: '', fromEmail: '', fromName: '', replyTo: '',
  });
  const [passwordSet, setPasswordSet] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [templates, setTemplates] = useState<Record<string, Tpl>>({});
  const [defaults, setDefaults] = useState<Record<string, Tpl>>({});
  const [meta, setMeta] = useState<Meta[]>([]);
  const [help, setHelp] = useState<Record<string, string>>({});
  const [active, setActive] = useState('trial_verify');
  const [testTo, setTestTo] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState('');

  async function load() {
    const res = await fetch('/api/admin/email');
    const d = await res.json();
    setSmtp({
      host: d.smtp.host, port: String(d.smtp.port), secure: d.smtp.secure, user: d.smtp.user,
      password: '', fromEmail: d.smtp.fromEmail, fromName: d.smtp.fromName, replyTo: d.smtp.replyTo,
    });
    setPasswordSet(d.smtp.passwordSet);
    setPasswordError(d.smtp.passwordError);
    setTemplates(d.templates);
    setDefaults(d.defaults);
    setMeta(d.meta);
    setHelp(d.placeholderHelp);
    setLoaded(true);
  }
  useEffect(() => { load(); }, []);

  const current = meta.find((m) => m.kind === active);
  const tpl = templates[active];
  const isDefault = useMemo(
    () => !!tpl && !!defaults[active] && tpl.subject === defaults[active].subject && tpl.body === defaults[active].body,
    [tpl, defaults, active]
  );

  function smtpPayload() {
    return {
      host: smtp.host, port: Number(smtp.port), secure: smtp.secure, user: smtp.user,
      password: smtp.password, fromEmail: smtp.fromEmail, fromName: smtp.fromName, replyTo: smtp.replyTo,
    };
  }

  function setTpl(patch: Partial<Tpl>) {
    setTemplates((t) => ({ ...t, [active]: { ...t[active], ...patch } }));
  }

  function insert(name: string) {
    const el = document.getElementById('tpl-body') as HTMLTextAreaElement | null;
    const token = `{{${name}}}`;
    if (!el) return setTpl({ body: tpl.body + token });
    const s = el.selectionStart ?? tpl.body.length;
    const e = el.selectionEnd ?? s;
    setTpl({ body: tpl.body.slice(0, s) + token + tpl.body.slice(e) });
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(s + token.length, s + token.length); });
  }

  async function save() {
    setBusy('save'); setMsg(null);
    const res = await fetch('/api/admin/email', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        smtp: smtpPayload(),
        templates: Object.fromEntries(Object.entries(templates).map(([k, v]) => [k, { subject: v.subject, body: v.body }])),
      }),
    });
    const d = await res.json();
    setBusy('');
    if (!res.ok) return setMsg({ ok: false, text: d.error || 'Could not save' });
    setMsg({ ok: true, text: 'Saved. New emails use these settings straight away.' });
    await load();
  }

  async function sendTest(withTemplate: boolean) {
    setBusy(withTemplate ? 'test-tpl' : 'test'); setMsg(null);
    const res = await fetch('/api/admin/email/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: testTo,
        smtp: smtpPayload(),
        template: withTemplate ? { kind: active, subject: tpl.subject, body: tpl.body } : undefined,
      }),
    });
    const d = await res.json();
    setBusy('');
    setMsg(res.ok ? { ok: true, text: `Test email sent to ${testTo}. Check the inbox (and spam).` } : { ok: false, text: `Send failed: ${d.error}` });
  }

  if (!loaded) return <div className="admin-wrap"><p className="fine-print">Loading…</p></div>;

  return (
    <div className="admin-wrap">
      <h2>Email</h2>
      <p className="fine-print" style={{ marginBottom: '1.5rem' }}>
        Connection settings and wording for the emails customers receive. Anything left blank here falls
        back to the server&apos;s environment settings.
      </p>

      <div className="admin-panel">
        <h3 style={{ marginBottom: '1rem' }}>SMTP settings</h3>
        {passwordError && <div className="error-text" style={{ margin: '0 0 1rem' }}>{passwordError}</div>}
        <div className="form-grid">
          <div><label>SMTP host</label><input value={smtp.host} onChange={(e) => setSmtp({ ...smtp, host: e.target.value })} placeholder="mail.blackjack.us" /></div>
          <div><label>Port</label><input value={smtp.port} inputMode="numeric" onChange={(e) => setSmtp({ ...smtp, port: e.target.value })} placeholder="465" /></div>
          <div><label>Username</label><input value={smtp.user} autoComplete="off" onChange={(e) => setSmtp({ ...smtp, user: e.target.value })} placeholder="licenses@blackjack.us" /></div>
          <div>
            <label>Password {passwordSet && <span className="fine-print">(saved — leave blank to keep)</span>}</label>
            <input type="password" autoComplete="new-password" value={smtp.password} onChange={(e) => setSmtp({ ...smtp, password: e.target.value })} placeholder={passwordSet ? '••••••••' : 'mailbox password'} />
          </div>
          <div><label>From address</label><input value={smtp.fromEmail} onChange={(e) => setSmtp({ ...smtp, fromEmail: e.target.value })} placeholder="licenses@blackjack.us" /></div>
          <div><label>From name (optional)</label><input value={smtp.fromName} onChange={(e) => setSmtp({ ...smtp, fromName: e.target.value })} placeholder="Hi-Opt II Counter" /></div>
          <div><label>Reply-to (optional)</label><input value={smtp.replyTo} onChange={(e) => setSmtp({ ...smtp, replyTo: e.target.value })} placeholder="support@blackjack.us" /></div>
          <div>
            <label>Encryption</label>
            <select value={smtp.secure ? 'ssl' : 'starttls'} onChange={(e) => setSmtp({ ...smtp, secure: e.target.value === 'ssl' })}>
              <option value="ssl">SSL/TLS (port 465)</option>
              <option value="starttls">STARTTLS / none (port 587 or 25)</option>
            </select>
          </div>
        </div>
        <p className="fine-print">The password is stored encrypted and is never shown again after saving.</p>
      </div>

      <div className="admin-panel">
        <h3 style={{ marginBottom: '1rem' }}>Email wording</h3>
        <div className="tpl-tabs">
          {meta.map((m) => (
            <button key={m.kind} type="button" className={m.kind === active ? 'btn btn-sm' : 'btn-ghost btn-sm'} onClick={() => setActive(m.kind)}>
              {m.label}
            </button>
          ))}
        </div>
        {current && tpl && (
          <div style={{ marginTop: '1.2rem' }}>
            <p className="fine-print" style={{ marginBottom: '1rem' }}>
              {current.when} {tpl.isCustom || !isDefault ? '' : '(Using the built-in wording.)'}
            </p>
            <label>Subject</label>
            <input value={tpl.subject} onChange={(e) => setTpl({ subject: e.target.value })} />
            <label>Message (plain text)</label>
            <textarea id="tpl-body" rows={10} value={tpl.body} onChange={(e) => setTpl({ body: e.target.value })} />
            <div className="chips">
              <span className="fine-print">Insert:</span>
              {current.placeholders.map((p) => (
                <button key={p} type="button" className="chip" title={help[p]} onClick={() => insert(p)}>
                  {`{{${p}}}`}{current.required.includes(p) ? ' *' : ''}
                </button>
              ))}
            </div>
            <p className="fine-print" style={{ margin: '0.6rem 0 1rem' }}>
              * required. Placeholders are filled in for each customer when the email is sent.
            </p>
            <button type="button" className="btn-ghost btn-sm" disabled={isDefault} onClick={() => setTpl({ subject: defaults[active].subject, body: defaults[active].body })}>
              Reset this email to default
            </button>
          </div>
        )}
      </div>

      <div className="admin-panel">
        <h3 style={{ marginBottom: '1rem' }}>Send a test</h3>
        <label>Send to</label>
        <input type="email" value={testTo} onChange={(e) => setTestTo(e.target.value)} placeholder="you@example.com" />
        <div className="tpl-tabs">
          <button type="button" className="btn-ghost btn-sm" disabled={!testTo || !!busy} onClick={() => sendTest(false)}>
            {busy === 'test' ? 'Sending…' : 'Test SMTP connection'}
          </button>
          <button type="button" className="btn-ghost btn-sm" disabled={!testTo || !!busy} onClick={() => sendTest(true)}>
            {busy === 'test-tpl' ? 'Sending…' : `Send “${current?.label ?? ''}” with sample data`}
          </button>
        </div>
        <p className="fine-print" style={{ marginTop: '0.8rem' }}>Uses the values currently in this form, even if not saved yet.</p>
      </div>

      {msg && <div className={msg.ok ? 'success-text' : 'error-text'} style={{ margin: '0 0 1rem' }}>{msg.text}</div>}
      <button className="btn" type="button" disabled={!!busy} onClick={save}>
        {busy === 'save' ? 'Saving…' : 'Save email settings'}
      </button>
    </div>
  );
}
