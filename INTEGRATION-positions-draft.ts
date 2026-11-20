/**
 * DRAFT by integration lead → demo-agent copies this to referee/src/demo/positions.ts.
 *
 * `npm run demo` (referee/src/presenter.ts) imports DEMO_DEFAULT (a FEN string or { fen }) and runs
 * validateStartFen() on it. Every position below was run through the REAL settle loop on local anvil
 * (`npm run rehearse:local -- --runs 1 --fen "<FEN>"`) on 2026-11-20 02:22 CST: all checkmate,
 * Deep Thought (white, depth 12) wins, settled. Short enough for a 2-minute demo, long enough to replay.
 */

export interface DemoPosition {
  name: string;
  fen: string;
  /** Plies played in the anvil rehearsal (Stockfish is deterministic at fixed depth, near enough). */
  pliesInRehearsal: number;
}

export const DEMO_POSITIONS: DemoPosition[] = [
  { name: "Queen and pawns vs bare king", fen: "4k3/8/8/8/8/8/3PPP2/3QK3 w - - 0 1", pliesInRehearsal: 13 },
  { name: "King and queen vs king", fen: "8/8/8/4k3/8/8/8/3QK3 w - - 0 1", pliesInRehearsal: 17 },
  { name: "King and rook vs king", fen: "8/8/8/4k3/8/8/8/R3K3 w - - 0 1", pliesInRehearsal: 27 },
];

/** The one `npm run demo` uses: 17 plies, about 8 s of replay at 450 ms/ply on the page. */
export const DEMO_DEFAULT = DEMO_POSITIONS[1];
