# Shoepilot Pro — Storefront

Full-stack Next.js app: no customer accounts. Email + license key only.
Crypto checkout (NOWPayments), gated downloads, version history, a 3-day
free trial gated by email verification plus device-fingerprint locking,
DB-backed rate limiting, a password-gated **admin dashboard** for
publishing releases and managing licenses, and a self-service "resend my
key" flow. Mobile-responsive throughout.

This was hand-written (not scaffolded via `create-next-app`) because the
build environment had no network access to npm. You'll need to install
dependencies yourself before running it — see **What I could and couldn't
test here**, below, for exactly what that implies.

## How the no-accounts model works

There's no customer signup/login. Instead:

- **Trial**: visitor enters their email on `/trial` → confirmation link
  (expires in 30 min) → clicking it issues a trial license and emails the
  key.
- **Purchase**: visitor enters their email on `/checkout` → pays via a
  NOWPayments hosted invoice → our webhook (signature-verified) confirms
  payment and emails a perpetual license key.
- **Check status / download**: `/license` — paste in a key, see its
  status, download the latest release. The key is the credential, checked
  fresh against the DB on every request.
- **Lost your key**: `/license/forgot` — enter your email, confirm via a
  link, and we resend whatever key(s) are on file for that address. This
  never issues a *new* trial — it only resends what already exists.

### Stopping repeat free trials

Three layers:
1. **Email verification** before a trial key is ever issued.
2. **Device-fingerprint cross-license locking** (`TrialDeviceLock` in the
   schema, enforced in `src/lib/license.ts`): the first device to activate
   a trial license gets locked to it. Any *other* trial license activating
   on that same device — different email, different key — is rejected
   with `TRIAL_ALREADY_USED_ON_DEVICE`. Enforced in `/api/license/validate`,
   which your bot binary must call on launch with a `deviceHash` (a hash of
   a stable machine fingerprint, computed client-side — never send raw
   hardware IDs).
3. **Disposable-email blocklist** (`src/lib/disposable-email.ts`) on both
   the trial-request and checkout endpoints — a cheap first filter, not a
   complete one.

### Rate limiting

DB-backed (`src/lib/rate-limit.ts`, `RateLimitHit` table) rather than
in-memory, because an in-memory counter doesn't work once Vercel is
running more than one instance of your app. Applied to: trial requests (by
IP and by email), checkout invoice creation (by IP), resend-key requests
(by IP), and admin login attempts (by IP). All throttle rather than hard
block.

## Admin dashboard (`/admin`)

Single shared password, not a second accounts system — see
`src/lib/admin-auth.ts`. Set `ADMIN_PASSWORD` and `ADMIN_SESSION_SECRET` in
your env, then log in at `/admin/login`. From there:

- **`/admin/releases`** — upload a new bot build right in the browser
  (version, changelog, file) instead of running a CLI script. Files are
  stored under `./local-releases/` (below).
- **`/admin/licenses`** — search by email or key, revoke or reactivate any
  license.
- **`/admin/payments`** — see payment history.
- **`/admin`** — totals: licenses, active trials, paid licenses, revenue.

`middleware.ts` gates everything under `/admin` and `/api/admin` — no
valid session cookie, no access, full stop. The CLI script
(`scripts/publish-release.ts`) still works too, for scripting/CI — it writes
to the same `local-releases/` folder.

## Local disk storage (no Cloudflare account needed)

`src/lib/storage.ts` writes release files under `./local-releases/` and
serves them through a short-lived, DB-backed token (`DownloadToken` table)
via `/api/local-download/[token]`. This is the production storage on
Namecheap shared hosting (real persistent disk). Back up `local-releases/`
yourself — no CDN or redundancy. `local-releases/` is gitignored and is
excluded from FTP deploys so uploads never wipe sold files.

## Setup

1. **Install dependencies**
   ```
   npm install
   ```

