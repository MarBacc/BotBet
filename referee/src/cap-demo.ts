/**
 * `npm run cap-demo` — the AgentWallet spending cap, shown live. See interfaces.md section 6.
 *
 *   1. one payment UNDER the cap (0.02 USDC) owner → referee, sent and mined
 *   2. one payment OVER the cap (0.10 USDC), only simulated: the revert is decoded to
 *      CapExceeded(amount, cap) and recorded — the refusal costs no gas and moves no money
 *   3. web/public/cap-demo.json for the page
 *
 * Env: AGENT_WALLET_ADDRESS (the deployed AgentWallet). The owner key is whichever of
 * DEPLOYER/REFEREE/BOT_1/BOT_2_PRIVATE_KEY derives to the wallet's on-chain owner(); keys are never
 * printed. Optional ARC_RPC_URL. Flag --dry-run: read and simulate only, send nothing.
 */

import { resolve } from "node:path";
import { writeFileSync } from "node:fs";
import {
  createPublicClient,
  createWalletClient,
  defineChain,
  http,
  isAddress,
  isAddressEqual,
  stringToHex,
  type Abi,
  type Address,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { formatUsdc, toBaseUnits } from "botbet-shared";
import { ARC_TESTNET_CHAIN_ID, REPO_ROOT, loadEnv, readArcDeployments, requirePrivateKey } from "./env.js";
import { decodeRevert, explain } from "./errors.js";
import { MIN_BASE_FEE_WEI } from "./settle-core.js";
import { DEFAULT_RPC_URL, EXPLORER_BASE_URL } from "./settle-constants.js";

/** Hand-written from contracts/src/AgentWallet.sol on feat/agent-wallet (no compiled artifacts here). */
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
] as const satisfies Abi;

const ALLOWED = "0.02";
const REFUSED = "0.10";
const KEY_NAMES = ["DEPLOYER_PRIVATE_KEY", "REFEREE_PRIVATE_KEY", "BOT_1_PRIVATE_KEY", "BOT_2_PRIVATE_KEY"] as const;
/** Two-decimal display without the symbol, e.g. 50000n → "0.05". */
const human = (base: bigint) => formatUsdc(base, { decimals: 2, symbol: false });

