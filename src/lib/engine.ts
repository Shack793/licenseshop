/**
 * Hi-Opt II playing-decision engine — runs ONLY on the server.
 *
 * This is the part of the bot that is worth protecting: the basic-strategy
 * baseline and the Hi-Opt II index tables. It used to live inside the
 * downloadable HTML file, where anyone could copy it and cut out the
 * license check. Now the browser sends the situation (player cards,
 * dealer upcard, true count) to /api/engine/decide, which only answers
 * after re-checking the license, so an expired or revoked key stops
 * getting decisions immediately.
 *
 * Ported 1:1 from the original hiopt2_latest.html logic (6-deck, S17,
 * DAS, late surrender, no resplit). The parity script in
 * scripts/engine-parity.ts compares this against the original over a
 * large grid of inputs.
 */

export type Action = 'HIT' | 'STAND' | 'DOUBLE' | 'SPLIT' | 'SURRENDER';

export interface Rules {
  soft17: 'STAND' | 'HIT';
  das: 'YES' | 'NO';
  surrender: 'LATE' | 'NONE';
}

export const DEFAULT_RULES: Rules = { soft17: 'STAND', das: 'YES', surrender: 'LATE' };

export const VALID_RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'] as const;

function rankValue(r: string): number {
  return ['T', 'J', 'Q', 'K'].includes(r) ? 10 : r === 'A' ? 11 : Number(r);
}

function handValue(cards: string[]): number {
  let total = 0;
  let aces = 0;
  for (const r of cards) {
    total += rankValue(r);
    if (r === 'A') aces++;
  }
  while (total > 21 && aces > 0) {
    total -= 10;
    aces--;
  }
  return total;
}

function isSoft(cards: string[]): boolean {
  let total = 0;
  let aces = 0;
  for (const r of cards) {
    total += rankValue(r);
    if (r === 'A') aces++;
  }
  while (total > 21 && aces > 0) {
    total -= 10;
    aces--;
  }
  return aces > 0 && total <= 21 && cards.some((r) => r === 'A');
}

// Column order for every table below: dealer upcard 2,3,4,5,6,7,8,9,T,A.
const HI2_U = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'A'];

const HI2_HST: Record<number, number[]> = {
  12: [5, 2, 0, -2, -1, 99, 99, 99, 99, 99],
  13: [-1, -3, -5, -7, -7, 99, 99, 99, 99, 99],
  14: [-5, -7, -9, -11, -11, 25, 25, 23, 13, 19],
  15: [-10, -11, -13, -15, -16, 19, 18, 14, 6, 16],
  16: [-13, -15, -17, -20, -19, 13, 11, 6, 0, 13],
  17: [-99, -99, -99, -99, -99, -99, -99, -99, -99, -10],
};
const HI2_HDT: Record<number, number[]> = {
  7: [99, 25, 22, 19, 19, 99, 99, 99, 99, 99],
  8: [25, 17, 12, 8, 5, 99, 99, 99, 99, 99],
  9: [2, -1, -4, -7, -10, 8, 17, 99, 99, 99],
  10: [-14, -16, -17, -19, -22, -11, -8, -2, 14, 8],
  11: [-17, -18, -19, -22, -22, -13, -11, -7, -6, 2],
};
const HI2_SDT: Record<string, number[]> = {
  'A,2': [22, 14, 8, 1, -2, 99, 99, 99, 99, 99],
  'A,3': [25, 14, 7, -2, -6, 99, 99, 99, 99, 99],
  'A,4': [23, 13, 1, -5, -10, 99, 99, 99, 99, 99],
  'A,5': [23, 11, -2, -9, -15, 99, 99, 99, 99, 99],
  'A,6': [8, -4, -8, -13, -18, 99, 99, 99, 99, 99],
  'A,7': [1, -2, -7, -10, -10, 99, 99, 99, 99, 99],
  'A,8': [14, 10, 7, 4, 2, 99, 99, 99, 99, 99],
  'A,9': [18, 15, 12, 10, 9, 99, 99, 99, 99, 99],
  'A,T': [23, 19, 16, 14, 12, 99, 99, 99, 99, 99],
};
const HI2_SPT: Record<string, number[]> = {
  '2,2': [-6, -9, -12, -15, -21, -99, 22, 99, 99, 99],
  '3,3': [0, -12, -14, -21, -99, 99, 99, 99, 99, 99],
  '4,4': [99, 16, 9, 0, -2, 99, 99, 99, 99, 99],
  '5,5': [99, 99, 99, 99, 99, 99, 99, 99, 99, 99],
  '6,6': [-3, -6, -9, -13, -17, 99, 99, 99, 99, 99],
  '7,7': [-14, -16, -17, -20, -99, -99, 21, 99, 99, 99],
  '9,9': [-5, -7, -9, -11, -11, 9, -15, -19, 99, 8],
  'T,T': [18, 15, 12, 9, 8, 99, 99, 99, 99, 99],
  'A,A': [-17, -18, -18, -20, -21, -14, -12, -11, -12, -6],
};

