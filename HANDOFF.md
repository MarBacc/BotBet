# BotBet Handoff

For the next human and any coding agent (Claude Code, Cursor, etc.) picking this up. Read this first, then `CLAUDE.md`, `interfaces.md` and `docs/plan.md` in the repo.

Repo: github.com/MarBacc/BotBet, default branch `solo`. `main` holds the pre-cut, full-scope version.

## What this is

A hackathon project: two Stockfish bots play one chess game, stake USDC into an on-chain escrow on Arc testnet, a referee signs the result (EIP-712), and the contract pays the winner automatically. A single web page then shows the replayed game, stakes, winner and a link to the settle transaction.

It was originally a bigger plan (spectator betting pool, paid intel, spending-cap wallet, ElevenLabs commentator, QuickNode). It was cut to a **solo 10-hour scope**: stake, play, settle, payout from a script, then one page. Everything cut lives in `docs/roadmap.md` and is pitched as "next steps".

Pitch framing: call results **referee-attested**, not trustless. The contract accepts whatever the referee signs. On-chain move verification is a next step.

## Current state

| Piece | State |
|---|---|
| Scaffold (`contracts/`, `referee/`, `web/`, `shared/`) | Done |
| `CLAUDE.md`, `interfaces.md` (about 120 lines, solo scope), `docs/plan.md`, `docs/arc.md`, `docs/roadmap.md` | Done |
| `shared/money.ts` (6-decimal USDC helpers, wired in as `file:../shared`) | Done |
| `MatchEscrow.sol` (144 lines, OpenZeppelin v5.1.0 vendored as plain files) | Done, 8 Foundry tests green, reviewed, stake ceiling added |
| Deployment to Arc testnet | Done, see below |
| Referee `npm run play-game` (Stockfish WASM, chess.js, viem) | Done: depth 12 beats depth 4 by checkmate in 28 moves (55 plies), signs the result, signature recovers to the referee address. No chain calls |
| Referee `npm run settle` (stake, play, sign, settle on chain) | **Not done. Start here** |
| Web page replaying `web/public/result.json` | Not started |
| Extra (cap-refusal button or ElevenLabs commentator) | Not started |
| Demo mode, backup video, slides, submission | Not started |

Verify the commit state yourself with `git log --oneline -10` and `git status`. The referee work was reported as green but may have been uncommitted when the previous session ended.

## Deployment facts (Arc testnet, chain ID 5042002)

- MatchEscrow: `0x9d4EEE03C431c524822c6A1486bE6142d2a4916c`
- Deploy tx: `0x4464e518...544eb8b6` (full hash in `contracts/broadcast/` and `shared/deployments.json`), block 73133688
- Immutables: `referee()` = `0xE632a919CEE69FC9482a6A719D47878EEDA28345`, `admin()` = the deployer, `usdc()` = `0x3600000000000000000000000000000000000000`, `MAX_STAKE()` = `1000000000000` (1,000,000 USDC at 6 decimals)
- `shared/deployments.json` holds the address and full ABI. Read addresses from there, never hardcode.
- RPC `https://rpc.testnet.arc.io`, explorer `https://explorer.testnet.arc.io` (sources disagree on hostnames, so confirm against `docs/arc.md`)

### Wallet roles (addresses are public)

| Role | Address |
|---|---|
| Deployer / admin | `0xEAb99118c98abbfA99aD55dd261c6fcEf8381f7F` |
| Referee | `0xE632a919CEE69FC9482a6A719D47878EEDA28345` |
| Bot 1 | `0xBAe2658a561A7A37e7CF4fDF336772dD23460E24` |
| Bot 2 | `0x016E0a0c6a153edFDd05947667Be12Be001Eb661` |

**Private keys are not in the repo and must never be.** They live in the original owner's local `.env` (gitignored). To continue with the same deployment, get the referee key (and bot keys, for staking) from the owner over a private channel, outside any LLM chat. These are testnet burners, but treat them carefully.

**Alternative:** generate fresh burners with `cast wallet new` and redeploy (about 0.04 USDC gas). The referee address is **immutable** in the deployed contract, so a different referee key means a redeploy. After any redeploy, `shared/deployments.json` is rewritten by the deploy script.

## Setup on a fresh machine

```bash
git clone https://github.com/MarBacc/BotBet.git && cd BotBet
cp .env.example .env              # fill in keys, STOCKFISH_PATH optional (WASM fallback works)
export PATH="$HOME/.foundry/bin:$PATH"   # Laravel Herd's forge can shadow Foundry
cd shared && npm install && npm run build   # MUST run before referee/ or web/ (shared/dist is gitignored)
```
Then `npm install` in `referee/` and `web/`. `cd contracts && forge build && forge test` needs no install step (forge-std and OpenZeppelin are vendored as plain files, not submodules).

