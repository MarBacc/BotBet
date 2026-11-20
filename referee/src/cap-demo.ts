/**
 * `npm run cap-demo [-- --dry-run]` — the AgentWallet spending cap on Arc testnet. interfaces.md §6.
 * The demo itself is cap-demo-core.ts; this file only gathers the real config.
 *
 * Env: AGENT_WALLET_ADDRESS (the deployed AgentWallet). The owner key is whichever of
 * DEPLOYER/REFEREE/BOT_1/BOT_2_PRIVATE_KEY derives to the wallet's on-chain owner(); keys are never
 * printed. Optional ARC_RPC_URL. --dry-run reads and simulates only: nothing is sent or written.
 */

import { resolve } from "node:path";
import { createPublicClient, http, isAddress, isAddressEqual, type Address, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { ARC_TESTNET_CHAIN_ID, REPO_ROOT, loadEnv, readArcDeployments, requirePrivateKey } from "./env.js";
import { SettleError, StepFailure, explain } from "./errors.js";
import { AGENT_WALLET_ABI, runCapDemo } from "./cap-demo-core.js";
import { DEFAULT_RPC_URL, EXPLORER_BASE_URL } from "./settle-constants.js";

const KEY_NAMES = ["DEPLOYER_PRIVATE_KEY", "REFEREE_PRIVATE_KEY", "BOT_1_PRIVATE_KEY", "BOT_2_PRIVATE_KEY"] as const;

async function main(): Promise<void> {
  const dryRun = process.argv.includes("--dry-run");
  const unknown = process.argv.slice(2).filter((a) => a !== "--dry-run");
  if (unknown.length) throw new SettleError(`unknown argument ${unknown[0]}. Usage: npm run cap-demo -- [--dry-run]`);
  loadEnv();
  const deployments = readArcDeployments();
  const rpcUrl = process.env.ARC_RPC_URL?.trim() || DEFAULT_RPC_URL;

  const wallet = process.env.AGENT_WALLET_ADDRESS?.trim();
  console.log(`BotBet — AgentWallet cap demo on Arc testnet${dryRun ? " (DRY RUN: nothing will be sent)" : " (real transaction)"}`);
  console.log(`  AGENT_WALLET_ADDRESS ${wallet ? "set" : "MISSING"}`);
  if (!wallet || !isAddress(wallet)) {
    throw new SettleError("AGENT_WALLET_ADDRESS is not set to a valid address.", "Deploy AgentWallet (contracts/script/DeployAgentWallet.s.sol) and add AGENT_WALLET_ADDRESS=0x… to .env.");
  }

  // Find the key that owns the wallet without printing any key.
  const owner = await createPublicClient({ transport: http(rpcUrl) })
    .readContract({ address: wallet, abi: AGENT_WALLET_ABI, functionName: "owner" })
    .catch((error: unknown) => {
      throw explain(error, rpcUrl, `reading owner() of ${wallet}`);
    });
  const ownerKeyName = KEY_NAMES.find((name) => {
    try {
      return isAddressEqual(privateKeyToAccount(requirePrivateKey(name)).address, owner as Address);
    } catch {
      return false;
    }
  });
  if (!ownerKeyName) throw new SettleError(`none of ${KEY_NAMES.join(", ")} derives to the wallet owner ${owner}.`);
  console.log(`  owner key            ${ownerKeyName} → ${owner}`);

  await runCapDemo({
    rpcUrl,
    chainId: ARC_TESTNET_CHAIN_ID,
    wallet,
    usdc: deployments.usdc,
    recipient: deployments.referee,
    ownerKey: requirePrivateKey(ownerKeyName) as Hex,
    explorerBaseUrl: EXPLORER_BASE_URL,
    outPath: resolve(REPO_ROOT, "web", "public", "cap-demo.json"),
    dryRun,
  });
}

main().catch((error: unknown) => {
  const step = error instanceof StepFailure ? error.step : "setup";
  const cause = error instanceof StepFailure ? error.cause : error;
  console.error(`\n❌ CAP DEMO FAILED at "${step}": ${cause instanceof Error ? cause.message : String(cause)}`);
  if (cause instanceof SettleError && cause.hint) console.error(`   → ${cause.hint}`);
  process.exitCode = 1;
});