function applyThreshold(
  base: Action,
  tc: number,
  idx: number,
  action: Action,
  belowAction: Action | null = null
): Action {
  if (idx === 99) return base;
  if (idx === -99) return action;
  if (idx < 0) return tc < idx ? (belowAction ?? base) : action;
  return tc >= idx ? action : (belowAction ?? base);
}

/** Baseline multi-deck basic strategy (no count-based deviations). */
export function basicStrategy(player: string[], dealerUp: string, rules: Rules = DEFAULT_RULES): Action {
  const cards = player.slice();
  const total = handValue(cards);
  const pair = cards.length === 2 && cards[0] === cards[1];
  const soft = isSoft(cards);
  const canDouble = cards.length === 2;
  const canSplit = pair;
  const das = rules.das === 'YES';
  const surrender = rules.surrender === 'LATE';

  if (surrender && canDouble && !canSplit) {
    if (total === 16 && ['9', 'T', 'J', 'Q', 'K', 'A'].includes(dealerUp)) return 'SURRENDER';
    if (total === 15 && ['T', 'J', 'Q', 'K'].includes(dealerUp)) return 'SURRENDER';
  }

  if (canSplit) {
    const r = cards[0];
    if (r === 'A' || r === '8') return 'SPLIT';
    if (r === '10' || ['T', 'J', 'Q', 'K'].includes(r)) return 'STAND';
    if (r === '9') return ['2', '3', '4', '5', '6', '8', '9'].includes(dealerUp) ? 'SPLIT' : 'STAND';
    if (r === '7') return ['2', '3', '4', '5', '6', '7'].includes(dealerUp) ? 'SPLIT' : 'HIT';
    if (r === '6') return ['2', '3', '4', '5', '6'].includes(dealerUp) ? 'SPLIT' : 'HIT';
    if (r === '5') return ['2', '3', '4', '5', '6', '7', '8', '9'].includes(dealerUp) ? 'DOUBLE' : 'HIT';
    if (r === '4') return das && ['5', '6'].includes(dealerUp) ? 'SPLIT' : 'HIT';
    if (r === '3' || r === '2') return ['2', '3', '4', '5', '6', '7'].includes(dealerUp) ? 'SPLIT' : 'HIT';
  }

  if (soft && cards.length >= 2) {
    if (total >= 19) return 'STAND';
    if (total === 18) {
      if (['2', '3', '4', '5', '6'].includes(dealerUp)) return canDouble ? 'DOUBLE' : 'STAND';
      if (dealerUp === '7' || dealerUp === '8') return 'STAND';
      return 'HIT';
    }
    if (total === 17) return ['3', '4', '5', '6'].includes(dealerUp) && canDouble ? 'DOUBLE' : 'HIT';
    if (total === 16 || total === 15) return ['4', '5', '6'].includes(dealerUp) && canDouble ? 'DOUBLE' : 'HIT';
    if (total === 14 || total === 13) return ['5', '6'].includes(dealerUp) && canDouble ? 'DOUBLE' : 'HIT';
  }

  if (total >= 17) return 'STAND';
  if (total >= 13 && total <= 16) return ['2', '3', '4', '5', '6'].includes(dealerUp) ? 'STAND' : 'HIT';
  if (total === 12) return ['4', '5', '6'].includes(dealerUp) ? 'STAND' : 'HIT';
  if (total === 11) return canDouble && dealerUp !== 'A' ? 'DOUBLE' : 'HIT';
  if (total === 10) return canDouble && ['2', '3', '4', '5', '6', '7', '8', '9'].includes(dealerUp) ? 'DOUBLE' : 'HIT';
  if (total === 9) return canDouble && ['3', '4', '5', '6'].includes(dealerUp) ? 'DOUBLE' : 'HIT';
  return 'HIT';
}