Faucet: faucet.circle.com, pick Arc Testnet. Roughly 20 USDC per address every 2 hours. USDC is also the gas token. Fund the bots above their stake plus gas.

## Remaining steps, in order

### 1. Confirm 8a details
- **Open question that was pending:** the signed `moveCount` was either full moves (28) or plies (55). The recommendation was **plies (55)**: unambiguous and recomputable from the PGN. Check what `referee/src/game.ts` and `result.ts` currently sign, make sure `interfaces.md` matches, and confirm `MatchEscrow` does not constrain `moveCount` (the contract is already deployed and immutable). If the contract does check it, match the contract.
- Add the `InvalidMatch()` error to `interfaces.md` section 1 (it exists in the contract but not the spec).
- Add a startup assertion in the referee that `REFEREE_PRIVATE_KEY` derives to the `referee` address in `shared/deployments.json`. A mismatch means the contract can never be settled.

### 2. Build `npm run settle` (the hard checkpoint)
Both bots stake on Arc using their burner keys (approve, then stake, waiting for each confirmation), the game is played, the referee signs, the referee calls `settle()`. Print every step with tx hashes and final balances, and write the result to `web/public/result.json`.

Things the next agent must check, because the contract is fixed:
- **Stake amount.** The contract tests used 2 USDC (2,000,000 base units) per bot. Read the configured stake from the contract (or the deploy script) instead of hardcoding it, since a different amount reverts.
- **A match must exist first.** Check whether the deploy script already created one, or whether `createMatch` is admin-only (deployer key). A Settled match cannot be reused, so **each run needs a fresh match ID**, or the second run reverts.
- **Balance check first.** Before staking, require each bot to hold stake plus gas on the ERC-20 view, and stop with a clear message otherwise.
- **Decimals.** ERC-20 USDC is 6 decimals. The native gas balance of the same funds is 18 decimals. Never mix them; use `shared/money.ts`.

**Checkpoint:** `npm run settle` works from a clean terminal, **twice in a row**, and the settle tx is visible on the explorer. If not, do not start extras; fix the loop.

### 3. The page (`web/`)
Single page that loads `result.json` and shows the replayed board (from the PGN), both stakes, the winner, and a link to the settle transaction. Plain styling is fine. Confirm no console errors and that the explorer link goes to the right transaction.

### 4. One extra, then stop
Pick one:
- **Cap-refusal button:** implement the minimal `AgentWallet` from `docs/roadmap.md` (balance plus a cap, `pay()` reverts over the cap), a Foundry test, and a button that shows the revert reason. Do not wire it into `MatchEscrow`.
- **ElevenLabs commentator:** only if the owner is entering that bounty (the `.env.example` and plan mention it). Credits come from ElevenLabs' Discord. Keep it scoped to one voiced line about the result.

### 5. Demo mode and submission
- Add a demo mode starting from a mid-game position so the match ends decisively in 10 to 15 moves. Then run the full flow 5 times and list every failure with its cause before fixing anything.
- The game is currently fully deterministic (same 28-move checkmate every run). That is good for a backup video; add a random opening ply only if time allows.
- Record a backup demo video of a working run, write slides (problem, flow, live transaction, roadmap), check the submission checklist in `docs/`, and submit early.

## Working rules and gotchas

- **One agent per folder.** Two sessions wrote `referee/src` in the same checkout and overwrote each other's files, and nothing in git protected the uncommitted work. Use separate git worktrees or strictly separate folders (contracts vs referee/web), and commit after every green step.
- **Never read or print `.env`.** `.claude/settings.json` denies it. Scripts load it themselves (Node's `process.loadEnvFile()`). Never paste a key into a prompt, log or commit message.
- **Do not deploy or broadcast without reading the dry-run.** Check chain ID 5042002, the USDC address, and the deployer address before approving.
- **Keep scope small.** Anything not in the "remaining steps" list goes to `docs/roadmap.md`. Interface changes go in `interfaces.md` first.
- **The Stockfish npm package (WASM) is the engine.** `brew install stockfish` failed on the original machine (needs sudo); `STOCKFISH_PATH` overrides the WASM if a native binary is available.
- **EIP-712 domain** is meant to bind the signature to `MatchEscrow`'s address and chain ID, with replay protection via match ID. The escrow has a test for a signature signed for a different contract. Confirm the referee's signing domain uses the deployed address.
- **Low-severity review findings** (three) were listed but left unfixed. Skim them in the git history of the review step; fix only if they touch signatures, payouts or locked funds.

## Suggested first prompt for a coding agent

```
Read HANDOFF.md, CLAUDE.md and interfaces.md. Run git log and git status and tell me what is committed. Then confirm the referee signs moveCount in plies and that MatchEscrow doesn't constrain it. Then build npm run settle in referee/ per HANDOFF.md section "Build npm run settle". Do not touch contracts/ or web/. Commit after each green step.
```
