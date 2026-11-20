import { Chess } from "chess.js";
import { playGame } from "../game.js";
import { DEMO_POSITIONS } from "./positions.js";

const RUNS = 3;
const passing: { id: string; plies: number; uci: string[] }[] = [];

console.log("id | plies | result | reason | seconds");

for (const position of DEMO_POSITIONS) {
  const chess = new Chess();
  chess.load(position.fen);
  if (chess.turn() !== position.sideToMove) {
    throw new Error(`${position.id}: sideToMove does not match the FEN`);
  }
  if (chess.isGameOver()) throw new Error(`${position.id}: starting position is already over`);

  const outcomes: { plies: number; result: string; uci: string[] }[] = [];
  for (let run = 0; run < RUNS; run++) {
    const started = Date.now();
    try {
      const game = await playGame({ startFen: position.fen });
      const seconds = ((Date.now() - started) / 1000).toFixed(2);
      const result = game.winner.id === "deep" ? "white wins" : "black wins";
      console.log(`${position.id}#${run + 1} | ${game.moveCount} | ${result} | checkmate | ${seconds}`);
      outcomes.push({ plies: game.moveCount, result, uci: game.uciMoves });
    } catch (error) {
      const seconds = ((Date.now() - started) / 1000).toFixed(2);
      const reason = error instanceof Error ? error.message : String(error);
      console.log(`${position.id}#${run + 1} | — | — | ${reason} | ${seconds}`);
    }
  }

  const first = outcomes[0];
  const deterministic = outcomes.length === RUNS && outcomes.every(
    (outcome) => JSON.stringify(outcome.uci) === JSON.stringify(first!.uci),
  );
  console.log(`${position.id} | identical moves in ${RUNS} runs: ${deterministic ? "yes" : "no"}`);
  if (
    deterministic &&
    first!.result === "white wins" &&
    first!.plies <= 30
  ) {
    passing.push({ id: position.id, plies: first!.plies, uci: first!.uci });
  }
}

if (passing.length === 0) {
  console.error("No candidate passed: needs deterministic depth-12 white checkmate in 30 plies or fewer.");
  process.exitCode = 1;
} else {
  // Stable sort retains candidate order when two reliable positions have the same ply count.
  passing.sort((a, b) => a.plies - b.plies);
  console.log(`DEMO_DEFAULT candidate: ${passing[0]!.id} (${passing[0]!.plies} plies; identical UCI moves in ${RUNS} runs)`);
}
