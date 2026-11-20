/**
 * `npm run play-poker` — one heads-up limit Hold'em match offline, printed and signed. Sends nothing.
 *
 *   npm run play-poker -- [--bots theory,maniac] [--hands 30] [--seed 0x<64 hex>] [--out <path>] [--no-write]
 *
 * Without REFEREE_PRIVATE_KEY it signs with a throwaway key (the signature would NOT settle).
 * Writes web/public/poker-result.json unless --no-write.
 */
import { randomBytes } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { toHex, type Address, type Hex } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { loadEnv, readArcDeployments, refereeAccount, REPO_ROOT, requirePrivateKey } from "../env.js";
import { matchDomain, recoverMatchResultSigner, signMatchResult, type MatchResult } from "../result.js";
import { cardStr } from "./cards.js";
import { DEFAULT_HANDS, playMatch, POKER_BOTS, pokerResultJson } from "./match.js";

export interface PokerArgs { bots: [string, string]; hands: number; seed?: Hex; out: string; write: boolean; dryRun: boolean }

export function parsePokerArgs(argv: string[]): PokerArgs {
  const a: PokerArgs = { bots: ["theory", "maniac"], hands: DEFAULT_HANDS, out: resolve(REPO_ROOT, "web", "public", "poker-result.json"), write: true, dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i]!, v = argv[i + 1];
    if (k === "--bots" && v) { const [x, y] = v.split(","); a.bots = [x ?? "", y ?? ""]; i++; }
    else if (k === "--hands" && v) { a.hands = Number(v); i++; }
    else if (k === "--seed" && v) { a.seed = v as Hex; i++; }
    else if (k === "--out" && v) { a.out = resolve(v); i++; }
    else if (k === "--no-write") a.write = false;
    else if (k === "--dry-run") a.dryRun = true;
    else throw new Error(`unknown argument ${JSON.stringify(k)}. Usage: -- [--bots theory,maniac] [--hands 30] [--seed 0x…] [--out path] [--no-write] [--dry-run]`);
  }
  for (const b of a.bots) if (!POKER_BOTS[b]) throw new Error(`unknown bot ${JSON.stringify(b)}; choose from ${Object.keys(POKER_BOTS).join(", ")}`);
  if (a.bots[0] === a.bots[1]) throw new Error("pick two different bots");
  if (!Number.isInteger(a.hands) || a.hands < 1 || a.hands > 1000) throw new Error("--hands must be 1..1000");
  if (a.seed && !/^0x[0-9a-fA-F]{64}$/.test(a.seed)) throw new Error("--seed must be 0x + 64 hex (a matchId)");
  return a;
}

const unset = (name: string): boolean => !process.env[name]?.trim();

async function main(): Promise<void> {
  loadEnv();
  const args = parsePokerArgs(process.argv.slice(2));
  const deployments = readArcDeployments();
  const escrow = deployments.contracts.MatchEscrow.address;
  const offline = unset("REFEREE_PRIVATE_KEY");
  const refereeKey: Hex = offline ? generatePrivateKey() : requirePrivateKey("REFEREE_PRIVATE_KEY");
  const referee = offline ? privateKeyToAccount(refereeKey) : refereeAccount(deployments);
  const addr = (envKey: string): Address => (unset(envKey) ? privateKeyToAccount(generatePrivateKey()).address : privateKeyToAccount(requirePrivateKey(envKey)).address);
  const addresses: [Address, Address] = [addr("BOT_1_PRIVATE_KEY"), addr("BOT_2_PRIVATE_KEY")];
  const bots = [POKER_BOTS[args.bots[0]]!, POKER_BOTS[args.bots[1]]!] as const;
  const matchId = args.seed ?? toHex(randomBytes(32));

  console.log("BotBet — play-poker (heads-up limit Hold'em, offline, no chain)");
  if (offline) console.log("offline: ephemeral referee key — signature will NOT settle on MatchEscrow");
  console.log(`  matchId/seed ${matchId}`);
  console.log(`  bot A        ${bots[0].name} — ${addresses[0]}\n               ${bots[0].strategy}`);
  console.log(`  bot B        ${bots[1].name} — ${addresses[1]}\n               ${bots[1].strategy}`);
  console.log(`  hands        ${args.hands} (blinds 1/2, stacks 100, bets 2/4, cap 4)\n`);

  const o = playMatch({
    seed: matchId, bots, hands: args.hands,
    onHand: (n, h, chips) => {
      const who = h.winner === null ? "split" : bots[h.winner].name;
      const how = h.showdown ? `showdown [${h.board.map(cardStr).join(" ")}]` : "fold";
      console.log(`  #${String(n).padStart(2)} ${bots[0].name} ${h.hole[0].map(cardStr).join("")} vs ${bots[1].name} ${h.hole[1].map(cardStr).join("")}  pot ${String(h.pot).padStart(3)} → ${who.padEnd(7)} ${how.padEnd(36)} chips ${chips[0]}–${chips[1]}`);
    },
  });
  const winner = bots[o.winnerSeat];
  const finishedAt = Math.floor(Date.now() / 1000);
  const result: MatchResult = { matchId, winner: addresses[o.winnerSeat], moveCount: o.handsPlayed, pgnHash: o.handHistoryHash, finishedAt: BigInt(finishedAt) };
  const domain = matchDomain(deployments.chainId, escrow);
  const signature = await signMatchResult(refereeKey, domain, result);
  const recovered = await recoverMatchResultSigner(domain, result, signature);
  if (recovered.toLowerCase() !== referee.address.toLowerCase()) throw new Error("recovered signer does not match the signing key");

  console.log(`\nWinner: ${winner.name} ${o.chips[o.winnerSeat]}–${o.chips[o.winnerSeat === 0 ? 1 : 0]} chips after ${o.handsPlayed} hands${o.tiebreak !== "none" ? ` (tiebreak: ${o.tiebreak})` : ""}, ${o.elapsedMs} ms.`);
  console.log(`handHistoryHash (signed as pgnHash) ${o.handHistoryHash}`);
  console.log(`moveCount (hands) ${o.handsPlayed} · signature ${signature.slice(0, 18)}… recovers to ${recovered}`);

  if (args.write) {
    const json = pokerResultJson(o, { addresses, matchId, chainId: deployments.chainId, escrow, refereeAddress: referee.address, finishedAt, signature, offline });
    mkdirSync(dirname(args.out), { recursive: true });
    writeFileSync(args.out, `${JSON.stringify(json, null, 2)}\n`);
    console.log(`wrote ${args.out}`);
  }
  console.log("\nNothing was sent to the chain.");
}

if (process.argv[1] && /play-poker\.(ts|js)$/.test(process.argv[1])) {
  main().catch((e: unknown) => {
    console.error(`\nplay-poker failed: ${e instanceof Error ? e.message : String(e)}`);
    process.exitCode = 1;
  });
}
