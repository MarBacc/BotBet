/**
 * `npm run settle` — the whole on-chain loop. See interfaces.md section 3.
 *
 *   preflight (chain, escrow immutables, keys, balances) → createMatch (admin) →
 *   each bot approve → stake → play → referee signs EIP-712 → referee calls settle() →
 *   balances after → web/public/result.json
 *
 * Flags:
 *   --fen "<FEN>"   start the game from this position (demo mode). Default: the normal start.
 *   --dry-run       run every read-only check and print the plan; send nothing.
 *
 * Env: REFEREE_PRIVATE_KEY, DEPLOYER_PRIVATE_KEY (the escrow admin; createMatch is admin-only),
 * BOT_1_PRIVATE_KEY, BOT_2_PRIVATE_KEY; optional ARC_RPC_URL, STAKE_USDC (human, default "2").
 * Keys are never printed — only the addresses derived from them.
 *
 * Money: only the 6-decimal ERC-20 view at 0x3600…0000, converted only through botbet-shared.
 */

import { randomBytes } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import {
  createPublicClient,
  createWalletClient,
  defineChain,
  erc20Abi,
  http,
  isAddressEqual,
  parseEventLogs,
  toHex,
  type Abi,
  type Address,
  type Hash,
  type Hex,
  type PrivateKeyAccount,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { formatUsdc, toBaseUnits } from "botbet-shared";
import { BOTS, type BotConfig } from "./bots.js";
import { ARC_TESTNET_CHAIN_ID, REPO_ROOT, loadEnv, readArcDeployments, refereeAccount, requirePrivateKey } from "./env.js";
import { playGame, sides } from "./game.js";
import { hashPgn, matchDomain, recoverMatchResultSigner, signMatchResult, type MatchResult } from "./result.js";

/** From docs/arc.md. No trailing slash. */
const DEFAULT_RPC_URL = "https://rpc.testnet.arc.io";
const EXPLORER_BASE_URL = "https://explorer.testnet.arc.io";
/** Arc drops (silently) any tx whose maxFeePerGas is below this. Gas-price units (wei/gas), not USDC. */
const MIN_BASE_FEE_WEI = 20_000_000_000n;
/**
 * Gas headroom per wallet, on the 6-decimal ERC-20 view. An approve + stake costs well under
 * 0.01 USDC at Arc's fees; 0.05 leaves room for a fee spike without touching the 18-decimal view.
 */
const GAS_BUFFER = toBaseUnits("0.05");
const DEFAULT_STAKE = "2";
const RECEIPT_TIMEOUT_MS = 90_000;
const STATUS = ["None", "Open", "Funded", "Settled"] as const;

interface Args {
  fen?: string;
  dryRun: boolean;
}

function parseArgs(argv: string[]): Args {
  const args: Args = { dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg === "--dry-run") args.dryRun = true;
    else if (arg === "--fen") {
      const value = argv[++i];
      if (!value) throw new Error('--fen needs a value: --fen "<FEN>"');
      args.fen = value;
    } else if (arg.startsWith("--fen=")) args.fen = arg.slice("--fen=".length);
    else throw new Error(`unknown argument ${JSON.stringify(arg)}. Usage: npm run settle -- [--fen "<FEN>"] [--dry-run]`);
  }
  return args;
}

const tx = (hash: Hash) => `${EXPLORER_BASE_URL}/tx/${hash}`;
const addr = (address: Address) => `${EXPLORER_BASE_URL}/address/${address}`;
const step = (label: string) => console.log(`\n▸ ${label}`);

interface MatchView {
  botA: Address;
  botB: Address;
  stakeAmount: bigint;
  stakedA: boolean;
  stakedB: boolean;
  status: number;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  loadEnv();

  // ── Preflight: local config ────────────────────────────────────────────────────────────────
  const deployments = readArcDeployments();
  const escrow = deployments.contracts.MatchEscrow.address;
  const escrowAbi = deployments.contracts.MatchEscrow.abi as Abi;
  const usdc = deployments.usdc;
  const referee = refereeAccount(deployments); // throws unless it derives to the deployed referee
  const refereeKey = requirePrivateKey("REFEREE_PRIVATE_KEY");
  const admin = privateKeyToAccount(requirePrivateKey("DEPLOYER_PRIVATE_KEY"));
  const bots = BOTS.map((bot) => ({ bot, account: privateKeyToAccount(requirePrivateKey(bot.envKey)) }));
  const stake = toBaseUnits(process.env.STAKE_USDC?.trim() || DEFAULT_STAKE);
  const rpcUrl = process.env.ARC_RPC_URL?.trim() || DEFAULT_RPC_URL;

