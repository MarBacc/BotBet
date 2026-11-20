import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Rng } from "../cards.js";
import type { DecisionState } from "../engine.js";
import { act, equity, handClass, type PokerBot } from "./common.js";

type ChartAction = "raise" | "call" | "fold";
interface Chart { chart: Record<string, Record<string, ChartAction>> }

/** referee/data/poker/preflop-chart.json (same depth from src/ and dist/). */
const CHART_PATH = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "data", "poker", "preflop-chart.json");
let cached: Chart | undefined;
export function preflopChart(): Chart {
  return (cached ??= JSON.parse(readFileSync(CHART_PATH, "utf8")) as Chart);
}

export const EQUITY_SAMPLES = 200;

function preflopSpot(s: DecisionState): string {
  if (s.isButton) return s.betsThisStreet <= 1 ? "button_open" : "button_vs_3bet";
  return s.toCall === 0 ? "bb_vs_limp" : "bb_vs_raise";
}

function decide(s: DecisionState, rng: Rng) {
  if (s.street === "preflop") {
    const a = preflopChart().chart[preflopSpot(s)]?.[handClass(s.hole)] ?? "fold";
    return act(s, a === "raise" ? "aggressive" : a === "call" ? "passive" : "fold");
  }
  const eq = equity(s.hole, s.board, EQUITY_SAMPLES, rng);
  const potOdds = s.toCall / (s.pot + s.toCall);
  if (eq >= 0.7) return act(s, "aggressive");
  if (s.toCall === 0) return eq >= 0.55 ? act(s, "aggressive") : act(s, "passive");
  return eq >= potOdds ? act(s, "passive") : act(s, "fold");
}

export const theory: PokerBot = {
  id: "theory",
  name: "Theory",
  strategy: "By the book: a 169-hand heads-up preflop chart by position, then a 200-sample Monte Carlo equity estimate against pot odds after the flop.",
  decide,
};
