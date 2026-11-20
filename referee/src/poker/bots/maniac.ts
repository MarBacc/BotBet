import type { Rng } from "../cards.js";
import type { DecisionState } from "../engine.js";
import { evaluate } from "../evaluator.js";
import { act, chenScore, handClass, type PokerBot } from "./common.js";

function decide(s: DecisionState, rng: Rng) {
  const r = rng();
  if (s.street === "preflop") {
    if (chenScore(handClass(s.hole)) >= 4 || r < 0.7) return act(s, "aggressive");
    return r < 0.9 ? act(s, "passive") : act(s, "fold");
  }
  const cat = Math.floor(evaluate([...s.hole, ...s.board]) / 15 ** 5);
  if (cat >= 1 || r < 0.55) return act(s, "aggressive"); // any pair, or a seeded bluff
  return r < 0.85 ? act(s, "passive") : act(s, "fold");
}

export const maniac: PokerBot = {
  id: "maniac",
  name: "Maniac",
  strategy: "Loose-aggressive: raises most hands preflop and bets or raises any pair, plus seeded random bluffs more than half the time.",
  decide,
};
