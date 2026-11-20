# Poker (beta) — web side

`poker-result.json` is produced by the poker engine (`feat/poker-engine`, `referee/src/poker/README.md`).
The page reads the **engine schema** (`schemaVersion: 1`, `referee/src/poker/match.ts` `pokerResultJson`)
directly: actions keyed by bot name, `referee.{address,result,signature}`, `txs.*`, `offline`. Running pot and
per-hand chips are recomputed (verified equal to the engine's final `chips`). It also accepts the simpler
page shape below, used by `sample.json` (all amounts in
`*Usdc` fields are 6-decimal base-unit strings; chip counts are plain integers):

```jsonc
{
  "version": 1, "game": "holdem-headsup", "chainId": 5042002,
  "explorerBaseUrl": "https://explorer.testnet.arc.io", "matchId": "0x…",
  "stakeUsdc": "2000000", "potUsdc": "4000000",
  "bots": [{ "id": "tight", "name": "…", "strategy": "…", "address": "0x…", "startChips": 200,
             "stakeTxHash": "0x…" }],                       // exactly 2
  "hands": [{ "n": 1, "holeCards": { "tight": ["As", "Kd"] }, "board": ["7h", "…"],
              "actions": [{ "street": "preflop", "botId": "tight", "action": "raise", "amount": 6, "pot": 9 }],
              "winnerId": "tight", "chipsAfter": { "tight": 210, "loose": 190 } }],
  "winner": "0x…", "winnerId": "tight", "handHistoryHash": "0x…", "signature": "0x…",
  "referee": "0x…", "createMatchTxHash": "0x…", "settleTxHash": "0x…", "finishedAt": 1763625600
}
```

Cards are two-character strings: rank `23456789TJQKA` + suit `shdc`.
`bots.json` (optional): `[{ "name", "game", "owner", "codeHash", "house": true|false }]`.
Dev-only previews: `?poker=/path.json`, `?bots=/path.json`.

## Requests to the poker engine
- Add `stakeUsdc` / `potUsdc` (base-unit strings) and `explorerBaseUrl` to poker-result.json. Until then the
  page omits USDC amounts and uses the default Arc explorer.
- Optional: `verifyCommand` in bots.json so the "Registered bots" panel can show the exact CLI.
