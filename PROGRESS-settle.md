# PROGRESS — settle lane (feat/settle)

## 2026-11-20 — steps 0–2 (code), live run blocked on keys

**Done**
- Merged origin/solo; interfaces.md keeps solo's contract spec (incl. `InvalidMatch()`) + result.json schema v1.
- Verified: `moveCount` is plies (55-ply game → 55); MatchEscrow only hashes it, no constraint.
- Verified on-chain (read-only): chainId 5042002; `referee()` 0xE632…8345, `admin()` 0xEAb9…1f7F,
  `usdc()` 0x3600…0000, `MAX_STAKE` 1e12 base units, `eip712Domain` = BotBet/1/5042002/0x9d4E…916c.
- `env.ts`: `readArcDeployments()` (asserts chain 5042002 + USDC 0x3600…), `refereeAccount()` (asserts
  REFEREE_PRIVATE_KEY derives to deployments.referee, clear error), `BOTBET_ENV_FILE` override.
- `game.ts`/`engine.ts`: optional `startFen` (UCI `position fen …`, PGN SetUp/FEN headers).
- `npm run settle [-- --fen "<FEN>"] [--dry-run]` in `referee/src/settle.ts`.
  - Stake: **not stored in the contract or deploy script** — it's a per-match `createMatch` arg. Read
    from `STAKE_USDC` (default "2"), checked against on-chain `MAX_STAKE`.
  - `createMatch` is admin-only → uses DEPLOYER_PRIVATE_KEY; fresh random 32-byte matchId every run.
  - Preflight: RPC chainId, escrow immutables vs keys, EIP-712 domain, balances (stake + 0.05 gas
    buffer, 6-dec ERC-20 view) with faucet message naming the short address; fees floored at 2×20 gwei.
  - Each tx simulated, sent, receipt awaited, status checked; explorer links printed.
  - Settle verified via `Settled` event filtered by emitter = escrow. Writes web/public/result.json (schema v1).

**Blockers**
- No `.env` in this worktree; `/Users/alexrdz/Bot-Arena/.env` has no REFEREE_PRIVATE_KEY. Need the
  BotBet burner keys (REFEREE, DEPLOYER, BOT_1, BOT_2) in `botbet-settle/.env` (or `BOTBET_ENV_FILE`).

**Next**: dry run → owner OK → live `npm run settle` ×2.

**Tx hashes**: none yet.
