// The EIP-712 MatchResult the escrow settles against (interfaces.md §2), with throwaway keys only.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { keccak256, toBytes, toHex, type Hex } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { MATCH_RESULT_TYPES, hashPgn, matchDomain, recoverMatchResultSigner, signMatchResult, type MatchResult } from "../src/result.js";
import { REPO_ROOT } from "../src/env.js";

const ESCROW = "0x9d4EEE03C431c524822c6A1486bE6142d2a4916c" as const;
const domain = matchDomain(5042002, ESCROW);
const pgn = '[Event "BotBet"]\n\n1. e4 e5 2. Qh5 Nc6 3. Bc4 Nf6 4. Qxf7# 1-0';

function result(over: Partial<MatchResult> = {}): MatchResult {
  return {
    matchId: toHex(1n, { size: 32 }),
    winner: privateKeyToAccount(generatePrivateKey()).address,
    moveCount: 7,
    pgnHash: hashPgn(pgn),
    finishedAt: 1_763_625_600n,
    ...over,
  };
}

test("signature round-trips to the ephemeral signer", async () => {
  const key = generatePrivateKey();
  const r = result();
  const sig = await signMatchResult(key, domain, r);
  assert.match(sig, /^0x[0-9a-f]{130}$/);
  assert.equal(await recoverMatchResultSigner(domain, r, sig), privateKeyToAccount(key).address);
});

test("any field change, or another contract/chain, recovers someone else", async () => {
  const key = generatePrivateKey();
  const signer = privateKeyToAccount(key).address;
  const r = result();
  const sig = await signMatchResult(key, domain, r);
  const tampered: [string, Parameters<typeof recoverMatchResultSigner>][] = [
    ["moveCount", [domain, { ...r, moveCount: 8 }, sig]],
    ["winner", [domain, { ...r, winner: signer }, sig]],
    ["matchId", [domain, { ...r, matchId: toHex(2n, { size: 32 }) }, sig]],
    ["pgnHash", [domain, { ...r, pgnHash: hashPgn(`${pgn} `) }, sig]],
    ["finishedAt", [domain, { ...r, finishedAt: r.finishedAt + 1n }, sig]],
    ["verifyingContract", [matchDomain(5042002, "0xdb0a81FE69A9798cae18dfFf608da4c31dBCFcbE"), r, sig]],
    ["chainId (mainnet)", [matchDomain(5042, ESCROW), r, sig]],
  ];
  for (const [name, args] of tampered) {
    assert.notEqual(await recoverMatchResultSigner(...args), signer, `${name} change must break the signature`);
  }
});

test("type string matches MatchEscrow.sol's MATCH_RESULT_TYPEHASH", () => {
  const sol = readFileSync(resolve(REPO_ROOT, "contracts", "src", "MatchEscrow.sol"), "utf8");
  const onChain = /keccak256\(\s*"(MatchResult\([^"]+\))"\s*\)/.exec(sol)?.[1];
  assert.ok(onChain, "MATCH_RESULT_TYPEHASH string not found in MatchEscrow.sol");
  const ours = `MatchResult(${MATCH_RESULT_TYPES.MatchResult.map((f) => `${f.type} ${f.name}`).join(",")})`;
  assert.equal(ours, onChain);
  assert.equal(keccak256(toBytes(ours)), keccak256(toBytes(onChain!)));
});

test("domain is BotBet v1, chain 5042002, the deployed escrow", () => {
  assert.deepEqual(domain, { name: "BotBet", version: "1", chainId: 5042002, verifyingContract: ESCROW });
  const deployments = JSON.parse(readFileSync(resolve(REPO_ROOT, "shared", "deployments.json"), "utf8")) as { contracts: { MatchEscrow: { address: Hex } } };
  assert.equal(deployments.contracts.MatchEscrow.address, ESCROW);
});

test("pgnHash is keccak256 of the PGN's UTF-8 bytes", () => {
  assert.equal(hashPgn(pgn), keccak256(new TextEncoder().encode(pgn)));
  assert.notEqual(hashPgn("é"), hashPgn("e"));
});
