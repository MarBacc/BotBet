/** Arc testnet endpoints, from docs/arc.md. No trailing slash. */
export const DEFAULT_RPC_URL = "https://rpc.testnet.arc.io";
export const EXPLORER_BASE_URL = "https://explorer.testnet.arc.io";

/**
 * The public addresses each key must derive to on the deployed MatchEscrow (HANDOFF.md). Admin and
 * referee are also checked against the contract itself; the bots only exist off-chain until
 * createMatch, so this table is what catches a swapped BOT_1/BOT_2 key.
 */
export const EXPECTED_ADDRESSES = {
  admin: "0xEAb99118c98abbfA99aD55dd261c6fcEf8381f7F",
  referee: "0xE632a919CEE69FC9482a6A719D47878EEDA28345",
  deep: "0xBAe2658a561A7A37e7CF4fDF336772dD23460E24",
  hasty: "0x016E0a0c6a153edFDd05947667Be12Be001Eb661",
} as const;
