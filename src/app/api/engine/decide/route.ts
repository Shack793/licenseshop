import { NextResponse } from 'next/server';
import { z } from 'zod';
import { authorizeEngineCall } from '@/lib/app-session';
import { basicStrategy, hiOptIndexAction, VALID_RANKS, DEFAULT_RULES } from '@/lib/engine';
export const dynamic = 'force-dynamic';


const rank = z.enum(VALID_RANKS);

const schema = z.object({
  token: z.string(),
  // 'hi2' = Hi-Opt II index-adjusted decision; 'basic' = baseline only.
  mode: z.enum(['hi2', 'basic']).default('hi2'),
  player: z.array(rank).min(1).max(12),
  dealerUp: rank,
  tc: z.number().finite().min(-200).max(200).default(0),
  splitOccurred: z.boolean().default(false),
  rules: z
    .object({
      soft17: z.enum(['STAND', 'HIT']),
      das: z.enum(['YES', 'NO']),
      surrender: z.enum(['LATE', 'NONE']),
    })
    .default(DEFAULT_RULES),
});

// The only place the strategy tables are ever evaluated. Every call
// re-checks the license (see authorizeEngineCall), so an expired trial or a
// revoked key stops getting answers right away.
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, reason: 'BAD_REQUEST' }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, reason: 'BAD_REQUEST' }, { status: 400 });
  }

  const access = await authorizeEngineCall(parsed.data.token);
  if (!access.ok) {
    return NextResponse.json({ ok: false, reason: access.reason }, { status: access.status });
  }

  const { mode, player, dealerUp, tc, splitOccurred, rules } = parsed.data;
  const action =
    mode === 'basic'
      ? basicStrategy(player, dealerUp, rules)
      : hiOptIndexAction(player, dealerUp, tc, splitOccurred, rules);

  return NextResponse.json({ ok: true, action });
}
