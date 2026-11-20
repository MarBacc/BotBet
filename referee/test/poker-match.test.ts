import { test } from "node:test";
import assert from "node:assert/strict";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import type { Hex } from "viem";
import { makeRng, shuffledDeck } from "../src/poker/cards.js";
import { IllegalAction, playHand, STARTING_STACK } from "../src/poker/engine.js";
import { canonicalJson, hashHandHistory, playMatch, POKER_BOTS } from "../src/poker/match.js";
import { matchDomain, recoverMatchResultSigner, signMatchResult } from "../src/result.js";
import { preflopChart } from "../src/poker/bots/theory.js";

const SEED: Hex = `0x${"ab".repeat(32)}`;
const PAIRS = [["theory", "maniac"], ["nit", "maniac"], ["theory", "nit"]] as const;
const pair = (a: string, b: string) => [POKER_BOTS[a]!, POKER_BOTS[b]!] as const;

test("poker: same seed → same hand history and hash; different seed → different", () => {
  const a = playMatch({ seed: SEED, bots: pair("theory", "maniac") });
  const b = playMatch({ seed: SEED, bots: pair("theory", "maniac") });
  assert.equal(canonicalJson(a.hands), canonicalJson(b.hands));
  assert.equal(a.handHistoryHash, b.handHistoryHash);
  assert.equal(a.handHistoryHash, hashHandHistory(b.hands));
  const c = playMatch({ seed: `0x${"cd".repeat(32)}`, bots: pair("theory", "maniac") });
  assert.notEqual(a.handHistoryHash, c.handHistoryHash);
});

test("poker: seeded deck is a permutation of 52 cards and reproducible", () => {
  const d1 = shuffledDeck(makeRng(SEED, "deck:1"));
  assert.deepEqual([...d1].sort((x, y) => x - y), Array.from({ length: 52 }, (_, i) => i));
  assert.deepEqual(d1, shuffledDeck(makeRng(SEED, "deck:1")));
  assert.notDeepEqual(d1, shuffledDeck(makeRng(SEED, "deck:2")));
});

test("poker: bots never act illegally over 200+ hands per pairing; chips are conserved", () => {
  for (const [x, y] of PAIRS) {
    let hands = 0;
    for (let m = 0; hands < 200; m++) {
      const seed = `0x${m.toString(16).padStart(64, "0")}` as Hex;
      // playHand throws IllegalAction on any illegal choice; playMatch throws on a chip leak.
      const o = playMatch({ seed, bots: pair(x, y), hands: 60 });
      hands += o.handsPlayed;
      assert.equal(o.chips[0] + o.chips[1], 2 * STARTING_STACK);
      assert.ok(o.chips[0] !== o.chips[1] || o.tiebreak !== "none");
      assert.equal(o.winnerSeat === 0 ? o.chips[0] >= o.chips[1] : o.chips[1] >= o.chips[0], true);
    }
  }
});

test("poker: an illegal action is rejected", () => {
  assert.throws(
    () => playHand({ seed: SEED, handNo: 1, button: 0, stacks: [100, 100], bots: [() => "check", () => "check"] }),
    IllegalAction, // the button faces the big blind: check is not legal
  );
});

test("poker: fixed-limit caps — at most 4 bets per street", () => {
  const always = () => (s: { legal: readonly string[] }) => (s.legal.includes("raise") ? "raise" : s.legal.includes("bet") ? "bet" : "call") as never;
  const h = playHand({ seed: SEED, handNo: 1, button: 0, stacks: [100, 100], bots: [always(), always()] });
  for (const st of ["preflop", "flop", "turn", "river"]) {
    const n = h.actions.filter((a) => a.street === st && (a.type === "bet" || a.type === "raise")).length;
    assert.ok(n <= (st === "preflop" ? 3 : 4), `${st}: ${n} bets/raises`);
  }
  assert.equal(h.pot, 2 * (8 + 8 + 16 + 16), "capped every street: 48 each");
});

test("poker: preflop chart covers all 169 hands in every spot", () => {
  const c = preflopChart().chart;
  for (const spot of ["button_open", "bb_vs_limp", "bb_vs_raise", "button_vs_3bet"]) {
    assert.equal(Object.keys(c[spot]!).length, 169, spot);
  }
});

test("poker: result signs and recovers with the chess EIP-712 MatchResult", async () => {
  const o = playMatch({ seed: SEED, bots: pair("nit", "maniac") });
  const key = generatePrivateKey();
  const domain = matchDomain(5042002, "0x9d4EEE03C431c524822c6A1486bE6142d2a4916c");
  const result = { matchId: SEED, winner: privateKeyToAccount(generatePrivateKey()).address, moveCount: o.handsPlayed, pgnHash: o.handHistoryHash, finishedAt: 1n };
  const sig = await signMatchResult(key, domain, result);
  assert.equal(await recoverMatchResultSigner(domain, result, sig), privateKeyToAccount(key).address);
  assert.ok(o.handsPlayed <= 65535, "moveCount fits uint16");
});
