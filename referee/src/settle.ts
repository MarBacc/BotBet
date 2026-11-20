/**
 * `npm run settle` — the whole on-chain loop on Arc testnet. See interfaces.md section 3.
 * The loop itself lives in settle-core.ts; this file only gathers the real config.
 *
 * Flags:
 *   --fen "<FEN>"   start the game from this position (demo mode). Default: the normal start.
 *   --dry-run       run every read-only check and print the plan; send nothing.
 *   --json          progress goes to stderr; stdout gets one machine-readable summary.
 *
 * Env (.env at the repo root, or BOTBET_ENV_FILE): REFEREE_PRIVATE_KEY, DEPLOYER_PRIVATE_KEY (the
 * escrow admin — createMatch is admin-only), BOT_1_PRIVATE_KEY, BOT_2_PRIVATE_KEY; optional
 * ARC_RPC_URL, STAKE_USDC (human amount, default "2"). Keys are never printed.
 */

import { resolve } from "node:path";
import type { Abi, Hex } from "viem";
import { toBaseUnits } from "botbet-shared";
import { BOTS } from "./bots.js";
import { ARC_TESTNET_CHAIN_ID, REPO_ROOT, assertPrivateKeys, loadEnv, readArcDeployments, refereeAccount, requirePrivateKey } from "./env.js";
import { SettleError } from "./errors.js";
import { StepFailure, runSettle } from "./settle-core.js";
import { DEFAULT_RPC_URL, EXPECTED_ADDRESSES, EXPLORER_BASE_URL } from "./settle-constants.js";

const DEFAULT_STAKE = "2";

interface Args {
  fen?: string;
  dryRun: boolean;
  json: boolean;
}

function parseArgs(argv: string[]): Args {
  const args: Args = { dryRun: false, json: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg === "--dry-run") args.dryRun = true;
    else if (arg === "--json") args.json = true;
    else if (arg === "--fen") {
      const value = argv[++i];
      if (!value) throw new SettleError('--fen needs a value: --fen "<FEN>"');
      args.fen = value;
    } else if (arg.startsWith("--fen=")) args.fen = arg.slice("--fen=".length);
    else throw new SettleError(`unknown argument ${JSON.stringify(arg)}. Usage: npm run settle -- [--fen "<FEN>"] [--dry-run] [--json]`);
  }
  return args;
}

async function main(): Promise<void> {
  let args: Args = { dryRun: false, json: process.argv.includes("--json") };
  const log = (line: string) => (args.json ? console.error(line) : console.log(line));

  try {
    args = parseArgs(process.argv.slice(2));
    loadEnv();
    const deployments = readArcDeployments();
    assertPrivateKeys(["DEPLOYER_PRIVATE_KEY", "REFEREE_PRIVATE_KEY", ...BOTS.map((bot) => bot.envKey)]);
    refereeAccount(deployments); // startup assertion: the key must derive to the deployed referee

    log(`BotBet — settle on Arc testnet${args.dryRun ? " (DRY RUN: nothing will be sent)" : " (real transactions)"}`);

    const summary = await runSettle({
      rpcUrl: process.env.ARC_RPC_URL?.trim() || DEFAULT_RPC_URL,
      chainId: ARC_TESTNET_CHAIN_ID,
      escrow: deployments.contracts.MatchEscrow.address,
      escrowAbi: deployments.contracts.MatchEscrow.abi as Abi,
      usdc: deployments.usdc,
      explorerBaseUrl: EXPLORER_BASE_URL,
      outPath: resolve(REPO_ROOT, "web", "public", "result.json"),
      adminKey: requirePrivateKey("DEPLOYER_PRIVATE_KEY"),
      refereeKey: requirePrivateKey("REFEREE_PRIVATE_KEY"),
      botKeys: Object.fromEntries(BOTS.map((bot) => [bot.id, requirePrivateKey(bot.envKey)])) as Record<string, Hex>,
      stake: toBaseUnits(process.env.STAKE_USDC?.trim() || DEFAULT_STAKE),
      expectedAddresses: EXPECTED_ADDRESSES,
      startFen: args.fen,
      dryRun: args.dryRun,
      log,
    });
    if (args.json) console.log(JSON.stringify(summary, null, 2));
  } catch (error) {
    const step = error instanceof StepFailure ? error.step : "setup";
    const cause = error instanceof StepFailure ? error.cause : error;
    const message = cause instanceof Error ? cause.message : String(cause);
    const hint = cause instanceof SettleError ? cause.hint : undefined;
    log(`\n❌ FAILED at "${step}": ${message}`);
    if (hint) log(`   → ${hint}`);
    if (args.json) console.log(JSON.stringify({ ok: false, step, error: message, hint: hint ?? null }, null, 2));
    process.exitCode = 1;
  }
}

void main();
