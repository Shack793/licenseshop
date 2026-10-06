/**
 * Parity check: runs the ORIGINAL in-browser engine (extracted from your
 * hiopt2_latest.html) and the new server engine (src/lib/engine.ts) over a
 * large grid of situations, and fails if any answer differs.
 *
 * Usage:
 *   npx tsx scripts/engine-parity.ts path/to/hiopt2_latest.html
 *
 * The original HTML is NOT shipped in this repo (it's your source file),
 * so you have to point this at your copy.
 */
import fs from 'fs';
import vm from 'vm';
import { basicStrategy, hiOptIndexAction, VALID_RANKS, type Rules } from '../src/lib/engine';

const htmlPath = process.argv[2];
if (!htmlPath) {
  console.error('Usage: npx tsx scripts/engine-parity.ts path/to/hiopt2_latest.html');
  process.exit(1);
}

const html = fs.readFileSync(htmlPath, 'utf8');
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
// The second <script> is the engine IIFE (the first is the UI glue).
const engineSrc = scripts.find((s) => s.includes('const HI2_HST')) as string;
if (!engineSrc) throw new Error('Could not find the engine script in the HTML file');

// Minimal DOM stub: every element is a bag of properties, and the three
// <select> controls basicStrategy reads are configurable per test case.
const selectValues: Record<string, string> = {
  strategySoft17: 'STAND',
  strategyDAS: 'YES',
  strategySurrender: 'LATE',
};
function makeEl(id: string): any {
  const el: any = {
    textContent: '',
    innerHTML: '',
    style: {},
    disabled: false,
    classList: { add() {}, remove() {} },
    appendChild() {},
    addEventListener() {},
    set value(v: string) {
      selectValues[id] = v;
    },
    get value() {
      return id in selectValues ? selectValues[id] : '';
    },
  };
  return el;
}
const els: Record<string, any> = {};
const doc: any = {
  getElementById: (id: string) => (els[id] ||= makeEl(id)),
  createElement: () => makeEl('_new'),
  querySelectorAll: () => [],
  readyState: 'complete',
  addEventListener() {},
};
const sandbox: any = { document: doc, console, Math, Number, String, Array, Object, Error, Promise, setTimeout, setInterval: () => 0 };
sandbox.window = sandbox;
vm.createContext(sandbox);
vm.runInContext(engineSrc, sandbox);

const orig = sandbox.window;
if (typeof orig.hiOptIndexAction !== 'function' || typeof orig.__test31?.setState !== 'function') {
  throw new Error('Original engine did not expose the expected functions');
}

// All two-card hands, plus a spread of 3–5 card hands, for every dealer upcard.
const ranks = [...VALID_RANKS] as string[];
const dealers = ranks;
const hands: string[][] = [];
for (const a of ranks) for (const b of ranks) hands.push([a, b]);
const extra = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'A'];
for (const a of extra) for (const b of extra) for (const c of extra) hands.push([a, b, c]);
for (const a of ['2', '3', 'A', '5']) for (const b of ['2', 'A', '4']) for (const c of ['3', '2', '5']) for (const d of ['2', '6', 'A']) hands.push([a, b, c, d]);

const tcs: number[] = [];
for (let t = -25; t <= 25; t += 0.5) tcs.push(t);

const ruleSets: Rules[] = [
  { soft17: 'STAND', das: 'YES', surrender: 'LATE' },
  { soft17: 'HIT', das: 'NO', surrender: 'NONE' },
  { soft17: 'STAND', das: 'NO', surrender: 'LATE' },
  { soft17: 'HIT', das: 'YES', surrender: 'NONE' },
];

let checked = 0;
let mismatches = 0;
const examples: string[] = [];

for (const rules of ruleSets) {
  selectValues.strategySoft17 = rules.soft17;
  selectValues.strategyDAS = rules.das;
  selectValues.strategySurrender = rules.surrender;
  for (const splitOccurred of [false, true]) {
    orig.__test31.setState({ splitOccurred });
    for (const player of hands) {
      for (const dealer of dealers) {
        const b1 = orig.basicStrategy(player.slice(), dealer);
        const b2 = basicStrategy(player, dealer, rules);
        checked++;
        if (b1 !== b2) {
          mismatches++;
          if (examples.length < 10) examples.push(`basic ${player.join(',')} vs ${dealer} ${JSON.stringify(rules)}: orig=${b1} new=${b2}`);
        }
        for (const tc of tcs) {
          const a1 = orig.hiOptIndexAction(player.slice(), dealer, tc);
          const a2 = hiOptIndexAction(player, dealer, tc, splitOccurred, rules);
          // The hosted app sends floor(tc) (every index threshold is a whole
          // number, so the answer is identical) to keep calls to a minimum.
          const a3 = hiOptIndexAction(player, dealer, Math.floor(tc), splitOccurred, rules);
          checked++;
          if (a2 !== a3) {
            mismatches++;
            if (examples.length < 10) examples.push(`floor(tc) changed the answer: ${player.join(',')} vs ${dealer} tc=${tc}: ${a2} vs ${a3}`);
          }
          if (a1 !== a2) {
            mismatches++;
            if (examples.length < 10)
              examples.push(`hi2 ${player.join(',')} vs ${dealer} tc=${tc} split=${splitOccurred} ${JSON.stringify(rules)}: orig=${a1} new=${a2}`);
          }
        }
      }
    }
  }
}

console.log(`Checked ${checked.toLocaleString()} situations. Mismatches: ${mismatches}`);
if (mismatches) {
  console.log(examples.join('\n'));
  process.exit(1);
}
console.log('PARITY OK');
