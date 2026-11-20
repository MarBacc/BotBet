# BotBet — The Plan

_Extracted from `docs/prompts.md` (Parts 1 and 2) so any Claude Code session can reference it with `@docs/plan.md`._

# Part 1: The Plan

Two days really means about 30 to 36 working hours once you count sleep and the pitch. That's enough for a polished core plus two or three bounty integrations, but not everything. This plan assumes 3 to 4 people, with at least one comfortable writing Solidity.

## The rule: one loop, working end to end, by Thursday night

The loop is: **bots stake → match runs live → spectators bet → a bot buys intel → match ends → automatic payout → leaderboard updates.**

If that works by the end of Thursday, Friday goes to voice, integrations and polish. If it doesn't, drop the bounties and finish the loop. A clean core demo beats a half-working everything.

## What to build, in priority order

**Must have (no demo without these)**
- **Three contracts on Arc testnet:** `AgentWallet` (spending caps), `MatchEscrow`, and `BetPool` (the shared betting pool). Keep each under about 150 lines and test only the happy path and the cap refusal.
- **A referee server** that runs bot-vs-bot games of one game only. Use chess with a move cap of about 3 seconds per move and 80 moves max. Its result is signed by the referee's key.
- **3 or 4 built-in bots** with different personalities: a cheap one that never buys intel, a balanced one, and a big spender. Use Stockfish at different depths so moves are fast and believable.
- **Paid intel, done the simple way.** Skip x402 for now. The bot calls `wallet.pay(referee, amount, matchId)`, the referee checks the transaction receipt, then returns the evaluation. Call it "x402-style" in the pitch and list full x402 as next steps. _(The third argument, `matchId`, was added when `interfaces.md` was agreed — decision D2 there. `interfaces.md` is authoritative for every signature in this file.)_
- **One page with the live board, betting panel, bot wallet ledger and leaderboard.**

**Should have (this is where you win)**
- **ElevenLabs commentator, text-to-speech only.** An LLM writes a one-line comment on big swings in the engine's evaluation, on intel purchases and on large bets, and ElevenLabs voices it. About 4 hours of work and the biggest wow factor.
- **QuickNode Stream → webhook → live odds and leaderboard.** About 3 to 4 hours, and it also makes the backend simpler.
- **The spending-cap refusal moment** in the demo. Almost free once the wallet contract exists.

**Only if time allows**
- **Grok Bot MCP server.** Only if the organizers give you access, with one person on a 4-hour timebox. If access isn't confirmed by Thursday noon, drop it.
- Checking Connect Four moves on-chain, so results need no trust at all.
- A voice agent spectators can ask questions.
- Bot registration for outside builders.

**Cut entirely:** poker, humans playing, multiple games, accounts and logins (use a demo wallet or wallet connect), and real weekly-ranking history (seed it with fake past data).

## Schedule

| When | Goal |
|---|---|
| **Wednesday night (1 to 2 hrs)** | Agree on the bot move API and contract function signatures in writing. Deploy stub contracts. Get testnet USDC from the faucet. Ask the organizers about Grok Bot access. Then sleep. |
| **Thursday morning** | Contracts finished and deployed. Referee runs a full game locally. Frontend shows a live board from mock data. |
| **Thursday afternoon** | Connect it all: escrow → game → payout on testnet. Betting works. |
| **Thursday evening** | Intel purchases plus the wallet ledger. **Checkpoint: the full loop works.** |
| **Friday morning** | Commentator, QuickNode Stream, cap-refusal demo. Grok Bot only if access came through. |
| **Friday afternoon** | **Feature freeze 6 hours before the deadline.** Seed the leaderboard, fix bugs, record a backup demo video. |
| **Final 2 to 3 hrs** | Write slides, rehearse the 3-minute demo at least twice, submit early. |

## Biggest risks and fallbacks

- **The contracts and the referee don't connect.** The most common failure. Lock the interfaces on Wednesday night so nobody waits on anyone.
- **The live demo breaks on stage.** Have a recorded backup video and pre-funded wallets. Make the demo match short (10 to 15 moves) or start it from a mid-game position.
- **USDC decimals.** Arc's native USDC uses 18 decimals, but its ERC-20 interface uses 6. Pick one in the contracts and the frontend on Wednesday night, or you'll lose hours to amounts that are off by a factor of 10^12.
- **LLM latency in the commentary.** Generate lines in parallel with play and drop any that arrive late. Never let the game wait on the voice.
- **A sudden urge to add features.** Anything not in the "must" list waits until the Thursday checkpoint passes.
- **`forge` is shadowed on the dev machine.** On this Mac, `forge` on PATH resolves to Laravel Herd's Forge CLI, not Foundry. Foundry lives at `~/.foundry/bin/forge`. Put it first in your shell profile before touching `contracts/`: `export PATH="$HOME/.foundry/bin:$PATH"`.

---

# Part 2: Lanes

| Person | Lane | Owns |
|---|---|---|
| **A** | Contracts | `contracts/`, deploys, USDC decimals decision |
| **B** | Referee and bots | `referee/`, `bots/`, intel payment check |
| **C** | Frontend and extras | `web/`, commentator, QuickNode webhook |

Rules:
- One folder per person. Nobody's agent edits another lane's folder.
- Interface changes go in `interfaces.md` first, then everyone is told, then code changes.
- Each person has their own `.env` and a testnet-only burner wallet. Never commit secrets.
- Commit after each green step. Merge small and often, and pull before starting each task.

