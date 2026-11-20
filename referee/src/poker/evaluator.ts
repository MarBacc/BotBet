/**
 * 7-card Hold'em evaluator: best 5 of up to 7 cards. Higher score = better hand; equal score = split.
 * score = category * 15^5 + up to five tie-break ranks (base 15).
 */
import { type Card, rankOf, suitOf } from "./cards.js";

export const CATEGORIES = [
  "high card", "pair", "two pair", "three of a kind", "straight",
  "flush", "full house", "four of a kind", "straight flush",
] as const;
export type Category = (typeof CATEGORIES)[number];

const B = 15;
const pack = (cat: number, ks: number[]): number => {
  let s = cat;
  for (let i = 0; i < 5; i++) s = s * B + (ks[i] ?? 0);
  return s;
};

/** Highest straight top rank in a 13-bit rank mask, or -1. Handles the wheel (A-2-3-4-5 → top 3). */
function straightTop(mask: number): number {
  for (let top = 12; top >= 4; top--) {
    const need = 0b11111 << (top - 4);
    if ((mask & need) === need) return top;
  }
  if ((mask & 0b1000000001111) === 0b1000000001111) return 3;
  return -1;
}

/** Score of the best 5-card hand among 5..7 cards. */
export function evaluate(cards: readonly Card[]): number {
  if (cards.length < 5 || cards.length > 7) throw new Error(`evaluate needs 5-7 cards, got ${cards.length}`);
  const counts = new Array<number>(13).fill(0);
  const suitMasks = [0, 0, 0, 0];
  let mask = 0;
  for (const c of cards) {
    const r = rankOf(c);
    counts[r]!++;
    suitMasks[suitOf(c)]! |= 1 << r;
    mask |= 1 << r;
  }
  // straight flush / flush
  for (const sm of suitMasks) {
    if (popcount(sm) >= 5) {
      const sf = straightTop(sm);
      if (sf >= 0) return pack(8, [sf]);
      return pack(5, topRanks(sm, 5));
    }
  }
  const quads: number[] = [], trips: number[] = [], pairs: number[] = [], singles: number[] = [];
  for (let r = 12; r >= 0; r--) {
    const n = counts[r]!;
    if (n === 4) quads.push(r);
    else if (n === 3) trips.push(r);
    else if (n === 2) pairs.push(r);
    else if (n === 1) singles.push(r);
  }
  if (quads.length) {
    const q = quads[0]!;
    const kicker = Math.max(...[...trips, ...pairs, ...singles, ...quads.slice(1)]);
    return pack(7, [q, kicker]);
  }
  if (trips.length >= 2 || (trips.length && pairs.length)) {
    const t = trips[0]!;
    const p = Math.max(trips[1] ?? -1, pairs[0] ?? -1);
    return pack(6, [t, p]);
  }
  const st = straightTop(mask);
  if (st >= 0) return pack(4, [st]);
  if (trips.length) return pack(3, [trips[0]!, ...[...pairs, ...singles].sort((a, b) => b - a).slice(0, 2)]);
  if (pairs.length >= 2) {
    const [p1, p2] = [pairs[0]!, pairs[1]!];
    const kicker = Math.max(...[...pairs.slice(2), ...singles]);
    return pack(2, [p1, p2, kicker]);
  }
  if (pairs.length) return pack(1, [pairs[0]!, ...singles.slice(0, 3)]);
  return pack(0, singles.slice(0, 5));
}

export function categoryOf(score: number): Category {
  return CATEGORIES[Math.floor(score / B ** 5)]!;
}

function popcount(x: number): number {
  let n = 0;
  while (x) { x &= x - 1; n++; }
  return n;
}

function topRanks(m: number, n: number): number[] {
  const out: number[] = [];
  for (let r = 12; r >= 0 && out.length < n; r--) if (m & (1 << r)) out.push(r);
  return out;
}
