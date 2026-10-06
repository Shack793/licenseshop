import Link from 'next/link';

export default function Home() {
  const price = process.env.PRODUCT_PRICE_USD ?? '19.99';
  const trialDays = process.env.TRIAL_DAYS ?? '3';

  return (
    <div>
      <nav className="nav">
        <div className="wordmark">
          <span className="suit">♠</span> Hi-Opt II Counter
        </div>
        <div className="nav-links">
          <a href="/app">Open app</a>
          <Link href="/license">Check a key</Link>
          <Link href="/checkout">Buy</Link>
        </div>
      </nav>

      <div className="hero">
        <div>
          <h1>Play your own hand, every hand.</h1>
          <p>
            License your bot for practice tables, home games, and simulator play — one purchase,
            no subscription, updates included. No account needed, just your key.
          </p>
          <div className="hero-actions">
            <Link href="/trial" className="btn">
              Get a {trialDays}-day trial key
            </Link>
            <Link href="/license" className="btn-ghost">
              I already have a key
            </Link>
          </div>
        </div>
        <div className="card-fan-wrap">
          <svg viewBox="0 0 320 260" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: 'auto' }}>
            <g transform="translate(160,190) rotate(-16)">
              <rect x="-58" y="-95" width="116" height="160" rx="8" fill="#12261c" stroke="#2a4438" strokeWidth="1.5" />
              <text x="-38" y="-58" fontFamily="Fraunces, serif" fontSize="26" fill="#a8493f">♥</text>
            </g>
            <g transform="translate(160,190) rotate(0)">
              <rect x="-58" y="-100" width="116" height="170" rx="8" fill="#16302b" stroke="#c9a24d" strokeWidth="1.5" />
              <text x="-38" y="-62" fontFamily="Fraunces, serif" fontSize="28" fill="#c9a24d">♠</text>
            </g>
            <g transform="translate(160,190) rotate(16)">
              <rect x="-58" y="-95" width="116" height="160" rx="8" fill="#12261c" stroke="#2a4438" strokeWidth="1.5" />
              <text x="-38" y="-58" fontFamily="Fraunces, serif" fontSize="26" fill="#f1ead9">♦</text>
            </g>
          </svg>
        </div>
      </div>

      <div className="wrap">
        <div className="section">
          <div className="section-head">
            <h2>What's included</h2>
          </div>
          <div className="ledger-row">
            <div className="label">Lifetime license</div>
            <div className="desc">Pay once, keep every future version — no recurring charge.</div>
          </div>
          <div className="ledger-row">
            <div className="label">{trialDays}-day trial</div>
            <div className="desc">Full functionality, no purchase required to start.</div>
          </div>
          <div className="ledger-row">
            <div className="label">Two devices</div>
            <div className="desc">Activate your key on a primary and backup machine.</div>
          </div>
          <div className="ledger-row">
            <div className="label">Crypto checkout</div>
            <div className="desc">Pay with USDT or USDC stablecoins — no price swings.</div>
          </div>
        </div>

        <div className="section">
          <div className="price-row">
            <div>
              <h2 style={{ fontSize: '1.1rem', marginBottom: '0.2rem' }}>License</h2>
              <span className="fine-print">One-time purchase</span>
            </div>
            <div className="amount">
              ${price}
              <small>one-time</small>
            </div>
          </div>
          <div style={{ marginTop: '1.5rem' }}>
            <Link href="/checkout" className="btn">
              Buy a license
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
