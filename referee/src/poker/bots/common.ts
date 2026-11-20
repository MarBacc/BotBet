import { type Card, RANKS, rankOf, type Rng, suitOf } from "../cards.js";
import type { ActionType, DecisionState } from "../engine.js";
import { evaluate } from "../evaluator.js";

export interface PokerBot {
  id: string;
  name: string;
  /** One line for the UI. */
  strategy: string;
  decide: (state: DecisionState, rng: Rng) => ActionType;
}

/** "AA", "AKs", "T9o": the 169 starting-hand classes. */
export function handClass(hole: readonly [Card, Card]): string {
  const [a, b] = rankOf(hole[0]) >= rankOf(hole[1]) ? [hole[0], hole[1]] : [hole[1], hole[0]];
  const hi = RANKS[rankOf(a)]!, lo = RANKS[rankOf(b)]!;
  if (rankOf(a) === rankOf(b)) return hi + lo;
  return hi + lo + (suitOf(a) === suitOf(b) ? "s" : "o");
}

/** All 169 classes, AA first. */
export function allHandClasses(): string[] {
  const out: string[] = [];
  for (let i = 12; i >= 0; i--)
    for (let j = i; j >= 0; j--) {
      if (i === j) out.push(RANKS[i]! + RANKS[j]!);
      else out.push(RANKS[i]! + RANKS[j]! + "s", RANKS[i]! + RANKS[j]! + "o");
    }
  return out;
}

/** Bill Chen's preflop formula: a standard quick strength score (-1 .. 20). */
export function chenScore(cls: string): number {
  const hi = RANKS.indexOf(cls[0]!), lo = RANKS.indexOf(cls[1]!);
  const pts = (r: number): number => (r === 12 ? 10 : r === 11 ? 8 : r === 10 ? 7 : r === 9 ? 6 : (r + 2) / 2);
  let s = pts(hi);
  if (hi === lo) return Math.ceil(Math.max(5, s * 2));
  if (cls.endsWith("s")) s += 2;
  const gap = hi - lo - 1;
  s -= gap === 0 ? 0 : gap === 1 ? 1 : gap === 2 ? 2 : gap === 3 ? 4 : 5;
  if (gap <= 1 && hi < 10) s += 1;
  return Math.ceil(s);
}

/** Win probability (ties count half) vs one random hand, by seeded Monte Carlo. */
export function equity(hole: readonly Card[], board: readonly Card[], samples: number, rng: Rng): number {
  const used = new Set<number>([...hole, ...board]);
  const rest: Card[] = [];
  for (let c = 0; c < 52; c++) if (!used.has(c)) rest.push(c);
  const need = 2 + (5 - board.length);
  let score = 0;
  for (let i = 0; i < samples; i++) {
    // partial Fisher-Yates for `need` cards
    for (let k = 0; k < need; k++) {
      const j = k + Math.floor(rng() * (rest.length - k));
      [rest[k], rest[j]] = [rest[j]!, rest[k]!];
    }
    const opp = [rest[0]!, rest[1]!];
    const full = [...board, ...rest.slice(2, need)];
    const me = evaluate([...hole, ...full]);
    const them = evaluate([...opp, ...full]);
    score += me > them ? 1 : me === them ? 0.5 : 0;
  }
  return score / samples;
}

/** Map an intent onto what is legal right now. */
export function act(state: DecisionState, intent: "aggressive" | "passive" | "fold"): ActionType {
  const has = (a: ActionType): boolean => state.legal.includes(a);
  if (intent === "aggressive") {
    if (has("raise")) return "raise";
    if (has("bet")) return "bet";
    return has("call") ? "call" : "check";
  }
  if (intent === "passive") return has("check") ? "check" : "call";
  return has("check") ? "check" : "fold";
}
