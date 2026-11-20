/**
 * Reading the repo-root .env and shared/deployments.json. See CLAUDE.md "Security": secrets are
 * read here and never printed — only the public address derived from a key ever gets logged.
 */

import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { isAddress, type Address, type Hex } from "viem";

/** referee/src (tsx) and referee/dist (built) are both two levels under the repo root. */
export const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

let loaded = false;

/** Load the repo-root .env once. Missing file is fine: real env vars may already be set. */
export function loadEnv(): void {
  if (loaded) return;
  loaded = true;
  const envPath = resolve(REPO_ROOT, ".env");
  if (existsSync(envPath)) process.loadEnvFile(envPath);
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
