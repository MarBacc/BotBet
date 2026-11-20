import { test } from "node:test";
import assert from "node:assert/strict";
import { parseCards } from "../src/poker/cards.js";
import { categoryOf, evaluate } from "../src/poker/evaluator.js";

const ev = (s: string) => evaluate(parseCards(s));

// Ten known 7-card hands, strongest first.
const LADDER: Array<[string, string]> = [
  ["As Ks Qs Js Ts 2d 3c", "straight flush"],   // royal flush
  ["9h 8h 7h 6h 5h Ad Kc", "straight flush"],
  ["Qc Qd Qh Qs 2c 3d 9h", "four of a kind"],
  ["Jc Jd Jh 4s 4c 2d 9h", "full house"],
  ["Ad Td 8d 6d 2d Kc Qh", "flush"],
  ["Tc 9d 8h 7s 6c 2d 2h", "straight"],
  ["5c 4d 3h 2s Ac Kd 9h", "straight"],         // wheel
  ["7c 7d 7h Ks 2c 4d 9h", "three of a kind"],
  ["Kc Kd 5h 5s 2c 3d 9h", "two pair"],
  ["Ac Ad 9h 7s 4c 3d 2h", "pair"],
  ["Ac Jd 9h 7s 4c 3d 2h", "high card"],
];

test("poker evaluator: categories of ten known hands", () => {
  for (const [hand, cat] of LADDER) assert.equal(categoryOf(ev(hand)), cat, hand);
});

test("poker evaluator: strictly decreasing ladder (royal > straight flush > quads > … > high card)", () => {
  for (let i = 1; i < LADDER.length; i++) {
    assert.ok(ev(LADDER[i - 1]![0]) > ev(LADDER[i]![0]), `${LADDER[i - 1]![0]} should beat ${LADDER[i]![0]}`);
  }
});

test("poker evaluator: kickers and edge cases", () => {
  assert.ok(ev("Ac Ad Kh 7s 4c 3d 2h") > ev("Ac Ad Qh 7s 4c 3d 2h"), "pair of aces, king kicker beats queen kicker");
  assert.ok(ev("6c 5d 4h 3s 2c Kd 9h") > ev("5c 4d 3h 2s Ac Kd 9h"), "six-high straight beats the wheel");
  assert.ok(ev("Ah Kh 3h 4h 5h 2h 9c") > ev("Ah Kh Qh Jh 9h 2c 3c"), "steel wheel (5-high straight flush) beats an ace-high flush");
  assert.ok(ev("Kc Kd Kh 2s 2c 3d 3h") > ev("Qc Qd Qh As Ac 3d 4h"), "kings full beats queens full");
  assert.equal(categoryOf(ev("Kc Kd Kh 2s 2c 2d 9h")), "full house", "two sets make a full house");
  assert.ok(ev("Kc Kd Kh 9s 9c 2d 2h") > ev("Kc Kd Kh 2s 2c 2d 9h"), "KKK99 beats KKK22");
  assert.ok(ev("Jc Jd 5h 5s 4c 4d Ah") > ev("Jc Jd 5h 5s 4c 4d Kh"), "two pair kicker uses the best remaining card");
});

test("poker evaluator: split pots", () => {
  const board = "As Ks Qd Jc Th"; // broadway on board
  assert.equal(ev(`${board} 2c 3d`), ev(`${board} 4h 5h`), "board plays: split");
  assert.equal(ev("Ah Kd 8s 8c 5d 4c 2s"), ev("Ac Kc 8s 8c 5d 4c 2s"), "same pair, same kickers: split");
  assert.notEqual(ev("Ah Kd 8s 8c 5d 4c 2s"), ev("Ah Qd 8s 8c 5d 4c 2s"), "different kicker is not a split");
});
