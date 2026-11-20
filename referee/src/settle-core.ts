/**
 * The settle loop with every input injected, so the CLI (`settle.ts`, real Arc testnet from .env and
 * shared/deployments.json) and any rehearsal against a local chain run exactly the same code.
 *
 *   preflight → balances → createMatch (admin) → each bot approve → stake → play →
 *   referee signs EIP-712 → referee calls settle() → balances after → result.json
 *
 * Money: only the 6-decimal ERC-20 view of USDC, converted only through botbet-shared.
 */

import { randomBytes } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import {
  createPublicClient,
  createWalletClient,
  defineChain,
  erc20Abi,
  http,
  isAddressEqual,
  parseEventLogs,
  toHex,
  WaitForTransactionReceiptTimeoutError,
  type Abi,
  type Address,
  type Hash,
  type Hex,
  type PrivateKeyAccount,
  type TransactionReceipt,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { formatUsdc, toBaseUnits } from "botbet-shared";
import { BOTS, type BotConfig } from "./bots.js";
import { NotMinedError, SettleError, explain } from "./errors.js";
import { playGame, sides } from "./game.js";
import { hashPgn, matchDomain, recoverMatchResultSigner, signMatchResult, type MatchResult } from "./result.js";

/** Arc drops (silently) any tx whose maxFeePerGas is below this. Gas-price units (wei/gas), not USDC. */
export const MIN_BASE_FEE_WEI = 20_000_000_000n;
/**
 * Gas headroom per wallet, on the 6-decimal ERC-20 view. approve + stake costs well under 0.01 USDC
 * at Arc's fees; 0.05 leaves room for a fee spike without ever touching the 18-decimal view.
 */
export const GAS_BUFFER = toBaseUnits("0.05");
/** First wait for a receipt, then the total patience before giving up (non-zero exit). */
const RECEIPT_FIRST_WAIT_MS = 60_000;
const RECEIPT_TOTAL_WAIT_MS = 180_000;
const STATUS = ["None", "Open", "Funded", "Settled"] as const;
const TOTAL_STEPS = 11;

export interface SettleConfig {
  rpcUrl: string;
  chainId: number;
  escrow: Address;
  escrowAbi: Abi;
  usdc: Address;
  /** No trailing slash. */
  explorerBaseUrl: string;
  /** Where result.json goes. */
  outPath: string;
  adminKey: Hex;
  refereeKey: Hex;
  /** Keyed by BotConfig.id. */
  botKeys: Record<string, Hex>;
  stake: bigint;
  startFen?: string;
  dryRun?: boolean;
  /** Human progress output. The CLI sends it to stderr under --json so stdout stays clean. */
  log?: (line: string) => void;
}

export interface SettleSummary {
  ok: true;
  dryRun: boolean;
  chainId: number;
  escrow: Address;
  matchId: Hex;
  stakeUsdc: string;
  potUsdc: string;
  startFen: string | null;
  winner?: Address;
  winnerId?: string;
  plies?: number;
  txs?: Record<string, { hash: Hash; url: string }>;
  balances: Record<string, { address: Address; label: string; before: string; after?: string }>;
  resultPath?: string;
}

/** Thrown from runSettle with the step it died in, for the CLI's ❌ line and --json. */
export class StepFailure extends Error {
  constructor(readonly step: string, readonly cause: SettleError) {
    super(cause.message);
    this.name = "StepFailure";
  }
}

interface MatchView {
  botA: Address;
  botB: Address;
  stakeAmount: bigint;
  stakedA: boolean;
  stakedB: boolean;
  status: number;
}

const usdc6 = (amount: bigint) => formatUsdc(amount, { decimals: 6 });

export async function runSettle(cfg: SettleConfig): Promise<SettleSummary> {
  const log = cfg.log ?? ((line: string) => console.log(line));
  const txUrl = (hash: Hash) => `${cfg.explorerBaseUrl}/tx/${hash}`;
  const addrUrl = (address: Address) => `${cfg.explorerBaseUrl}/address/${address}`;

  let stepNo = 0;
  let currentStep = "setup";
  const step = (label: string) => {
    stepNo += 1;
    currentStep = label;
    log(`\n[${stepNo}/${TOTAL_STEPS}] ${label}`);
  };
  const ok = (line: string) => log(`  ✅ ${line}`);
  const info = (line: string) => log(`     ${line}`);

  /** Run one unit of work; any failure becomes a StepFailure with a one-line explanation. */
  async function guard<T>(what: string, fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      if (error instanceof StepFailure) throw error;
      throw new StepFailure(currentStep, explain(error, cfg.rpcUrl, what));
    }
  }
  const fail = (message: string, hint?: string): never => {
    throw new StepFailure(currentStep, new SettleError(message, hint));
  };

  const admin = privateKeyToAccount(cfg.adminKey);
  const referee = privateKeyToAccount(cfg.refereeKey);
  const bots = BOTS.map((bot) => {
    const key = cfg.botKeys[bot.id];
    if (!key) fail(`no key configured for bot ${bot.id}`);
    return { bot, account: privateKeyToAccount(key!) };
  });
  const accountOf = (bot: BotConfig) => bots.find((b) => b.bot.id === bot.id)!.account;
  const { white, black } = sides();

  const chain = defineChain({
    id: cfg.chainId,
    name: `chain-${cfg.chainId}`,
    nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 }, // gas accounting only; never read
    rpcUrls: { default: { http: [cfg.rpcUrl] } },
  });
  const transport = http(cfg.rpcUrl, { retryCount: 2, timeout: 20_000 });
  const publicClient = createPublicClient({ chain, transport });
  const wallet = (account: PrivateKeyAccount) => createWalletClient({ account, chain, transport });
  const read = <T>(functionName: string, args: readonly unknown[] = []) =>
    publicClient.readContract({ address: cfg.escrow, abi: cfg.escrowAbi, functionName, args }) as Promise<T>;
  const balanceOf = (address: Address) =>
    publicClient.readContract({ address: cfg.usdc, abi: erc20Abi, functionName: "balanceOf", args: [address] });

  // ── 1. Preflight ────────────────────────────────────────────────────────────────────────────
  step("Preflight: chain, escrow, keys");
  const rpcChainId = await guard("reading chain ID", () => publicClient.getChainId());
  if (rpcChainId !== cfg.chainId) {
    fail(`RPC ${cfg.rpcUrl} reports chain ${rpcChainId}; expected ${cfg.chainId}. Refusing to send.`, "Check ARC_RPC_URL.");
  }
  ok(`chain ${rpcChainId} via ${cfg.rpcUrl}`);

  const [onChainReferee, onChainAdmin, onChainUsdc, maxStake, domainTuple] = await guard("reading MatchEscrow", () =>
    Promise.all([
      read<Address>("referee"),
      read<Address>("admin"),
      read<Address>("usdc"),
      read<bigint>("MAX_STAKE"),
      read<readonly [Hex, string, string, bigint, Address, Hex, readonly bigint[]]>("eip712Domain"),
    ]),
  );
  const [, domainName, domainVersion, domainChainId, domainContract] = domainTuple;
  const domain = matchDomain(cfg.chainId, cfg.escrow);

  const checks: [string, boolean, string][] = [
    ["referee() = REFEREE key", isAddressEqual(onChainReferee, referee.address), `${onChainReferee} vs key ${referee.address}`],
    ["admin() = DEPLOYER key", isAddressEqual(onChainAdmin, admin.address), `${onChainAdmin} vs key ${admin.address}`],
    ["usdc() = configured USDC", isAddressEqual(onChainUsdc, cfg.usdc), `${onChainUsdc}`],
    [
      "EIP-712 domain",
      domainName === domain.name &&
        domainVersion === domain.version &&
        domainChainId === BigInt(cfg.chainId) &&
        isAddressEqual(domainContract, cfg.escrow),
      `${domainName}/${domainVersion} chain ${domainChainId} contract ${domainContract}`,
    ],
    ["0 < stake ≤ MAX_STAKE", cfg.stake > 0n && cfg.stake <= maxStake, `${usdc6(cfg.stake)} (max ${formatUsdc(maxStake, { decimals: 0 })})`],
    ["bots distinct", !isAddressEqual(bots[0]!.account.address, bots[1]!.account.address), `${bots[0]!.account.address} / ${bots[1]!.account.address}`],
  ];
  for (const [name, passed, detail] of checks) log(`  ${passed ? "✅" : "❌"} ${name.padEnd(25)} ${detail}`);
  const failedChecks = checks.filter(([, passed]) => !passed).map(([name]) => name);

  // Fees: Arc silently drops a tx below the 20 gwei minimum base fee, so pin it explicitly.
  const estimated = await guard("estimating fees", () => publicClient.estimateFeesPerGas());
  const floor = MIN_BASE_FEE_WEI * 2n;
  const maxFeePerGas = estimated.maxFeePerGas < floor ? floor : estimated.maxFeePerGas;
  const maxPriorityFeePerGas = estimated.maxPriorityFeePerGas > maxFeePerGas ? maxFeePerGas : estimated.maxPriorityFeePerGas;
  const fees = { maxFeePerGas, maxPriorityFeePerGas };
  info(`fees: maxFeePerGas ${maxFeePerGas} wei/gas (Arc floor ${MIN_BASE_FEE_WEI}), priority ${maxPriorityFeePerGas}`);

  // ── 2. Balances (6-decimal ERC-20 view) ─────────────────────────────────────────────────────
  step(`Balances on the ERC-20 view (${cfg.usdc}, 6 decimals)`);
  const need = new Map<Address, { label: string; need: bigint; ids: string[] }>([
    [admin.address, { label: "admin (createMatch gas)", need: GAS_BUFFER, ids: ["admin"] }],
  ]);
  const addNeed = (address: Address, label: string, amount: bigint, id: string) => {
    const prev = need.get(address);
    need.set(address, {
      label: prev ? `${prev.label} + ${label}` : label,
      need: (prev?.need ?? 0n) + amount,
      ids: [...(prev?.ids ?? []), id],
    });
  };
  addNeed(referee.address, "referee (settle gas)", GAS_BUFFER, "referee");
  for (const { bot, account } of bots) addNeed(account.address, `${bot.name} (stake + gas)`, cfg.stake + GAS_BUFFER, bot.id);

  const before = new Map<Address, bigint>();
  const short: string[] = [];
  for (const [address, { label, need: required }] of need) {
    const balance = await guard(`reading the USDC balance of ${address}`, () => balanceOf(address));
    before.set(address, balance);
    const enough = balance >= required;
    log(`  ${enough ? "✅" : "❌"} ${address}  ${usdc6(balance).padStart(16)}  needs ${usdc6(required).padEnd(15)} ${label}`);
    if (!enough) short.push(`${address} (${label}): has ${usdc6(balance)}, needs ${usdc6(required)}`);
  }

  if (failedChecks.length || short.length) {
    const lines = [
      ...failedChecks.map((name) => `preflight check failed: ${name}`),
      ...short.map((line) => `insufficient USDC: ${line}`),
    ];
    fail(
      lines.join("\n     "),
      short.length ? "Fund the address(es) above at https://faucet.circle.com (Arc Testnet, 20 USDC per address per 2 h)." : undefined,
    );
  }

  // ── 3. Plan ─────────────────────────────────────────────────────────────────────────────────
  const matchId = toHex(randomBytes(32));
  step("Plan");
  info(`escrow   ${cfg.escrow}  ${addrUrl(cfg.escrow)}`);
  info(`admin    ${admin.address}  → createMatch`);
  info(`referee  ${referee.address}  → sign + settle`);
  info(`white    ${white.name} (depth ${white.depth})  ${accountOf(white).address}  → approve + stake`);
  info(`black    ${black.name} (depth ${black.depth})  ${accountOf(black).address}  → approve + stake`);
  info(`stake    ${usdc6(cfg.stake)} per bot (${cfg.stake} base units), pot ${usdc6(cfg.stake * 2n)}`);
  info(`matchId  ${matchId} (fresh)`);
  info(`start    ${cfg.startFen ? `FEN ${cfg.startFen}` : "standard position"}`);

  const balanceSummary = (after?: Map<Address, bigint>) =>
    Object.fromEntries(
      [...need].flatMap(([address, { label, ids }]) =>
        ids.map((id) => [
          id,
          { address, label, before: before.get(address)!.toString(), ...(after ? { after: after.get(address)!.toString() } : {}) },
        ]),
      ),
    );
  const base = {
    ok: true as const,
    chainId: cfg.chainId,
    escrow: cfg.escrow,
    matchId,
    stakeUsdc: cfg.stake.toString(),
    potUsdc: (cfg.stake * 2n).toString(),
    startFen: cfg.startFen ?? null,
  };

  if (cfg.dryRun) {
    log("\n✅ Dry run: every check passed. Nothing was sent.");
    return { ...base, dryRun: true, balances: balanceSummary() };
  }

  /** Wait for a receipt: 60 s, then keep waiting to 3 min total with the link printed, then give up. */
  async function waitMined(hash: Hash): Promise<TransactionReceipt> {
    try {
      return await publicClient.waitForTransactionReceipt({ hash, timeout: RECEIPT_FIRST_WAIT_MS });
    } catch (error) {
      if (!(error instanceof WaitForTransactionReceiptTimeoutError)) throw error;
      log(`  ⏳ not mined after ${RECEIPT_FIRST_WAIT_MS / 1000}s: ${txUrl(hash)} — waiting up to ${RECEIPT_TOTAL_WAIT_MS / 1000}s`);
    }
    try {
      return await publicClient.waitForTransactionReceipt({ hash, timeout: RECEIPT_TOTAL_WAIT_MS - RECEIPT_FIRST_WAIT_MS });
    } catch (error) {
      if (error instanceof WaitForTransactionReceiptTimeoutError) throw new NotMinedError(hash, txUrl(hash), RECEIPT_TOTAL_WAIT_MS / 1000);
      throw error;
    }
  }

  /** Simulate (decodes custom-error reverts before spending gas), send, wait, verify success. */
  async function send(label: string, account: PrivateKeyAccount, address: Address, abi: Abi, functionName: string, args: readonly unknown[]) {
    return guard(label, async () => {
      const { request } = await publicClient.simulateContract({ account, address, abi, functionName, args, ...fees });
      const hash = await wallet(account).writeContract(request);
      info(`${label} sent ${hash}`);
      const receipt = await waitMined(hash);
      if (receipt.status !== "success") {
        // Re-run the call at the mined block to recover the custom error name for the report.
        let reason = "no reason recovered";
        try {
          await publicClient.simulateContract({ account, address, abi, functionName, args, blockNumber: receipt.blockNumber - 1n });
        } catch (error) {
          reason = explain(error, cfg.rpcUrl, label).message;
        }
        throw new SettleError(`${label} reverted on-chain (${reason}): ${txUrl(hash)}`);
      }
      ok(`${label}  block ${receipt.blockNumber}  ${txUrl(hash)}`);
      return { hash, receipt };
    });
  }

  const txs: Record<string, { hash: Hash; url: string }> = {};
  const record = (key: string, hash: Hash) => (txs[key] = { hash, url: txUrl(hash) });

  // ── 4. createMatch ──────────────────────────────────────────────────────────────────────────
  step("createMatch (admin)");
  const created = await send("createMatch", admin, cfg.escrow, cfg.escrowAbi, "createMatch", [
    matchId,
    accountOf(white).address,
    accountOf(black).address,
    cfg.stake,
  ]);
  record("createMatch", created.hash);

  // ── 5–6. approve → stake, per bot ───────────────────────────────────────────────────────────
  const botTxs = new Map<string, { approve: Hash; stake: Hash }>();
  for (const { bot, account } of [{ bot: white, account: accountOf(white) }, { bot: black, account: accountOf(black) }]) {
    step(`${bot.name}: approve → stake ${usdc6(cfg.stake)}`);
    const approve = await send("approve", account, cfg.usdc, erc20Abi as Abi, "approve", [cfg.escrow, cfg.stake]);
    const staked = await send("stake", account, cfg.escrow, cfg.escrowAbi, "stake", [matchId]);
    botTxs.set(bot.id, { approve: approve.hash, stake: staked.hash });
    record(`${bot.id}.approve`, approve.hash);
    record(`${bot.id}.stake`, staked.hash);
  }
  const funded = await guard("reading the match", () => read<MatchView>("getMatch", [matchId]));
  if (STATUS[funded.status] !== "Funded") fail(`match is ${STATUS[funded.status]} after both stakes; expected Funded.`);
  ok(`match Funded: the escrow holds the ${usdc6(funded.stakeAmount * 2n)} pot`);

  // ── 7. play ─────────────────────────────────────────────────────────────────────────────────
  step(`Play: ${white.name} (white) vs ${black.name} (black)`);
  const startedAt = Date.now();
  const outcome = await guard("playing the game", () =>
    playGame({
      startFen: cfg.startFen,
      onMove: ({ ply, san, bot, elapsedMs }) => {
        info(`ply ${String(ply).padStart(3)}  ${san.padEnd(8)} ${bot.name.padEnd(13)} ${(elapsedMs / 1000).toFixed(1)}s`);
      },
    }),
  );
  const winnerAddress = accountOf(outcome.winner).address;
  ok(`checkmate: ${outcome.winner.name} wins in ${outcome.moveCount} plies (${((Date.now() - startedAt) / 1000).toFixed(0)}s)`);

  // ── 8. sign ─────────────────────────────────────────────────────────────────────────────────
  step("Referee signs the MatchResult (EIP-712)");
  const result: MatchResult = {
    matchId,
    winner: winnerAddress,
    moveCount: outcome.moveCount,
    pgnHash: hashPgn(outcome.pgn),
    finishedAt: BigInt(outcome.finishedAt),
  };
  const signature = await signMatchResult(cfg.refereeKey, domain, result);
  const recovered = await recoverMatchResultSigner(domain, result, signature);
  if (!isAddressEqual(recovered, onChainReferee)) {
    fail(`signature recovers to ${recovered}, but the escrow trusts ${onChainReferee}; settle would revert InvalidSignature.`);
  }
  ok(`signature recovers to the on-chain referee ${recovered}`);

  // ── 9. settle ───────────────────────────────────────────────────────────────────────────────
  step("settle (referee) pays the winner");
  const settled = await send("settle", referee, cfg.escrow, cfg.escrowAbi, "settle", [matchId, result, signature]);
  record("settle", settled.hash);
  // Filter by emitter: Arc also emits system Transfer logs, and only the escrow's Settled counts.
  const settledEvent = parseEventLogs({ abi: cfg.escrowAbi, eventName: "Settled", logs: settled.receipt.logs }).find((l) =>
    isAddressEqual(l.address, cfg.escrow),
  ) as { args: { winner: Address; payout: bigint } } | undefined;
  if (!settledEvent) fail(`settle mined but emitted no Settled event from ${cfg.escrow}: ${txUrl(settled.hash)}`);
  ok(`Settled event: ${usdc6(settledEvent!.args.payout)} → ${settledEvent!.args.winner} (${outcome.winner.name})`);

  // ── 10. balances after ──────────────────────────────────────────────────────────────────────
  step("Balances before → after (ERC-20 view)");
  const after = new Map<Address, bigint>();
  for (const [address, { label }] of need) {
    const balance = await guard(`reading the USDC balance of ${address}`, () => balanceOf(address));
    after.set(address, balance);
    const delta = balance - before.get(address)!;
    info(`${label.padEnd(30)} ${usdc6(before.get(address)!).padStart(16)} → ${usdc6(balance).padStart(16)}  (${delta >= 0n ? "+" : ""}${usdc6(delta)})`);
  }

  // ── 11. result.json (schema v1, interfaces.md section 3) ────────────────────────────────────
  step("Write result.json");
  const finishedAt = outcome.finishedAt;
  const json = {
    version: 1,
    chainId: cfg.chainId,
    escrow: cfg.escrow,
    usdc: cfg.usdc,
    explorerBaseUrl: cfg.explorerBaseUrl,
    matchId,
    stakeUsdc: cfg.stake.toString(),
    potUsdc: (cfg.stake * 2n).toString(),
    bots: [white, black].map((bot) => ({
      id: bot.id,
      name: bot.name,
      address: accountOf(bot).address,
      depth: bot.depth,
      color: bot === white ? "white" : "black",
      approveTxHash: botTxs.get(bot.id)!.approve,
      stakeTxHash: botTxs.get(bot.id)!.stake,
    })),
    winner: winnerAddress,
    winnerId: outcome.winner.id,
    plies: outcome.moveCount,
    pgn: outcome.pgn,
    result: { matchId, winner: winnerAddress, moveCount: outcome.moveCount, pgnHash: result.pgnHash, finishedAt },
    signature,
    createMatchTxHash: created.hash,
    settleTxHash: settled.hash,
    balances: {
      before: Object.fromEntries(bots.map(({ bot, account }) => [bot.id, before.get(account.address)!.toString()])),
      after: Object.fromEntries(bots.map(({ bot, account }) => [bot.id, after.get(account.address)!.toString()])),
    },
    finishedAt,
  };
  mkdirSync(dirname(cfg.outPath), { recursive: true });
  writeFileSync(cfg.outPath, `${JSON.stringify(json, null, 2)}\n`);
  ok(`wrote ${cfg.outPath}`);
  log(`\n✅ SETTLED  ${txUrl(settled.hash)}`);

  return {
    ...base,
    dryRun: false,
    winner: winnerAddress,
    winnerId: outcome.winner.id,
    plies: outcome.moveCount,
    txs,
    balances: balanceSummary(after),
    resultPath: cfg.outPath,
  };
}
