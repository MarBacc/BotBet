/**
 * Reading the repo-root .env and shared/deployments.json. See CLAUDE.md "Security": secrets are
 * read here and never printed — only the public address derived from a key ever gets logged.
 */

import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { isAddress, isAddressEqual, type Address, type Hex } from "viem";
import { privateKeyToAccount, type PrivateKeyAccount } from "viem/accounts";

/** referee/src (tsx) and referee/dist (built) are both two levels under the repo root. */
export const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

let loaded = false;

/**
 * Load the repo-root .env once (or the file named by BOTBET_ENV_FILE, for a worktree that keeps
 * its secrets elsewhere). Missing file is fine: real env vars may already be set.
 */
export function loadEnv(): void {
  if (loaded) return;
  loaded = true;
  const override = process.env.BOTBET_ENV_FILE?.trim();
  const envPath = override ? resolve(override) : resolve(REPO_ROOT, ".env");
  if (existsSync(envPath)) process.loadEnvFile(envPath);
  else if (override) throw new Error(`BOTBET_ENV_FILE points at ${envPath}, which does not exist.`);
}

export function requireEnv(name: string): string {
  loadEnv();
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is not set. Copy .env.example to .env and fill it in (testnet burners only).`);
  }
  return value;
}

/** Never log the return value of this. */
export function requirePrivateKey(name: string): Hex {
  const raw = requireEnv(name);
  const key = (raw.startsWith("0x") ? raw : `0x${raw}`) as Hex;
  if (!/^0x[0-9a-fA-F]{64}$/.test(key)) {
    throw new Error(`${name} is not a 32-byte hex private key.`);
  }
  return key;
}

export interface Deployments {
  chainId: number;
  network: string;
  usdc: Address;
  referee: Address;
  contracts: { MatchEscrow: { address: Address; abi: unknown[] } };
}

/** Read at runtime rather than imported, so a redeploy does not need a rebuild. */
export function readDeployments(): Deployments {
  const path = resolve(REPO_ROOT, "shared", "deployments.json");
  if (!existsSync(path)) {
    throw new Error(`shared/deployments.json not found at ${path}. Deploy MatchEscrow first.`);
  }

  const deployments = JSON.parse(readFileSync(path, "utf8")) as Deployments;
  const escrow = deployments.contracts?.MatchEscrow?.address;
  if (!escrow || !isAddress(escrow)) {
    throw new Error("shared/deployments.json has no valid MatchEscrow address.");
  }
  if (!Number.isInteger(deployments.chainId)) {
    throw new Error("shared/deployments.json has no valid chainId.");
  }
  return deployments;
}

/** Arc testnet. The referee refuses any other chain: mainnet gas is real USDC. */
export const ARC_TESTNET_CHAIN_ID = 5042002;
/** The 6-decimal ERC-20 view of Arc's USDC. Never the 18-decimal native view. */
export const ARC_USDC: Address = "0x3600000000000000000000000000000000000000";

/** readDeployments plus the Arc-testnet invariants the EIP-712 domain and every transfer rely on. */
export function readArcDeployments(): Deployments {
  const deployments = readDeployments();
  if (deployments.chainId !== ARC_TESTNET_CHAIN_ID) {
    throw new Error(`shared/deployments.json is for chain ${deployments.chainId}; expected Arc testnet ${ARC_TESTNET_CHAIN_ID}.`);
  }
  if (!isAddress(deployments.usdc) || !isAddressEqual(deployments.usdc, ARC_USDC)) {
    throw new Error(`shared/deployments.json usdc is ${deployments.usdc}; expected the 6-decimal ERC-20 ${ARC_USDC}.`);
  }
  if (!isAddress(deployments.referee)) {
    throw new Error("shared/deployments.json has no valid referee address.");
  }
  return deployments;
}

/**
 * The referee signer, checked at startup: REFEREE_PRIVATE_KEY must derive to the referee address
 * the escrow was deployed with (immutable), or every settle reverts with InvalidSignature.
 */
export function refereeAccount(deployments: Deployments): PrivateKeyAccount {
  const account = privateKeyToAccount(requirePrivateKey("REFEREE_PRIVATE_KEY"));
  if (!isAddressEqual(account.address, deployments.referee)) {
    throw new Error(
      `REFEREE_PRIVATE_KEY derives to ${account.address}, but MatchEscrow ` +
        `${deployments.contracts.MatchEscrow.address} trusts referee ${deployments.referee} (immutable). ` +
        `Use the deployment's referee key, or redeploy with this key's address as REFEREE_ADDRESS.`,
    );
  }
  return account;
}
