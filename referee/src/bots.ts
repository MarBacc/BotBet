/**
 * The two players. Both are Stockfish at different depths — the depth gap is what makes the
 * match decisive instead of a draw. Folded in from the old bots/ package.
 */

export interface BotConfig {
  /** Stable id, used as the key in results and on the page. */
  id: string;
  name: string;
  /** Stockfish search depth. The gap between the two is the whole personality. */
  depth: number;
  /** Which BOT_n_PRIVATE_KEY in .env funds and signs for this bot. */
  envKey: "BOT_1_PRIVATE_KEY" | "BOT_2_PRIVATE_KEY";
}

export const BOTS: readonly [BotConfig, BotConfig] = [
  { id: "deep", name: "Deep Thought", depth: 12, envKey: "BOT_1_PRIVATE_KEY" },
  { id: "hasty", name: "Hasty Hal", depth: 4, envKey: "BOT_2_PRIVATE_KEY" },
];