async function main(): Promise<void> {
  const dryRun = process.argv.includes("--dry-run");
  loadEnv();
  const deployments = readArcDeployments();

  const walletAddress = process.env.AGENT_WALLET_ADDRESS?.trim();
  console.log(`AGENT_WALLET_ADDRESS ${walletAddress ? "set" : "MISSING"}`);
  if (!walletAddress || !isAddress(walletAddress)) {
    throw new Error("AGENT_WALLET_ADDRESS is not set to a valid address. Deploy AgentWallet (feat/agent-wallet) and put its address in .env.");
  }

  const rpcUrl = process.env.ARC_RPC_URL?.trim() || DEFAULT_RPC_URL;
  const chain = defineChain({
    id: ARC_TESTNET_CHAIN_ID,
    name: "Arc Testnet",
    nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 }, // gas accounting only
    rpcUrls: { default: { http: [rpcUrl] } },
  });
  const client = createPublicClient({ chain, transport: http(rpcUrl) });
  const rpcChainId = await client.getChainId();
  if (rpcChainId !== ARC_TESTNET_CHAIN_ID) throw new Error(`RPC reports chain ${rpcChainId}; expected ${ARC_TESTNET_CHAIN_ID}.`);

  const read = <T>(functionName: "owner" | "maxPerTx" | "usdc" | "balance") =>
    client.readContract({ address: walletAddress, abi: AGENT_WALLET_ABI, functionName }) as Promise<T>;
  const [owner, cap, walletUsdc, walletBalance] = await Promise.all([
    read<Address>("owner"),
    read<bigint>("maxPerTx"),
    read<Address>("usdc"),
    read<bigint>("balance"),
  ]);
  if (!isAddressEqual(walletUsdc, deployments.usdc)) throw new Error(`wallet usdc() is ${walletUsdc}; expected ${deployments.usdc}.`);

  const ownerKeyName = KEY_NAMES.find((name) => {
    try {
      return isAddressEqual(privateKeyToAccount(requirePrivateKey(name)).address, owner);
    } catch {
      return false;
    }
  });
  if (!ownerKeyName) throw new Error(`none of ${KEY_NAMES.join(", ")} derives to the wallet owner ${owner}.`);
  const ownerAccount = privateKeyToAccount(requirePrivateKey(ownerKeyName));

  const allowed = toBaseUnits(ALLOWED);
  const refused = toBaseUnits(REFUSED);
  const to = deployments.referee;
  console.log(`wallet ${walletAddress}  owner ${owner} (${ownerKeyName})  cap ${formatUsdc(cap, { decimals: 6 })}  holds ${formatUsdc(walletBalance, { decimals: 6 })}`);
  if (allowed > cap || refused <= cap) throw new Error(`cap ${human(cap)} USDC must sit between ${ALLOWED} and ${REFUSED} for this demo.`);
  if (walletBalance < allowed) throw new Error(`the wallet holds ${formatUsdc(walletBalance, { decimals: 6 })}; fund ${walletAddress} with at least ${ALLOWED} USDC.`);

  const fees = await client.estimateFeesPerGas();
  const floor = MIN_BASE_FEE_WEI * 2n;
  const maxFeePerGas = fees.maxFeePerGas < floor ? floor : fees.maxFeePerGas;
  const maxPriorityFeePerGas = fees.maxPriorityFeePerGas > maxFeePerGas ? maxFeePerGas : fees.maxPriorityFeePerGas;

  // 1. Under the cap: simulate, send, wait.
  const { request } = await client
    .simulateContract({
      account: ownerAccount,
      address: walletAddress,
      abi: AGENT_WALLET_ABI,
      functionName: "pay",
      args: [to, allowed, stringToHex("botbet cap-demo allowed", { size: 32 })],
      maxFeePerGas,
      maxPriorityFeePerGas,
    })
    .catch((error: unknown) => {
      throw explain(error, rpcUrl, `pay(${ALLOWED})`);
    });
  let txHash: `0x${string}` | "dry-run" = "dry-run";
  if (!dryRun) {
    txHash = await createWalletClient({ account: ownerAccount, chain, transport: http(rpcUrl) }).writeContract(request);
    const receipt = await client.waitForTransactionReceipt({ hash: txHash, timeout: 180_000 });
    if (receipt.status !== "success") throw new Error(`pay(${ALLOWED}) reverted: ${EXPLORER_BASE_URL}/tx/${txHash}`);
  }
  console.log(`✅ allowed  pay ${ALLOWED} USDC → ${to}  ${dryRun ? "(dry run, not sent)" : `${EXPLORER_BASE_URL}/tx/${txHash}`}`);

  // 2. Over the cap: simulate only, expect CapExceeded.
  let reason: string | undefined;
  try {
    await client.simulateContract({
      account: ownerAccount,
      address: walletAddress,
      abi: AGENT_WALLET_ABI,
      functionName: "pay",
      args: [to, refused, stringToHex("botbet cap-demo refused", { size: 32 })],
    });
  } catch (error) {
    reason = decodeRevert(error);
  }
  if (!reason?.startsWith("CapExceeded(")) throw new Error(`expected the ${REFUSED} USDC payment to revert CapExceeded, got ${reason ?? "no revert"}.`);
  console.log(`❌ refused  pay ${REFUSED} USDC → ${reason} (simulated; no gas spent, no money moved)`);

  // 3. web/public/cap-demo.json — interfaces.md section 6.
  const json = {
    wallet: walletAddress,
    capUsdc: human(cap),
    allowed: { amount: ALLOWED, txHash },
    refused: { amount: REFUSED, reason },
  };
  if (dryRun) {
    console.log(JSON.stringify(json, null, 2));
    console.log("Dry run: cap-demo.json not written.");
    return;
  }
  const outPath = resolve(REPO_ROOT, "web", "public", "cap-demo.json");
  writeFileSync(outPath, `${JSON.stringify(json, null, 2)}\n`);
  console.log(`wrote ${outPath}`);
}

main().catch((error: unknown) => {
  console.error(`\n❌ cap-demo failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
