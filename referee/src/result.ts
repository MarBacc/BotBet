/**
 * The EIP-712 MatchResult the escrow settles against. See interfaces.md section 2.
 *
 * The domain carries `verifyingContract`, so a signature is bound to one deployment, one chain
 * and — through `matchId` — one match. Nothing here touches the chain.
 */

import { keccak256, toBytes, recoverTypedDataAddress, type Address, type Hex, type TypedDataDomain } from "viem";
import { privateKeyToAccount } from "viem/accounts";

export const MATCH_RESULT_TYPES = {
  MatchResult: [
    { name: "matchId", type: "bytes32" },
    { name: "winner", type: "address" },
    { name: "moveCount", type: "uint16" },
    { name: "pgnHash", type: "bytes32" },
    { name: "finishedAt", type: "uint64" },
  ],
} as const;

export interface MatchResult {
  matchId: Hex;
  winner: Address;
  /**
   * Half-moves (plies), not full moves. The escrow never reads this value — it only hashes it —
   * so the one requirement is that whoever signs and whoever verifies agree on the unit.
   */
  moveCount: number;
  pgnHash: Hex;
  finishedAt: bigint;
}

/** Must match the contract's `EIP712("BotBet", "1")`. */
export function matchDomain(chainId: number, verifyingContract: Address): TypedDataDomain {
  return { name: "BotBet", version: "1", chainId, verifyingContract };
}

/** The PGN travels beside the signature unsigned; only this hash is signed. */
export function hashPgn(pgn: string): Hex {
  return keccak256(toBytes(pgn));
}

export async function signMatchResult(
  refereePrivateKey: Hex,
  domain: TypedDataDomain,
  result: MatchResult,
): Promise<Hex> {
  return privateKeyToAccount(refereePrivateKey).signTypedData({
    domain,
    types: MATCH_RESULT_TYPES,
    primaryType: "MatchResult",
    message: result,
  });
}

/** What `ECDSA.recover` in the contract will arrive at, so we can check it before paying gas. */
export async function recoverMatchResultSigner(
  domain: TypedDataDomain,
  result: MatchResult,
  signature: Hex,
): Promise<Address> {
  return recoverTypedDataAddress({
    domain,
    types: MATCH_RESULT_TYPES,
    primaryType: "MatchResult",
    message: result,
    signature,
  });
}
