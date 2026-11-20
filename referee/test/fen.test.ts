// Start-FEN validation runs in settle's preflight, before any money moves.
import { test } from "node:test";
import assert from "node:assert/strict";
import { validateStartFen } from "../src/game.js";
import { BUILT_IN_DEMO_FEN } from "../src/presenter-fen.js";

test("built-in demo FEN is playable", () => assert.doesNotThrow(() => validateStartFen(BUILT_IN_DEMO_FEN)));
test("standard start is playable", () => assert.doesNotThrow(() => validateStartFen("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1")));
test("side not to move in check is refused (hung Stockfish)", () =>
  assert.throws(() => validateStartFen("r3k2r/ppp2ppp/2n5/3q4/3P4/2P2N2/P1Q2PPP/R3R1K1 w kq - 0 15"), /black is in check/));
test("finished position is refused", () =>
  assert.throws(() => validateStartFen("rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3"), /already over/));
test("garbage is refused", () => assert.throws(() => validateStartFen("not a fen"), /invalid --fen/));
