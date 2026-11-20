/**
 * One offline game, Stockfish against Stockfish. See interfaces.md section 3.
 *
 * The two bots differ only in search depth, and that gap is the whole personality: depth 12 beats
 * depth 4 decisively, so a draw or a hit move cap is a bug, not an outcome — both throw rather
 * than produce a result nobody can be paid against.
 */

import { Chess } from "chess.js";
import { BOTS, type BotConfig } from "./bots.js";
import { Engine } from "./engine.js";

/** Per-move thinking budget. The deep bot spends it; the shallow one finishes long before. */
export const MOVE_TIME_MS = 3_000;
/**
 * The cap is counted in full moves (a white move and a black reply) — 80 of them, so at most
 * 160 plies. Note the deliberate mix of units: the cap is in full moves, while the signed
 * `moveCount` is in plies.
 */
export const MAX_FULL_MOVES = 80;

export interface GameOutcome {
  /** Full PGN with headers, exactly the text that gets hashed into the signed result. */
  pgn: string;
  /**
   * Half-moves played. This is the signed `moveCount` — plies, not full moves, matching the
   * `atPly` unit the page replays in and the commentary is keyed to.
   */
  moveCount: number;
  /** Full moves, for display only — `1. e4 e5` is one. Never signed. */
  fullMoves: number;
  winner: BotConfig;
  loser: BotConfig;
  white: BotConfig;
  black: BotConfig;
  /** UCI move list, handy for replay and for debugging a disputed game. */
  uciMoves: string[];
  finishedAt: number;
}

export interface PlayGameOptions {
  /** Called once per move so a 3 s/move game shows progress instead of hanging silently. */
  onMove?: (info: { ply: number; san: string; uci: string; bot: BotConfig; elapsedMs: number }) => void;
  enginePath?: string;
  /** Optional start position (demo mode starts mid-game). Default: the normal start. */
  startFen?: string;
}

/** BOTS[0] has white. Fixed, so the deep bot does not also win the coin toss. */
export function sides(): { white: BotConfig; black: BotConfig } {
  return { white: BOTS[0], black: BOTS[1] };
}

export async function playGame(options: PlayGameOptions = {}): Promise<GameOutcome> {
  const { white, black } = sides();
  const startFen = options.startFen?.trim() || undefined;
  const chess = new Chess();
  if (startFen) {
    try {
      chess.load(startFen);
    } catch (error) {
      throw new Error(`invalid --fen ${JSON.stringify(startFen)}: ${error instanceof Error ? error.message : String(error)}`);
    }
    if (chess.isGameOver()) throw new Error("the --fen position is already over; nothing to play.");
  }

  chess.setHeader("Event", "BotBet");
  chess.setHeader("Site", "offline");
  chess.setHeader("Date", new Date().toISOString().slice(0, 10).replace(/-/g, "."));
  chess.setHeader("White", `${white.name} (Stockfish depth ${white.depth})`);
  chess.setHeader("Black", `${black.name} (Stockfish depth ${black.depth})`);
  if (startFen) {
    chess.setHeader("SetUp", "1");
    chess.setHeader("FEN", startFen);
  }

  const engines = new Map<string, Engine>();
  const uciMoves: string[] = [];

  try {
    for (const bot of [white, black]) {
      const engine = await Engine.start(options.enginePath);
      await engine.newGame();
      engines.set(bot.id, engine);
    }

    while (!chess.isGameOver()) {
      if (uciMoves.length >= MAX_FULL_MOVES * 2) {
        throw new Error(
          `move cap reached: ${MAX_FULL_MOVES} full moves with no result. ` +
            `A decisive game is required — see interfaces.md section 3.`,
        );
      }

      const bot = chess.turn() === "w" ? white : black;
      const engine = engines.get(bot.id)!;

      const startedAt = Date.now();
      const uci = await engine.bestMove(uciMoves, bot.depth, MOVE_TIME_MS, startFen);
      const elapsedMs = Date.now() - startedAt;

      const move = chess.move({
        from: uci.slice(0, 2),
        to: uci.slice(2, 4),
        promotion: uci.length > 4 ? uci.slice(4, 5) : undefined,
      });

      uciMoves.push(uci);
      options.onMove?.({ ply: uciMoves.length, san: move.san, uci, bot, elapsedMs });
    }

    if (!chess.isCheckmate()) {
      throw new Error(`game ended without checkmate (${drawReason(chess)}). A draw is a bug — see interfaces.md section 3.`);
    }

    // The side to move is the one that has been mated.
    const loser = chess.turn() === "w" ? white : black;
    const winner = loser === white ? black : white;
    chess.setHeader("Result", winner === white ? "1-0" : "0-1");

    const plies = uciMoves.length;
    return {
      pgn: chess.pgn(),
      moveCount: plies,
      fullMoves: Math.ceil(plies / 2),
      winner,
      loser,
      white,
      black,
      uciMoves,
      finishedAt: Math.floor(Date.now() / 1000),
    };
  } finally {
    await Promise.all([...engines.values()].map((engine) => engine.quit()));
  }
}

function drawReason(chess: Chess): string {
  if (chess.isStalemate()) return "stalemate";
  if (chess.isInsufficientMaterial()) return "insufficient material";
  if (chess.isThreefoldRepetition()) return "threefold repetition";
  if (chess.isDraw()) return "fifty-move rule or draw";
  return "unknown reason";
}