  const chain = defineChain({
    id: ARC_TESTNET_CHAIN_ID,
    name: "Arc Testnet",
    nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 }, // gas accounting only; never read
    rpcUrls: { default: { http: [rpcUrl] } },
    blockExplorers: { default: { name: "Arc Explorer", url: EXPLORER_BASE_URL } },
  });
  const publicClient = createPublicClient({ chain, transport: http(rpcUrl) });
  const wallet = (account: PrivateKeyAccount) => createWalletClient({ account, chain, transport: http(rpcUrl) });

  console.log("BotBet — settle (Arc testnet, real transactions)");

  // ── Preflight: chain and escrow immutables ────────────────────────────────────────────────
  step("Preflight");
  const rpcChainId = await publicClient.getChainId();
  if (rpcChainId !== ARC_TESTNET_CHAIN_ID) {
    throw new Error(`RPC ${rpcUrl} reports chain ${rpcChainId}; expected Arc testnet ${ARC_TESTNET_CHAIN_ID}. Refusing to send.`);
  }
  const read = <T>(functionName: string, fnArgs: readonly unknown[] = []) =>
    publicClient.readContract({ address: escrow, abi: escrowAbi, functionName, args: fnArgs }) as Promise<T>;
  const [onChainReferee, onChainAdmin, onChainUsdc, maxStake, domainTuple] = await Promise.all([
    read<Address>("referee"),
    read<Address>("admin"),
    read<Address>("usdc"),
    read<bigint>("MAX_STAKE"),
    read<readonly [Hex, string, string, bigint, Address, Hex, readonly bigint[]]>("eip712Domain"),
  ]);
  const [, domainName, domainVersion, domainChainId, domainContract] = domainTuple;
  const domain = matchDomain(ARC_TESTNET_CHAIN_ID, escrow);

  const checks: [string, boolean, string][] = [
    ["referee() = referee key", isAddressEqual(onChainReferee, referee.address), `${onChainReferee} vs key ${referee.address}`],
    ["admin() = DEPLOYER key", isAddressEqual(onChainAdmin, admin.address), `${onChainAdmin} vs key ${admin.address}`],
    ["usdc() = deployments.usdc", isAddressEqual(onChainUsdc, usdc), `${onChainUsdc}`],
    [
      "EIP-712 domain",
      domainName === domain.name &&
        domainVersion === domain.version &&
        domainChainId === BigInt(ARC_TESTNET_CHAIN_ID) &&
        isAddressEqual(domainContract, escrow),
      `${domainName}/${domainVersion} chain ${domainChainId} contract ${domainContract}`,
    ],
    ["stake ≤ MAX_STAKE", stake > 0n && stake <= maxStake, `${formatUsdc(stake, { decimals: 6 })} ≤ ${formatUsdc(maxStake, { decimals: 0 })}`],
    ["bots distinct", !isAddressEqual(bots[0]!.account.address, bots[1]!.account.address), ""],
  ];
  for (const [name, ok, detail] of checks) console.log(`  ${ok ? "OK  " : "FAIL"} ${name.padEnd(26)} ${detail}`);
  const failed = checks.filter(([, ok]) => !ok);
  if (failed.length) throw new Error(`preflight failed: ${failed.map(([n]) => n).join(", ")}`);

  // Fees: Arc silently drops a tx below the 20 gwei minimum base fee, so pin it explicitly.
  const estimated = await publicClient.estimateFeesPerGas();
  const maxFeePerGas = estimated.maxFeePerGas < MIN_BASE_FEE_WEI * 2n ? MIN_BASE_FEE_WEI * 2n : estimated.maxFeePerGas;
  const maxPriorityFeePerGas = estimated.maxPriorityFeePerGas > maxFeePerGas ? maxFeePerGas : estimated.maxPriorityFeePerGas;
  const fees = { maxFeePerGas, maxPriorityFeePerGas };
  console.log(`  fees       maxFeePerGas ${maxFeePerGas} wei/gas (floor ${MIN_BASE_FEE_WEI}), priority ${maxPriorityFeePerGas}`);

  const balanceOf = (account: Address) =>
    publicClient.readContract({ address: usdc, abi: erc20Abi, functionName: "balanceOf", args: [account] });

  // ── Balance check (6-decimal ERC-20 view) ─────────────────────────────────────────────────
  step(`Balances (ERC-20 view at ${usdc}, 6 decimals)`);
  const need = new Map<Address, { label: string; need: bigint }>([
    [admin.address, { label: "admin/deployer (createMatch gas)", need: GAS_BUFFER }],
    [referee.address, { label: "referee (settle gas)", need: GAS_BUFFER }],
  ]);
  for (const { bot, account } of bots) {
    const prev = need.get(account.address);
    need.set(account.address, {
      label: prev ? `${prev.label} + ${bot.name}` : `bot ${bot.id} (${bot.name})`,
      need: (prev?.need ?? 0n) + stake + GAS_BUFFER,
    });
  }
  const before = new Map<Address, bigint>();
  const short: string[] = [];
  for (const [address, { label, need: required }] of need) {
    const balance = await balanceOf(address);
    before.set(address, balance);
    const ok = balance >= required;
    console.log(`  ${ok ? "OK   " : "SHORT"} ${address}  ${formatUsdc(balance, { decimals: 6 }).padStart(18)}  need ${formatUsdc(required, { decimals: 6 })}  ${label}`);
    if (!ok) short.push(`  ${address}  (${label}) has ${formatUsdc(balance, { decimals: 6 })}, needs ${formatUsdc(required, { decimals: 6 })}`);
  }
  if (short.length) {
    throw new Error(
      `insufficient USDC. Fund these at https://faucet.circle.com (pick Arc Testnet, 20 USDC / address / 2 h):\n${short.join("\n")}`,
    );
  }

  const matchId = toHex(randomBytes(32));
  const { white, black } = sides();
  const accountOf = (bot: BotConfig) => bots.find((b) => b.bot.id === bot.id)!.account;

  step("Plan");
  console.log(`  chain      ${rpcChainId} via ${rpcUrl}`);
  console.log(`  escrow     ${escrow}  ${addr(escrow)}`);
  console.log(`  usdc       ${usdc}`);
  console.log(`  admin      ${admin.address}  → createMatch`);
  console.log(`  referee    ${referee.address}  → sign + settle`);
  console.log(`  white      ${white.name} (depth ${white.depth})  ${accountOf(white).address}  → approve + stake`);
  console.log(`  black      ${black.name} (depth ${black.depth})  ${accountOf(black).address}  → approve + stake`);
  console.log(`  stake      ${formatUsdc(stake, { decimals: 6 })} per bot (${stake} base units), pot ${formatUsdc(stake * 2n, { decimals: 6 })}`);
  console.log(`  matchId    ${matchId} (fresh)`);
  console.log(`  start      ${args.fen ? `FEN ${args.fen}` : "standard position"}`);

  if (args.dryRun) {
    console.log("\nDry run: all checks passed, nothing was sent.");
    return;
  }

  /** Send, wait for the receipt, and refuse to continue on a revert or a silent drop. */
  async function send(label: string, account: PrivateKeyAccount, functionName: string, address: Address, abi: Abi, fnArgs: readonly unknown[]) {
    const { request } = await publicClient.simulateContract({ account, address, abi, functionName, args: fnArgs, ...fees });
    const hash = await wallet(account).writeContract(request);
    console.log(`  ${label.padEnd(22)} ${hash}`);
    const receipt = await publicClient.waitForTransactionReceipt({ hash, timeout: RECEIPT_TIMEOUT_MS });
    if (receipt.status !== "success") throw new Error(`${label} reverted: ${tx(hash)}`);
    console.log(`  ${"".padEnd(22)} block ${receipt.blockNumber}  ${tx(hash)}`);
    return { hash, receipt };
  }

  // ── createMatch ───────────────────────────────────────────────────────────────────────────
  step("createMatch (admin)");
  const created = await send("createMatch", admin, "createMatch", escrow, escrowAbi, [
    matchId,
    accountOf(white).address,
    accountOf(black).address,
    stake,
  ]);

  // ── approve → stake, per bot ──────────────────────────────────────────────────────────────
  const txs = new Map<string, { approve: Hash; stake: Hash }>();
  for (const { bot, account } of bots) {
    step(`${bot.name}: approve → stake`);
    const approve = await send("approve", account, "approve", usdc, erc20Abi as Abi, [escrow, stake]);
    const staked = await send("stake", account, "stake", escrow, escrowAbi, [matchId]);
    txs.set(bot.id, { approve: approve.hash, stake: staked.hash });
  }

  const funded = await read<MatchView>("getMatch", [matchId]);
  if (STATUS[funded.status] !== "Funded") throw new Error(`match is ${STATUS[funded.status]} after both stakes; expected Funded.`);
  console.log(`\n  match status: Funded, pot ${formatUsdc(funded.stakeAmount * 2n, { decimals: 6 })} held by the escrow`);

  // ── play ──────────────────────────────────────────────────────────────────────────────────
  step(`Play: ${white.name} (white) vs ${black.name} (black)`);
  const startedAt = Date.now();
  const outcome = await playGame({
    startFen: args.fen,
    onMove: ({ ply, san, bot, elapsedMs }) => {
      console.log(`  ply ${String(ply).padStart(3)}  ${san.padEnd(8)} ${bot.name.padEnd(13)} ${(elapsedMs / 1000).toFixed(1)}s`);
    },
  });
  const winnerAddress = accountOf(outcome.winner).address;
  console.log(`  checkmate: ${outcome.winner.name} wins in ${outcome.moveCount} plies (${((Date.now() - startedAt) / 1000).toFixed(0)}s)`);

  // ── sign ──────────────────────────────────────────────────────────────────────────────────
  step("Referee signs the MatchResult (EIP-712)");
  const result: MatchResult = {
    matchId,
    winner: winnerAddress,
    moveCount: outcome.moveCount,
    pgnHash: hashPgn(outcome.pgn),
    finishedAt: BigInt(outcome.finishedAt),
  };
  const signature = await signMatchResult(refereeKey, domain, result);
  const recovered = await recoverMatchResultSigner(domain, result, signature);
  if (!isAddressEqual(recovered, onChainReferee)) {
    throw new Error(`signature recovers to ${recovered}, escrow trusts ${onChainReferee}; settle would revert.`);
  }
  console.log(`  signature recovers to the on-chain referee ${recovered}`);

  // ── settle ────────────────────────────────────────────────────────────────────────────────
  step("settle (referee)");
  const settled = await send("settle", referee, "settle", escrow, escrowAbi, [matchId, result, signature]);
  const settledEvent = parseEventLogs({ abi: escrowAbi, eventName: "Settled", logs: settled.receipt.logs }).find((log) =>
    isAddressEqual(log.address, escrow),
  ) as { args: { winner: Address; payout: bigint } } | undefined;
  if (!settledEvent) throw new Error(`settle mined but no Settled event from ${escrow}: ${tx(settled.hash)}`);
  console.log(`  Settled: ${formatUsdc(settledEvent.args.payout, { decimals: 6 })} → ${settledEvent.args.winner}`);

  // ── balances after ────────────────────────────────────────────────────────────────────────
  step("Balances before → after (ERC-20 view)");
  const after = new Map<Address, bigint>();
  for (const address of need.keys()) {
    const balance = await balanceOf(address);
    after.set(address, balance);
    const delta = balance - before.get(address)!;
    console.log(
      `  ${address}  ${formatUsdc(before.get(address)!, { decimals: 6 }).padStart(18)} → ${formatUsdc(balance, { decimals: 6 }).padStart(18)}  (${delta >= 0n ? "+" : ""}${formatUsdc(delta, { decimals: 6 })})  ${need.get(address)!.label}`,
    );
  }

  // ── web/public/result.json (schema v1, interfaces.md section 3) ───────────────────────────
  const finishedAt = outcome.finishedAt;
  const json = {
    version: 1,
    chainId: ARC_TESTNET_CHAIN_ID,
    escrow,
    usdc,
    explorerBaseUrl: EXPLORER_BASE_URL,
    matchId,
    stakeUsdc: stake.toString(),
    potUsdc: (stake * 2n).toString(),
    bots: [white, black].map((bot) => ({
      id: bot.id,
      name: bot.name,
      address: accountOf(bot).address,
      depth: bot.depth,
      color: bot === white ? "white" : "black",
      approveTxHash: txs.get(bot.id)!.approve,
      stakeTxHash: txs.get(bot.id)!.stake,
    })),
    winner: winnerAddress,
    winnerId: outcome.winner.id,
    plies: outcome.moveCount,
    pgn: outcome.pgn,
    result: {
      matchId,
      winner: winnerAddress,
      moveCount: outcome.moveCount,
      pgnHash: result.pgnHash,
      finishedAt,
    },
    signature,
    createMatchTxHash: created.hash,
    settleTxHash: settled.hash,
    balances: {
      before: Object.fromEntries(bots.map(({ bot, account }) => [bot.id, before.get(account.address)!.toString()])),
      after: Object.fromEntries(bots.map(({ bot, account }) => [bot.id, after.get(account.address)!.toString()])),
    },
    finishedAt,
  };
  const outPath = resolve(REPO_ROOT, "web", "public", "result.json");
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, `${JSON.stringify(json, null, 2)}\n`);

  console.log(`\nWrote ${outPath}`);
  console.log(`Settle tx: ${tx(settled.hash)}`);
}

main().catch((error: unknown) => {
  console.error(`\nsettle failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
