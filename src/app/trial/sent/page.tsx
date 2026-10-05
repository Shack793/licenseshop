import Link from 'next/link';

const MESSAGES: Record<string, { heading: string; body: string }> = {
  ok: {
    heading: 'Trial key sent',
    body: "Check your inbox — your license key is on its way. Keep that email; there's no account to log back into.",
  },
  expired: {
    heading: 'Link expired',
    body: 'That confirmation link is more than 30 minutes old. Request a new trial key to get a fresh one.',
  },
  already_used: {
    heading: 'Link already used',
    body: 'That confirmation link has already been used. If you already have a trial key, check your inbox — or check its status below.',
  },
  invalid: {
    heading: 'Invalid link',
    body: "That link isn't valid. Request a new trial key to get a fresh one.",
  },
  not_found: {
    heading: 'Invalid link',
    body: "That link isn't valid. Request a new trial key to get a fresh one.",
  },
};

export default function TrialSentPage({ searchParams }: { searchParams: { status?: string } }) {
  const status = searchParams.status ?? 'ok';
  const msg = MESSAGES[status] ?? MESSAGES.invalid;

  return (
    <div className="auth-shell">
      <h2>{msg.heading}</h2>
      <p className="lede">{msg.body}</p>
      <div className="hero-actions">
        <Link href="/license" className="btn">
          Check your license
        </Link>
        <Link href="/trial" className="btn-ghost">
          Request another
        </Link>
      </div>
    </div>
  );
}
