/**
 * `npm run replay-last [-- --file <result.json>] [--cap <cap-demo.json>] [--pace <ms>]`
 *
 * The stage fallback when Arc is slow: re-prints the last successful live run from
 * web/public/result.json (+ cap-demo.json) with its real tx links. No RPC call, no keys, no chain.
 * Amounts are base-unit strings formatted with botbet-shared, never Number() math.
 */

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Chess } from "chess.js";
import { formatUsdc } from "botbet-shared";
import { box } from "./box.js";
import { REPO_ROOT } from "./env.js";

interface Bot { id: string; name: string; address: string; depth: number; color: string; approveTxHash: string; stakeTxHash: string }
interface ResultV1 {
  version: number;
  chainId: number;
  escrow: string;
  explorerBaseUrl: string;
  matchId: string;
  stakeUsdc: string;
  potUsdc: string;
  referee?: string;
  bots: Bot[];
  winner: string;
  winnerId: string;
  plies: number;
  pgn: string;
  signature: string;
  createMatchTxHash: string;
  settleTxHash: string;
  balances: { before: Record<string, string>; after: Record<string, string> };
  finishedAt: number;
}
interface CapDemo { wallet: string; capUsdc: string; allowed: { amount: string; txHash: string | null }; refused: { amount: string; reason: string }; refusedTxHash?: string | null }

function parseArgs(argv: string[]) {
  const args = {
    file: resolve(REPO_ROOT, "web", "public", "result.json"),
    cap: resolve(REPO_ROOT, "web", "public", "cap-demo.json"),
    pace: 0,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === "--file") args.file = resolve(argv[++i]!);
    else if (a === "--cap") args.cap = resolve(argv[++i]!);
    else if (a === "--pace") args.pace = Number(argv[++i]);
    else throw new Error(`unknown argument ${a}. Usage: npm run replay-last -- [--file result.json] [--cap cap-demo.json] [--pace ms]`);
  }
  return args;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const usdc = (base: string) => formatUsdc(base, { decimals: 6 });

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (!existsSync(args.file)) {
    throw new Error(`${args.file} not found. It is written by a successful \`npm run settle\` (LIVE-RUNNER commits it).`);
  }
  const r = JSON.parse(readFileSync(args.file, "utf8")) as ResultV1;
  if (r.version !== 1) throw new Error(`${args.file} is schema version ${r.version}; this replays version 1.`);
  if (/0x0{40}|…/.test(JSON.stringify([r.settleTxHash, r.escrow]))) throw new Error(`${args.file} looks like placeholder data, not a live run.`);

  const tx = (h: string) => `${r.explorerBaseUrl}/tx/${h}`;
  const n = r.bots.length + 5;
  let i = 0;
  const step = async (label: string, lines: string[]) => {
    if (args.pace > 0) await sleep(args.pace);
    i += 1;
    console.log(`\n[${i}/${n}] ${label}`);
    for (const l of lines) console.log(`  ✅ ${l}`);
  };

  const when = new Date(r.finishedAt * 1000).toISOString().replace("T", " ").slice(0, 19);
  console.log(box("⏪ REPLAY of the last live run (recorded; no chain calls)", [`settled ${when} UTC on chain ${r.chainId}`, `escrow  ${r.escrow}`, `match   ${r.matchId}`]));

  await step("createMatch (admin)", [`createMatch  ${tx(r.createMatchTxHash)}`]);
  for (const bot of r.bots) {
    await step(`${bot.name} (${bot.color}, depth ${bot.depth}): approve → stake ${usdc(r.stakeUsdc)}`, [
      `approve  ${tx(bot.approveTxHash)}`,
      `stake    ${tx(bot.stakeTxHash)}`,
    ]);
  }

  const game = new Chess();
  game.loadPgn(r.pgn);
  const sans = game.history();
  const tail = sans.slice(-6).join(" ");
  const winner = r.bots.find((b) => b.id === r.winnerId);
  await step("Play", [`${winner?.name ?? r.winnerId} wins by checkmate in ${r.plies} plies … ${tail}`]);
  await step("Referee signs the MatchResult (EIP-712)", [`signer ${r.referee ?? "(referee)"}  sig ${r.signature.slice(0, 18)}…`]);
  await step("settle pays the winner", [`settle  ${tx(r.settleTxHash)}`, `payout  ${usdc(r.potUsdc)} → ${r.winner}`]);
  await step("Balances (ERC-20 view)", r.bots.map((b) => {
    const before = r.balances.before[b.id];
    const after = r.balances.after[b.id];
    if (!before || !after) return `${b.name}: no balance recorded`;
    const d = BigInt(after) - BigInt(before);
    return `${b.name.padEnd(13)} ${usdc(before).padStart(16)} → ${usdc(after).padStart(16)}  (${d >= 0n ? "+" : ""}${formatUsdc(d, { decimals: 6 })})`;
  }));

  const summary = [
    `winner    ${winner?.name ?? r.winnerId} in ${r.plies} plies`,
    `payout    ${usdc(r.potUsdc)}`,
    `settle    ${tx(r.settleTxHash)}`,
  ];
  if (existsSync(args.cap)) {
    const c = JSON.parse(readFileSync(args.cap, "utf8")) as CapDemo;
    console.log(`\n── AgentWallet cap (${c.wallet}) ──`);
    console.log(`  ✅ allowed  ${c.allowed.amount} USDC  ${c.allowed.txHash ? tx(c.allowed.txHash) : "(no tx recorded)"}`);
    console.log(`  ❌ refused  ${c.refused.amount} USDC  ${c.refused.reason}  (cap ${c.capUsdc} USDC)`);
    if (c.refusedTxHash) console.log(`             on-chain refusal ${tx(c.refusedTxHash)}`);
    summary.push(`cap       ${c.capUsdc} USDC: ${c.allowed.amount} paid, ${c.refused.amount} refused`);
  } else {
    summary.push("cap       no cap-demo.json recorded");
  }
  console.log(`\n${box("⏪ REPLAYED (recorded live run)", summary)}`);
}

main().catch((error: unknown) => {
  console.error(`\n❌ replay-last failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
