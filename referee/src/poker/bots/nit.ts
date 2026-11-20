import { rankOf } from "../cards.js";
import type { DecisionState } from "../engine.js";
import { evaluate } from "../evaluator.js";
import { act, handClass, type PokerBot } from "./common.js";

/** Premium hands only: 77+, AK, AQ, AJs, KQs. */
const PREMIUM = new Set(["AA", "KK", "QQ", "JJ", "TT", "99", "88", "77", "AKs", "AKo", "AQs", "AQo", "AJs", "KQs"]);

function decide(s: DecisionState) {
  if (s.street === "preflop") {
    if (PREMIUM.has(handClass(s.hole))) return act(s, "aggressive");
    return act(s, "fold"); // checks the free option in the big blind, folds everything else
  }
  const score = evaluate([...s.hole, ...s.board]);
  const cat = Math.floor(score / 15 ** 5);
  const boardTop = Math.max(...s.board.map(rankOf));
  const pairRank = Math.floor(score / 15 ** 4) % 15; // first tie-break rank = the pair for one pair
  const holeRanks = s.hole.map(rankOf);
  const topPairOrBetter = cat >= 2 || (cat === 1 && pairRank >= boardTop && holeRanks.includes(pairRank));
  if (cat >= 2) return act(s, "aggressive");              // two pair or better: bet and raise
  if (topPairOrBetter) return s.betsThisStreet >= 2 ? act(s, "passive") : act(s, "aggressive");
  if (cat === 1) return s.toCall <= s.betSize ? act(s, "passive") : act(s, "fold");
  return act(s, "fold");
}

export const nit: PokerBot = {
  id: "nit",
  name: "Nit",
  strategy: "Tight-aggressive: plays only premium hands (77+, AK, AQ, AJs, KQs), then bets hard with top pair or better and gives up otherwise.",
  decide,
};
