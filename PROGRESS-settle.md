# PROGRESS — settle lane (feat/settle)

## 01:55 — RESTART: resynced to rewritten origin/feat/settle (9de3533); S1 done
- No keys on this laptop by design; LIVE-RUNNER (feat/live-runs) runs live with real keys and owns
  web/public/result.json + cap-demo.json.
- S1: cherry-picked 3a095ea (keyless play-game). Verified: `npm run play-game` with no keys → 55 plies,
  signature round-trips, deployed-referee check SKIPPED (offline key).
- Next: S2 live-run readiness.

## 02:10 — S2 live-run readiness: DONE
- `scripts/check-setup.mjs` runs before play-game/settle/cap-demo: Node ≥ 20.12, shared built, deps
  installed, each with the exact fix command (verified by hiding shared/dist).
- settle names every missing/malformed key at once and where it looked for .env (verified, no keys here).
- Preflight now also checks each key → its expected public address (admin, referee, deep, hasty).
- result.json gains `referee` (web request on INTEGRATION.md / web/REQUESTS.md); interfaces.md updated.
- referee/README.md: LIVE-RUNNER commands in order + failure guide.
- Not mine anymore: web/public/result.json, cap-demo.json (LIVE-RUNNER). result.sample.json escrow is
  0xdb0a… (integration ⚠), left alone: not in my file list now.
- `gh` is not installed here: PR #1 comments unreadable.

## 02:25 — S3 local rehearsal: DONE (G5 now runnable)
- anvil/forge work on this Mac with `DYLD_FALLBACK_LIBRARY_PATH=$HOME/.foundry/lib` (Foundry ships libusb).
- `npm run rehearse:local [-- --runs n --fen "<FEN>"]` (referee/scripts/local-rehearsal.ts): starts anvil on
  :8545 chain 5042002 (or reuses one), deploys MockUSDC + fresh MatchEscrow from contracts/out, mints, runs the
  REAL `runSettle()` (same code as `npm run settle`), writes /tmp/rehearsal-result.json, stops anvil.
- Result: 2/2 settles in 2.6 s with Settled events verified (local settle txs 0x00d72a30…c9746, 0xb5cf7afe…398c6).
  result.json keys = sample's + `referee`; keccak(pgn) = pgnHash. `--fen` run settles too (1 ply mate).
- Needs `cd contracts && forge build` first (read-only use).

## T1 — keys check
**Blocked: waiting for keys in .env** — key check reports all 4 (DEPLOYER, REFEREE, BOT_1, BOT_2) MISSING.

## T3 — local anvil rehearsal: SKIPPED
`anvil` and `forge` both fail: `Library not loaded: /usr/local/opt/libusb/lib/libusb-1.0.0.dylib`. No Homebrew on
this machine, so `brew install libusb` is impossible; `contracts/out` does not exist either. Option if wanted:
a JS chain (hardhat node) + solc-js build — needs the owner's go-ahead.

## T4 — robust errors + demo output: DONE (no live txs)
- `settle-core.ts` `runSettle(config)` holds the loop (injectable rpcUrl/escrow/usdc/keys/explorer/outPath);
  `settle.ts` is the CLI and still reads .env + shared/deployments.json exactly as before.
- `errors.ts`: decoded custom errors (verified read-only on Arc: `NotAdmin()`, `MatchNotFound()`), RPC
  unreachable → ARC_RPC_URL hint, all short balances listed with faucet hint, receipt wait 60 s → 3 min → exit 1.
- `--json` (progress → stderr, summary → stdout, `{ok:false,step,error,hint}` on failure); numbered `[n/11]` ✅/❌ steps.
- Untested live: the send/receipt path (no keys, no local chain).

## T5 — cap-demo script: DONE (not run live)
- `npm run cap-demo [-- --dry-run]` (referee/src/cap-demo.ts): reads `owner()`/`maxPerTx()` on-chain, signs with
  whichever known key derives to the owner, pays 0.02 under the cap, simulates 0.10 and decodes `CapExceeded`,
  writes web/public/cap-demo.json (schema in interfaces.md §6). ABI hand-written from feat/agent-wallet source.
- Tested: typecheck + the AGENT_WALLET_ADDRESS-missing path. No anvil (libusb), wallet not deployed.

## T7 — deploy AgentWallet + live cap-demo: QUEUED (after T2)
Blocked twice: needs keys (T2 first) and a working `forge` (fails: missing libusb, no Homebrew).
Note for the dry run: DeployAgentWallet.s.sol calls `vm.broadcast()` with no key argument, so the command
needs a signer flag; the temp worktree has no .env of its own.

Commit author: Tanish Patro <tanishpatro1@gmail.com> (email fixed by owner; abc4a04 and earlier carry the placeholder).

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
