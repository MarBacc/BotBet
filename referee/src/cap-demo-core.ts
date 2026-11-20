/**
 * The AgentWallet cap demo with every input injected, so `npm run cap-demo` (Arc testnet) and the
 * local rehearsal (anvil, the real AgentWallet bytecode) run the same code. interfaces.md §6.
 *
 *   1. read the wallet: owner, cap, token, balance
 *   2. pay 0.02 USDC UNDER the cap: simulate → send → receipt (skipped under dryRun)
 *   3. simulate 0.10 USDC OVER the cap: expect CapExceeded(amount, cap); costs no gas, moves nothing
 *   4. write cap-demo.json (skipped under dryRun)
 */

import { writeFileSync } from "node:fs";
import {
  createPublicClient,
  createWalletClient,
  defineChain,
  http,
  isAddressEqual,
  stringToHex,
  type Abi,
  type Address,
  type Hash,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { formatUsdc, toBaseUnits } from "botbet-shared";
import { box, seconds } from "./box.js";
import { SettleError, StepFailure, decodeRevert, explain } from "./errors.js";
import { MIN_BASE_FEE_WEI } from "./settle-core.js";

/** From contracts/src/AgentWallet.sol; checked against the forge artifact by the local rehearsal. */
export const AGENT_WALLET_ABI = [
  { type: "function", name: "pay", stateMutability: "nonpayable", inputs: [{ name: "to", type: "address" }, { name: "amount", type: "uint256" }, { name: "memo", type: "bytes32" }], outputs: [] },
  { type: "function", name: "owner", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { type: "function", name: "maxPerTx", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "usdc", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { type: "function", name: "balance", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "event", name: "Paid", inputs: [{ name: "to", type: "address", indexed: true }, { name: "amount", type: "uint256", indexed: false }, { name: "memo", type: "bytes32", indexed: false }] },
  { type: "error", name: "NotOwner", inputs: [] },
  { type: "error", name: "CapExceeded", inputs: [{ name: "amount", type: "uint256" }, { name: "cap", type: "uint256" }] },
  { type: "error", name: "ZeroAddress", inputs: [] },
  { type: "error", name: "SafeERC20FailedOperation", inputs: [{ name: "token", type: "address" }] },
] as const satisfies Abi;

export const ALLOWED_USDC = "0.02";
export const REFUSED_USDC = "0.10";

export interface CapDemoConfig {
  rpcUrl: string;
  chainId: number;
  wallet: Address;
  /** The token the wallet must hold: Arc's 6-decimal ERC-20 USDC (or a mock locally). */
  usdc: Address;
  /** Who the allowed payment goes to. */
  recipient: Address;
  ownerKey: Hex;
  explorerBaseUrl: string;
  outPath: string;
  dryRun?: boolean;
  log?: (line: string) => void;
}

export interface CapDemoJson {
  wallet: Address;
  capUsdc: string;
  allowed: { amount: string; txHash: Hash | null };
  refused: { amount: string; reason: string };
}

/** Two-decimal human string, no symbol: 50000n → "0.05" (interfaces.md §6). */
const human = (base: bigint) => formatUsdc(base, { decimals: 2, symbol: false });
const usdc6 = (base: bigint) => formatUsdc(base, { decimals: 6 });

export async function runCapDemo(cfg: CapDemoConfig): Promise<CapDemoJson> {
  const log = cfg.log ?? ((line: string) => console.log(line));
  const t0 = Date.now();
  const txUrl = (hash: Hash) => `${cfg.explorerBaseUrl}/tx/${hash}`;
  let current = "setup";
  let n = 0;
  const step = (label: string) => {
    n += 1;
    current = label;
    log(`\n[${n}/4] ${label}`);
  };
  const ok = (line: string) => log(`  ✅ ${line}`);
  const fail = (message: string, hint?: string): never => {
    throw new StepFailure(current, new SettleError(message, hint));
  };
  const guard = async <T>(what: string, fn: () => Promise<T>): Promise<T> => {
    try {
      return await fn();
    } catch (error) {
      if (error instanceof StepFailure) throw error;
      throw new StepFailure(current, explain(error, cfg.rpcUrl, what));
    }
  };

  const chain = defineChain({
    id: cfg.chainId,
    name: `chain-${cfg.chainId}`,
    nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 }, // gas accounting only; never read
    rpcUrls: { default: { http: [cfg.rpcUrl] } },
  });
  const client = createPublicClient({ chain, transport: http(cfg.rpcUrl, { retryCount: 2, timeout: 20_000 }) });
  const owner = privateKeyToAccount(cfg.ownerKey);
  const allowed = toBaseUnits(ALLOWED_USDC);
  const refused = toBaseUnits(REFUSED_USDC);

  // 1 ─ read the wallet
  step("Read the AgentWallet");
  const chainId = await guard("reading chain ID", () => client.getChainId());
  if (chainId !== cfg.chainId) fail(`RPC ${cfg.rpcUrl} reports chain ${chainId}; expected ${cfg.chainId}.`, "Check ARC_RPC_URL.");
  const read = <T>(functionName: "owner" | "maxPerTx" | "usdc" | "balance") =>
    client.readContract({ address: cfg.wallet, abi: AGENT_WALLET_ABI, functionName }) as Promise<T>;
  const [onChainOwner, cap, token, held] = await guard(`reading AgentWallet ${cfg.wallet}`, () =>
    Promise.all([read<Address>("owner"), read<bigint>("maxPerTx"), read<Address>("usdc"), read<bigint>("balance")]),
  );
  log(`     wallet   ${cfg.wallet}  ${cfg.explorerBaseUrl}/address/${cfg.wallet}`);
  log(`     owner    ${onChainOwner}`);
  log(`     cap      ${usdc6(cap)} per payment (${cap} base units)`);
  log(`     holds    ${usdc6(held)}`);
  if (!isAddressEqual(onChainOwner, owner.address)) fail(`owner key derives to ${owner.address}, wallet owner is ${onChainOwner}.`);
  if (!isAddressEqual(token, cfg.usdc)) fail(`wallet usdc() is ${token}; expected ${cfg.usdc}.`);
  if (!(allowed <= cap && refused > cap)) fail(`cap ${human(cap)} USDC must be ≥ ${ALLOWED_USDC} and < ${REFUSED_USDC} for this demo.`);
  if (held < allowed) fail(`the wallet holds ${usdc6(held)}; it needs at least ${ALLOWED_USDC} USDC.`, `Send USDC to ${cfg.wallet} from its owner.`);
  ok("owner key, token and cap match");

  const fees = await guard("estimating fees", () => client.estimateFeesPerGas());
  const floor = MIN_BASE_FEE_WEI * 2n;
  const maxFeePerGas = fees.maxFeePerGas < floor ? floor : fees.maxFeePerGas;
  const maxPriorityFeePerGas = fees.maxPriorityFeePerGas > maxFeePerGas ? maxFeePerGas : fees.maxPriorityFeePerGas;

  // 2 ─ under the cap
  step(`Pay ${ALLOWED_USDC} USDC (under the cap) → ${cfg.recipient}`);
  const { request } = await guard(`pay(${ALLOWED_USDC})`, () =>
    client.simulateContract({
      account: owner,
      address: cfg.wallet,
      abi: AGENT_WALLET_ABI,
      functionName: "pay",
      args: [cfg.recipient, allowed, stringToHex("botbet cap-demo allowed", { size: 32 })],
      maxFeePerGas,
      maxPriorityFeePerGas,
    }),
  );
  let txHash: Hash | null = null;
  if (cfg.dryRun) {
    ok(`simulation passes; would send pay(${cfg.recipient}, ${allowed}) from ${owner.address} (dry run: NOT sent)`);
  } else {
    txHash = await guard(`pay(${ALLOWED_USDC})`, async () => {
      const hash = await createWalletClient({ account: owner, chain, transport: http(cfg.rpcUrl) }).writeContract(request);
      log(`     sent ${hash}`);
      const receipt = await client.waitForTransactionReceipt({ hash, timeout: 180_000 });
      if (receipt.status !== "success") throw new SettleError(`pay(${ALLOWED_USDC}) reverted on-chain: ${txUrl(hash)}`);
      return hash;
    });
    ok(`paid ${ALLOWED_USDC} USDC  ${txUrl(txHash)}`);
  }

  // 3 ─ over the cap, simulated only
  step(`Try ${REFUSED_USDC} USDC (over the cap): simulated, never sent`);
  let reason: string | undefined;
  try {
    await client.simulateContract({
      account: owner,
      address: cfg.wallet,
      abi: AGENT_WALLET_ABI,
      functionName: "pay",
      args: [cfg.recipient, refused, stringToHex("botbet cap-demo refused", { size: 32 })],
    });
  } catch (error) {
    reason = decodeRevert(error);
  }
  if (!reason?.startsWith("CapExceeded(")) fail(`expected CapExceeded for ${REFUSED_USDC} USDC, got ${reason ?? "no revert"}.`);
  log(`  ❌ refused by the contract: ${reason}  (no gas spent, no money moved)`);

  // 4 ─ cap-demo.json
  step("Write cap-demo.json");
  const json: CapDemoJson = {
    wallet: cfg.wallet,
    capUsdc: human(cap),
    allowed: { amount: ALLOWED_USDC, txHash },
    refused: { amount: REFUSED_USDC, reason: reason! },
  };
  if (cfg.dryRun) {
    log(JSON.stringify(json, null, 2).replace(/^/gm, "     "));
    ok("dry run: not written");
  } else {
    writeFileSync(cfg.outPath, `${JSON.stringify(json, null, 2)}\n`);
    ok(`wrote ${cfg.outPath}`);
  }

  log(
    `\n${box(cfg.dryRun ? "🧪 CAP DEMO: DRY RUN (nothing sent)" : "✅ CAP DEMO DONE", [
      `wallet    ${cfg.wallet}`,
      `cap       ${human(cap)} USDC per payment`,
      `allowed   ${ALLOWED_USDC} USDC  ${txHash ? txUrl(txHash) : "(not sent)"}`,
      `refused   ${REFUSED_USDC} USDC  ${reason}`,
      `time      ${seconds(Date.now() - t0)}`,
    ])}`,
  );
  return json;
}
