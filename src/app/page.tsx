import Link from 'next/link';

export default function Home() {
  const price = process.env.PRODUCT_PRICE_USD ?? '19.99';
  const trialDays = process.env.TRIAL_DAYS ?? '3';

  return (
    <div>
      <nav className="nav">
        <div className="wordmark">
          <img src="/logo.svg" alt="" width={26} height={26} className="logo-mark" /> Hi-Opt II Counter
        </div>
        <div className="nav-links">
          <a href="/app">Open app</a>
          <Link href="/license">Check a key</Link>
          <a href="#how-it-works">How it works</a>
        </div>
      </nav>

      <div className="hero hero-wide" style={{ gridTemplateColumns: '1fr' }}>
        <div>
          <div className="eyebrow">Hi-Opt II Blackjack Trainer &amp; Table Assistant</div>
          <h1>Practice Hi-Opt II accurately. Know the right play every hand.</h1>
          <p>
            Track the shoe in real time, keep the running and true count, and get the correct
            Hi-Opt II playing decision for every hand — in your browser, nothing to install.
            For practice, home games and simulation.
          </p>
          <p className="trial-line">{trialDays}-day full-featured trial. No account required.</p>
          <p className="price-line">${price} — lifetime license</p>
          <div className="hero-actions">
            <Link href="/trial" className="btn">
              Start free {trialDays}-day trial
            </Link>
            <Link href="/checkout" className="btn-ghost">
              Buy for ${price}
            </Link>
          </div>
          <div className="hero-tags">
            <span>Ace side count</span>
            <span>Real-time running &amp; true count</span>
            <span>Strategy decisions</span>
            <span>Training &amp; simulation</span>
            <span>Browser-based</span>
          </div>
        </div>
      </div>

      <div className="shot-wrap">
        <img
          src="/app-screenshot.png"
          alt="Hi-Opt II Counter table assistant showing running count, true count, aces remaining and the recommended play"
          width={1160}
          height={490}
        />
        <div className="shot-caption">
          <strong>Table Assistant</strong>
          <span>Track the shoe, running count, true count, ace side count and playing decisions from one screen.</span>
        </div>
      </div>

      <div className="wrap">
        <div className="section">
          <div className="section-head">
            <h2>Built specifically for Hi-Opt II</h2>
          </div>
          <ul className="check-list">
            <li>6-deck shoe with penetration tracking</li>
            <li>Running count + true count</li>
            <li>Separate ace side count</li>
            <li>Hi-Opt II index deviations</li>
            <li>S17 and late-surrender rules</li>
            <li>Shoe simulation + training mode</li>
            <li>Decision engine verified against the reference implementation across 13.5 million hand situations</li>
          </ul>
        </div>

        <div className="section" id="how-it-works">
          <div className="section-head">
            <h2>Why Hi-Opt II?</h2>
          </div>
          <p className="why-copy">
            Hi-Opt II isn&apos;t Hi-Lo with different card values. It&apos;s a balanced, multi-level count
            with a separate ace side count and index deviations that have to be applied correctly.
            This tool does the bookkeeping so you can practise the system itself.
          </p>
          <div className="count-grid">
            <div><span className="cnt">+1</span><span>2 · 3 · 6 · 7</span></div>
            <div><span className="cnt">+2</span><span>4 · 5</span></div>
            <div><span className="cnt">0</span><span>8 · 9 · A</span></div>
            <div><span className="cnt">−2</span><span>10 · J · Q · K</span></div>
          </div>
          <p className="fine-print" style={{ marginTop: '0.9rem' }}>
            Aces are counted separately in the side count and adjust your betting true count.
          </p>
        </div>

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
            <div className="label">No account</div>
            <div className="desc">Just your license key and email — nothing to sign up for.</div>
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
          <p className="fine-print" style={{ marginTop: '1rem' }}>
            Pay with USDT or USDC stablecoins — no price swings. Intended for practice tables, home
            games and simulator play.
          </p>
        </div>
      </div>
    </div>
  );
}