/** Hi-Opt II index-adjusted decision at a given playing true count. */
export function hiOptIndexAction(
  player: string[],
  dealerUp: string,
  tc: number,
  splitOccurred = false,
  rules: Rules = DEFAULT_RULES
): Action {
  const total = handValue(player);
  const soft = isSoft(player);
  const pair = player.length === 2 && player[0] === player[1];
  const canDouble = player.length === 2;
  const base = basicStrategy(player, dealerUp, rules);

  // Surrender is a baseline action here; count deviations never replace it.
  if (base === 'SURRENDER') return 'SURRENDER';

  // One split only: after a split, a paired hand falls through to the
  // non-pair strategy instead of recommending an unavailable SPLIT.
  if (pair && splitOccurred) {
    const t = total;
    if (soft) {
      if (t >= 19) return 'STAND';
      if (t === 18) {
        if (['2', '3', '4', '5', '6'].includes(dealerUp)) return canDouble ? 'DOUBLE' : 'STAND';
        if (dealerUp === '7' || dealerUp === '8') return 'STAND';
        return 'HIT';
      }
      if (t === 17) return ['3', '4', '5', '6'].includes(dealerUp) && canDouble ? 'DOUBLE' : 'HIT';
      if (t === 16 || t === 15) return ['4', '5', '6'].includes(dealerUp) && canDouble ? 'DOUBLE' : 'HIT';
      if (t === 14 || t === 13) return ['5', '6'].includes(dealerUp) && canDouble ? 'DOUBLE' : 'HIT';
      return 'HIT';
    }
    if (t >= 17) return 'STAND';
    if (t >= 13 && t <= 16) return ['2', '3', '4', '5', '6'].includes(dealerUp) ? 'STAND' : 'HIT';
    if (t === 12) return ['4', '5', '6'].includes(dealerUp) ? 'STAND' : 'HIT';
    if (t === 11) return canDouble && dealerUp !== 'A' ? 'DOUBLE' : 'HIT';
    if (t === 10) return canDouble && ['2', '3', '4', '5', '6', '7', '8', '9'].includes(dealerUp) ? 'DOUBLE' : 'HIT';
    if (t === 9) return canDouble && ['3', '4', '5', '6'].includes(dealerUp) ? 'DOUBLE' : 'HIT';
    return 'HIT';
  }

  if (pair && !splitOccurred) {
    const key = player[0] === 'J' || player[0] === 'Q' || player[0] === 'K' ? 'T,T' : player[0] + ',' + player[0];
    if (HI2_SPT[key] && key !== '5,5') {
      const idx = HI2_SPT[key][HI2_U.indexOf(dealerUp)];
      return applyThreshold(base, tc, idx, 'SPLIT');
    }
    // Pairs without a pair index keep the baseline pair action (e.g. 8,8).
    if (base === 'SPLIT') return 'SPLIT';
  }

  if (soft) {
    const r = player[0] === 'A' ? player[1] : player[0];
    const key =
      player.length === 2 && r && ['2', '3', '4', '5', '6', '7', '8', '9', 'T'].includes(r) ? 'A,' + r : null;
    if (key && HI2_SDT[key] && canDouble) {
      const idx = HI2_SDT[key][HI2_U.indexOf(dealerUp)];
      if (idx !== 99 && (idx === -99 || tc >= idx)) return 'DOUBLE';
      return base;
    }
  }
  if (!soft && total >= 12 && total <= 17) {
    const row = HI2_HST[total];
    if (row) return applyThreshold(base, tc, row[HI2_U.indexOf(dealerUp)], 'STAND', 'HIT');
  }
  if (!soft && total >= 7 && total <= 11 && canDouble) {
    const row = HI2_HDT[total];
    if (row) return applyThreshold(base, tc, row[HI2_U.indexOf(dealerUp)], 'DOUBLE', 'HIT');
  }
  return base;
}
