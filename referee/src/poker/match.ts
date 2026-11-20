/**
 * A poker match: N hands (or until a bot is busted) between two bots, then the EIP-712 MatchResult.
 * The deck seed is the matchId. See README.md for how this maps onto MatchEscrow.
 */
import { keccak256, toBytes, type Address, type Hex } from "viem";
import type { PokerBot } from "./bots/common.js";
import { maniac } from "./bots/maniac.js";
import { nit } from "./bots/nit.js";
import { theory } from "./bots/theory.js";
import { handToJson, playHand, STARTING_STACK, type HandResult } from "./engine.js";

export const POKER_BOTS: Record<string, PokerBot> = { nit, maniac, theory };
export const DEFAULT_HANDS = 30;
export const MAX_TIEBREAK_HANDS = 10;

export type HandJson = ReturnType<typeof handToJson>;

export interface MatchOutcome {
  bots: readonly [PokerBot, PokerBot];
  hands: HandJson[];
  chips: [number, number];
  /** Seat (0 = bot A, 1 = bot B). */
  winnerSeat: 0 | 1;
  handsPlayed: number;
  handHistoryHash: Hex;
  tiebreak: "none" | "extra-hands" | "last-pot" | "bot-a";
  elapsedMs: number;
}

/** JSON with object keys sorted recursively and no whitespace: the hashed form. */
export function canonicalJson(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canonicalJson).join(",")}]`;
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    return `{${Object.keys(o).sort().map((k) => `${JSON.stringify(k)}:${canonicalJson(o[k])}`).join(",")}}`;
  }
  return JSON.stringify(v);
}

export const hashHandHistory = (hands: readonly HandJson[]): Hex => keccak256(toBytes(canonicalJson(hands)));

export function playMatch(opts: {
  seed: Hex;
  bots: readonly [PokerBot, PokerBot];
  hands?: number;
  onHand?: (n: number, hand: HandResult, chips: readonly [number, number]) => void;
}): MatchOutcome {
  const started = Date.now();
  const { seed, bots } = opts;
  const scheduled = opts.hands ?? DEFAULT_HANDS;
  if (bots[0].name === bots[1].name) throw new Error("pick two different bots");
  const names = [bots[0].name, bots[1].name] as const;
  const chips: [number, number] = [STARTING_STACK, STARTING_STACK];
  const hands: HandJson[] = [];
  let lastPotWinner: 0 | 1 | null = null;
  let n = 0;
  const busted = () => chips[0] === 0 || chips[1] === 0;
  const one = (): void => {
    n++;
    const button: 0 | 1 = n % 2 === 1 ? 0 : 1;
    const h = playHand({ seed, handNo: n, button, stacks: chips, bots: [bots[0].decide, bots[1].decide] });
    chips[0] += h.delta[0];
    chips[1] += h.delta[1];
    if (h.winner !== null) lastPotWinner = h.winner;
    hands.push(handToJson(h, n, names));
    opts.onHand?.(n, h, chips);
  };
  while (n < scheduled && !busted()) one();
  let tiebreak: MatchOutcome["tiebreak"] = "none";
  if (chips[0] === chips[1]) {
    tiebreak = "extra-hands";
    while (chips[0] === chips[1] && n < scheduled + MAX_TIEBREAK_HANDS) one();
  }
  let winnerSeat: 0 | 1;
  if (chips[0] !== chips[1]) winnerSeat = chips[0] > chips[1] ? 0 : 1;
  else if (lastPotWinner !== null) { winnerSeat = lastPotWinner; tiebreak = "last-pot"; }
  else { winnerSeat = 0; tiebreak = "bot-a"; }
  if (chips[0] + chips[1] !== 2 * STARTING_STACK) throw new Error(`chip leak: ${chips.join("+")}`);
  return {
    bots, hands, chips, winnerSeat, handsPlayed: n,
    handHistoryHash: hashHandHistory(hands), tiebreak, elapsedMs: Date.now() - started,
  };
}

/** web/public/poker-result.json. `referee` mirrors result.json's signed fields. */
export function pokerResultJson(o: MatchOutcome, extra: {
  addresses: readonly [Address, Address];
  matchId: Hex;
  chainId: number;
  escrow: Address;
  refereeAddress: Address;
  finishedAt: number;
  signature: Hex;
  offline: boolean;
  txs?: Record<string, string>;
}) {
  const winner = o.bots[o.winnerSeat];
  return {
    schemaVersion: 1,
    game: "poker",
    variant: "HU-LHE",
    offline: extra.offline,
    chainId: extra.chainId,
    escrow: extra.escrow,
    matchId: extra.matchId,
    bots: o.bots.map((b, i) => ({ id: b.id, name: b.name, strategy: b.strategy, address: extra.addresses[i] })),
    hands: o.hands,
    chips: { [o.bots[0].name]: o.chips[0], [o.bots[1].name]: o.chips[1] },
    winner: winner.name,
    winnerId: winner.id,
    handsPlayed: o.handsPlayed,
    tiebreak: o.tiebreak,
    handHistoryHash: o.handHistoryHash,
    referee: {
      address: extra.refereeAddress,
      result: {
        matchId: extra.matchId,
        winner: extra.addresses[o.winnerSeat],
        moveCount: o.handsPlayed,
        pgnHash: o.handHistoryHash,
        finishedAt: extra.finishedAt,
      },
      signature: extra.signature,
    },
    ...(extra.txs ? { txs: extra.txs } : {}),
  };
}