2. **Copy env file and fill in real values**
   ```
   cp .env.example .env
   ```
   This is set up by default for Namecheap Business hosting end to end — a
   MySQL database and an email mailbox, both from cPanel, no third-party
   accounts needed except the payment processor:
   - **MySQL database** → `DATABASE_URL`. cPanel → MySQL Databases: create
     a database and a user, add the user to the database with "All
     Privileges", then build the connection string (see `.env.example` for
     the exact format — it'll be `localhost` since the app and DB share a
     host).
   - **Email mailbox** → `SMTP_*` + `EMAIL_FROM`. cPanel → Email Accounts:
     create e.g. `licenses@blackjack.us`, then use that mailbox's SMTP
     settings (cPanel's "Connect Devices" page for it shows the exact
     host/port — see `.env.example`).
   - [NOWPayments](https://nowpayments.io) — crypto checkout → `NOWPAYMENTS_API_KEY`, `NOWPAYMENTS_IPN_SECRET`
     (set the IPN secret in NOWPayments dashboard settings, and point your IPN
     callback URL at `https://blackjack.us/api/payments/nowpayments/webhook`)
    - File storage for bot builds → no setup needed on Namecheap; it uses
      local disk (`./local-releases/`) described above.
   - Pick your own `ADMIN_PASSWORD` and generate `ADMIN_SESSION_SECRET` with `openssl rand -base64 32`

   Deploying to Vercel instead? Set `provider = "postgresql"` in
   `prisma/schema.prisma` and use [Neon](https://neon.tech) for
   `DATABASE_URL`. SMTP still works fine from Vercel's functions, but an
   API-based provider like [Resend](https://resend.com) is usually a
   better fit there — shared serverless IPs tend to have worse email
   deliverability than SMTP through your own mailbox's reputation, which
   matters less when the "mailbox" isn't tied to a specific always-on host
   anyway.

3. **Push the schema to your database**
   ```
   npm run db:push
   ```

4. **Run locally**
   ```
   npm run dev
   ```

5. **Deploy**
   The default setup above (MySQL + SMTP mailbox) is built for Namecheap
   Business hosting — see "Deploying to Namecheap Business hosting" below.
   Deploying to Vercel instead takes a bit more setup (Neon for Postgres,
   an API email provider, real R2 credentials) — see the callouts above
   for what to swap.

## Deploying to Namecheap Business hosting (no VPS)

Namecheap's Stellar Business shared-hosting plan includes cPanel's
"Setup Node.js App" (built on Passenger), so this runs there without a
VPS. It's a genuinely different deployment shape from a typical
Node-on-Vercel setup, not just a different button to click — read this
fully before committing to it.

### Why this is the default setup, not an alternate one

- You get one persistent server process with real, persistent disk —
  not serverless. That means the **local-storage fallback in
  `src/lib/storage.ts` is safe to use as real production storage**, so
  there's no Cloudflare R2 to pay for or configure. Just back up
  `local-releases/` yourself — it's your hosting account's disk, not a
  CDN, so there's no redundancy unless you add it.
- **Database is MySQL**, from cPanel's own MySQL Databases tool — no
  external database account needed at all. Namecheap's shared hosting is
  MySQL-oriented and doesn't give you Postgres, so the schema's
  `datasource` provider is set to `mysql` (see the note at the top of
  `prisma/schema.prisma` if you ever move this to Postgres instead).
- **Email goes out over SMTP**, from a free mailbox cPanel gives you on
  your own domain (e.g. `licenses@blackjack.us`) — no third-party email
  service or its own billing.
- NOWPayments is the one piece that's still an external service, since
  crypto checkout has to be — it just needs your domain live with SSL,
  which Namecheap's AutoSSL covers on Business plans.
- Rate limiting, trial device-locking, etc. are all DB-backed already
  (see "Stopping repeat free trials" above), so none of that changes —
  it was built that way specifically so it wouldn't matter whether you
  end up on serverless or a single persistent process.

### Steps

1. **Build locally first.** Run `npm install` then `npm run build` on a
   machine with normal internet access, and confirm it builds clean —
   Namecheap's own deployment guidance warns that a build that works on
   your machine can still fail on a different OS, so don't skip this.
2. **Use the included `server.js`.** cPanel's Node.js Selector needs an
   explicit startup file instead of running `next start` directly.
   `server.js` at the project root just wraps Next's own request handler —
   middleware, API routes, and everything else still run exactly as they
   do under `next start`.
3. **Zip the project**, excluding `node_modules` and `.git` (keep the
   `.next` build output — that's required).
4. **Upload & extract** via cPanel File Manager into its own folder
   *outside* `public_html` — Namecheap doesn't allow a Node.js app to live
   in the main domain's `public_html` directly.
5. **cPanel → Setup Node.js App → Create Application:**
   - Node.js version: 18.17+ (pick 20.x if it's offered — Next.js 14 needs
     at least 18.17)
   - Application mode: Production
   - Application root: the folder you extracted into
   - Application URL: blackjack.us
   - Application startup file: `server.js`
6. **Create the database and mailbox in cPanel** (if you haven't already):
   - **MySQL Databases** → create a database and a user, add the user to
     the database with "All Privileges". Build `DATABASE_URL` from these
     (format in `.env.example`) — use `localhost` as the host.
   - **Email Accounts** → create a mailbox (e.g. `licenses@blackjack.us`),
     then open its "Connect Devices" page for the exact SMTP host/port to
     put in `SMTP_HOST`/`SMTP_PORT`.
7. **Add every variable from `.env.example`** through the Node.js app
   screen's "Environment variables" section — cPanel manages these
   per-app instead of reading a `.env` file directly.
8. Click **Run NPM Install** (this also runs `prisma generate`, via this
   project's `postinstall` script).
9. Open that app's SSH/virtual-environment shell (cPanel gives you one per
   Node app) and run `npx prisma db push` once, to create the schema on
   the database from step 6.
10. Point the NOWPayments IPN callback at
    `https://blackjack.us/api/payments/nowpayments/webhook`, same as before.
11. Start (or restart) the app from the Node.js Selector screen.

### Worth knowing before you commit to this over a VPS

- Shared hosting enforces per-account CPU/memory/process limits. Fine for
  a small storefront; a real traffic spike will get throttled harder than
  it would on a VPS, so keep an eye on it if volume grows.
- Everything in this app that matters (licenses, rate limits, device
  locks, sessions) is already stored in the database, not in memory — so a
  Passenger restart (deploys, crashes, routine cPanel maintenance) never
  loses state, same guarantee as the serverless path.
- If `npx prisma generate` ever fails on the server with a binary/platform
  mismatch, that's Prisma's query-engine binary not matching the host's
  OS — rerun it over SSH rather than trusting whatever ran during
  "Run NPM Install" locally.
- If `npx prisma db push` fails with something like "Specified key was too
  long", your MySQL/MariaDB is old enough to default to the legacy
  767-byte index-length limit. Namecheap's current MySQL versions
  shouldn't hit this, but if you do: shorten the `@db.VarChar(...)` length
  on the composite-indexed columns in `prisma/schema.prisma` (the
  `RateLimitHit` index is the one most likely to be affected), or ask
  Namecheap support to confirm `innodb_large_prefix` is on for your
  database.

## How the bot itself should check licenses

Your bot binary should POST to `/api/license/validate` on launch:

```json
POST https://blackjack.us/api/license/validate
{ "key": "XG7K2-P9QRT-4M2VD-88ZXA", "deviceHash": "sha256-of-a-machine-fingerprint" }
```

Response:
```json
{ "valid": true, "tier": "trial", "expiresAt": "2026-09-25T00:00:00.000Z", "isTrial": true }
```

or `{ "valid": false, "reason": "EXPIRED" }`, `"TRIAL_ALREADY_USED_ON_DEVICE"`,
`"DEVICE_LIMIT_REACHED"`, `"REVOKED"`, `"NOT_FOUND"`. Do this check online
on every launch (or at least periodically) rather than caching it forever
client-side.

## What I could and couldn't test here

The sandbox this was built in has no network access to the npm registry
(every `npm install` is refused at the network level, not something a
retry fixes), so I could not run `next build`, start the real Next.js dev
server, or exercise the actual API routes end to end. Before you treat
this as load-bearing, run it yourself with `npm install && npm run build`
— that's the one check I genuinely could not do from here.

What I *could* validate directly, and did:
- **Every database-level rule** (trial device-lock blocking a second
  device, rate-limit window math, license revoke/reactivate state
  transitions, the resend-key selection logic) — by standing up a real
  local Postgres instance and running the exact query logic against real
  rows, including edge cases (expired trials, revoked licenses, wrong
  secrets). Note: this was validated against Postgres specifically,
  before the schema switched to MySQL for the Namecheap deployment path.
  The query logic goes through Prisma's client either way (not raw SQL),
  so it should behave identically, but it hasn't been re-run against an
  actual MySQL instance — worth a smoke test of the flows above once
  you're pointed at your real cPanel database, not something to treat as
  re-verified.
- **The admin session crypto** (password check, cookie signing/verification,
  tamper and expiry rejection) — by running the actual `admin-auth.ts`
  functions directly in Node.
- **Type/syntax correctness of every file** — via `tsc`, which caught
  real issues during development (fixed before this was packaged).
- **Mobile layout** — by rendering every page (including the new admin
  views) with the real CSS in an actual headless browser at 320px, 375px,
  and 1280px widths, and checking programmatically for horizontal
  overflow. This caught a real bug (the admin tables overflowed on
  narrow screens) which is now fixed and re-verified — the responsive
  table-to-card collapse is confirmed working, not just written.

What's still genuinely unverified: the live integration between Next.js,
Prisma's generated client, and the real external services (NOWPayments,
your SMTP mailbox, MySQL on a real cPanel account, and R2 if you use it
instead of the local-storage fallback) — that only exists once you run
`npm install` somewhere with real network access.

## What's still not built

- Deeper abuse protection beyond what's here (e.g. CAPTCHA) — only worth
  adding if you actually see automated abuse; it's pure friction until then.
- Multi-admin accounts — one shared password is deliberately simple for a
  single-operator storefront; swap `admin-auth.ts` for real accounts if
  you need more than one admin identity later.
