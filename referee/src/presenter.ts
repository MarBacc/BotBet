/**
 * `npm run demo [-- --dry-run]` — the presenter's one command.
 *
 *   setup check (npm script prefix) → settle from a mid-game FEN → cap demo (if a wallet is set) →
 *   where to open the page
 *
 * FEN: DEMO_DEFAULT from src/demo/positions.ts (demo-agent's) when present and playable, else a
 * built-in middlegame where white (Deep Thought) is a queen up and mates in a few moves.
 * --dry-run passes through: every check runs, nothing is sent. Env WEB_URL overrides the page URL.
 */

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { box, seconds } from "./box.js";
import { loadEnv } from "./env.js";
import { validateStartFen } from "./game.js";

/** White to move, a queen up; Stockfish depth 12 mates in 5 plies (~1 s of play). Checked legal. */
export const BUILT_IN_DEMO_FEN = "rnb2rk1/ppp2ppp/8/8/2B5/2N2Q2/PPP2PPP/R4RK1 w - - 0 11";
const DEFAULT_WEB_URL = "http://localhost:5173";
const SRC = dirname(fileURLToPath(import.meta.url));

async function demoFen(): Promise<{ fen: string; source: string }> {
  const positions = resolve(SRC, "demo", "positions.ts");
  if (existsSync(positions)) {
    try {
      const mod = (await import(pathToFileURL(positions).href)) as { DEMO_DEFAULT?: unknown };
      const raw = mod.DEMO_DEFAULT;
      const fen = typeof raw === "string" ? raw : (raw as { fen?: unknown } | undefined)?.fen;
      if (typeof fen === "string") {
        validateStartFen(fen);
        return { fen, source: "src/demo/positions.ts DEMO_DEFAULT" };
      }
      console.log("  ⚠ src/demo/positions.ts has no usable DEMO_DEFAULT; using the built-in position");
    } catch (error) {
      console.log(`  ⚠ DEMO_DEFAULT rejected (${error instanceof Error ? error.message : String(error)}); using the built-in position`);
    }
  }
  return { fen: BUILT_IN_DEMO_FEN, source: "built-in" };
}

/** Run a referee script in this terminal, inheriting stdout so the projector sees it live. */
function run(script: string, args: string[]): number {
  const result = spawnSync(process.execPath, ["--import", "tsx", resolve(SRC, script), ...args], { stdio: "inherit" });
  return result.status ?? 1;
}

async function main(): Promise<void> {
  const dryRun = process.argv.includes("--dry-run");
  const t0 = Date.now();
  loadEnv();
  const { fen, source } = await demoFen();
  const webUrl = process.env.WEB_URL?.trim() || DEFAULT_WEB_URL;

  console.log(box(`🎬 BotBet live demo${dryRun ? " (DRY RUN)" : ""}`, [`start position (${source})`, fen]));

  console.log("\n━━━━━━━━━━━━━━━━ PART 1: stake → play → sign → settle ━━━━━━━━━━━━━━━━");
  const settleCode = run("settle.ts", ["--fen", fen, ...(dryRun ? ["--dry-run"] : [])]);
  if (settleCode !== 0) {
    console.log(
      `\n${box("❌ settle did not finish", [
        "If Arc is slow or down, show the last recorded live run instead:",
        "  npm run replay-last",
        `Then open the page: ${webUrl}`,
      ])}`,
    );
    process.exitCode = settleCode;
    return;
  }

  console.log("\n━━━━━━━━━━━━━━━━ PART 2: the AgentWallet spending cap ━━━━━━━━━━━━━━━━");
  let capLine: string;
  if (!process.env.AGENT_WALLET_ADDRESS?.trim()) {
    console.log("  ⏭ AGENT_WALLET_ADDRESS is not set: skipping the cap demo (the page shows the last cap-demo.json).");
    capLine = "cap demo  skipped (no AGENT_WALLET_ADDRESS)";
  } else {
    const capCode = run("cap-demo.ts", dryRun ? ["--dry-run"] : []);
    capLine = capCode === 0 ? "cap demo  ✅ allowed 0.02, refused 0.10 (CapExceeded)" : "cap demo  ❌ failed (see above); settle still succeeded";
  }

  console.log(
    `\n${box(dryRun ? "🧪 DEMO DRY RUN COMPLETE: nothing was sent" : "✅ DEMO COMPLETE", [
      `settle    ✅ ${dryRun ? "all checks passed" : "settled on Arc (link above)"}`,
      capLine,
      `page      ${webUrl}   (cd web && npm run dev)`,
      `time      ${seconds(Date.now() - t0)}`,
    ])}`,
  );
}

main().catch((error: unknown) => {
  console.error(`\n❌ demo failed: ${error instanceof Error ? error.message : String(error)}`);
  console.error("   Fallback: npm run replay-last");
  process.exitCode = 1;
});
