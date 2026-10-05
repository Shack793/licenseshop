import Link from 'next/link';

const MESSAGES: Record<string, { heading: string; body: string }> = {
  ok: {
    heading: 'Key resent',
    body: 'Check your inbox — your existing license key(s) have been resent.',
  },
  none: {
    heading: 'No licenses found',
    body: "We didn't find any license on file for that email. Check your inbox for the key it was originally sent to, or start a free trial.",
  },
  all_expired: {
    heading: 'Your license has expired',
    body: 'Every license on file for that email has expired. Buy a perpetual license to keep going.',
  },
  expired: {
    heading: 'Link expired',
    body: 'That confirmation link is more than 30 minutes old. Request a new one.',
  },
  already_used: {
    heading: 'Link already used',
    body: 'That confirmation link has already been used.',
  },
  invalid: {
    heading: 'Invalid link',
    body: "That link isn't valid. Request a new one.",
  },
  not_found: {
    heading: 'Invalid link',
    body: "That link isn't valid. Request a new one.",
  },
};

export default function ResendSentPage({ searchParams }: { searchParams: { status?: string } }) {
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
        <Link href="/license/forgot" className="btn-ghost">
          Try again
        </Link>
      </div>
    </div>
  );
}
