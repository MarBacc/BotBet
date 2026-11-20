# BotBet — the solo plan

**Submission deadline: Friday 20 November, 12:00 PM CST.** Written at 19:52 CST Thursday, which
left 16 hours. The 10-hour build fits only if it starts now and the loop lands on time.

Judging is Saturday 21 November, in person. You must be there to collect anything.

## The loop

**Two bots stake → the game is played → the referee signs the result → `settle()` pays the
winner → one page replays it, with voice commentary and a link to the transaction.**

## What we are entering

| | Choice | Why |
|---|---|---|
| Main track (pick exactly one) | **Agentic Payments and AI** | Two autonomous agents hold and move USDC with no human in the loop. The track asks for agents that "hold, send, and receive stablecoins safely" |
| Chain award (pick one) | **Best use of Arc** ($1,000/track) | The whole loop is on Arc. Never select Solana as well — they are mutually exclusive |
| Bounty | **ElevenLabs** (3 months Scale per member) | Voice commentary over the replay — see hour 7.5 |

Every submission is automatically in the running for Overall Winner (1st $2,500). The track
requires us to **document the agent's decision loop and its safety limits** in the README — that
is a written deliverable, not code, and it is what `AgentWallet` would have proved. Without it,
the honest version is: funds only ever move on a referee-signed result, and each bot's exposure
is capped at its stake.

## Schedule, in real clock time

| Clock | Hours | Goal |
|---|---|---|
| 20:00 Thu | 0 – 0.75 | Setup; **claim the ElevenLabs credits and hit the faucet first** |
| 20:45 Thu | 0.75 – 3 | `MatchEscrow` written, tested, deployed to Arc testnet |
| 23:00 Thu | 3 – 5.5 | Referee plays and settles on-chain. **HARD CHECKPOINT at 01:30 Fri** |
| 01:30 Fri | 5.5 – 7.5 | The page: replayed board, stakes, winner, link to the settle tx |
| 03:30 Fri | 7.5 – 8.5 | **ElevenLabs commentary** (the bounty) |
| 04:30 Fri | 8.5 – 9.5 | Demo match from a mid-game position, record the 2–3 minute video |
| 05:30 Fri | 9.5 – 10 | README, Devpost form, submit |
| 06:00 Fri | — | Six hours of slack before noon. Sleep in it, do not spend it building |

**At 01:30 Friday, `npm run settle` either works from a clean terminal or it does not.** If it
does not, the page shrinks to raw JSON on a screen and the commentary is cut. A working loop with
an ugly page beats a beautiful page with no loop.

If the loop lands early, the next most valuable thing is **not** polish — it is `AgentWallet`
with a spending cap and the "try overspend" refusal, because that is the evidence the Agentic
Payments track asks for. Spec is in `docs/roadmap.md` §1.1. Only after ElevenLabs.

## What is cut

`BetPool` and spectator betting, paid intel, the bot HTTP API, the referee HTTP and WebSocket
APIs, QuickNode Streams, the leaderboard, draws, timeouts, refunds and fees. All of it is in
`docs/roadmap.md` — cut, not forgotten, and "What would you build next?" is a Devpost field.

Demo matches are **decisive by construction**: Stockfish at depth 12 vs depth 4. No draw
handling exists, so a draw is a bug.

## Risks

- **The repo is private. The submission requires a public one.** Flip it before submitting.
- **`forge` is shadowed.** `export PATH="$HOME/.foundry/bin:$PATH"` in every new terminal, or
  Foundry commands fail with a PHP notice from Laravel Herd's Forge CLI.
- **`shared/dist/` is gitignored.** Build `shared/` before `referee/` or `web/`.
- **USDC decimals.** One balance, two views: native 18, ERC-20 6. We use the ERC-20 view only,
  through `shared/src/money.ts`. See `docs/arc.md`.
- **Gas is USDC on Arc.** A wallet funded with exactly its stake cannot pay to stake it.
- **The faucet gives 20 USDC per address every 2 hours.** Three burners, so start now and keep
  stakes at 1–2 USDC.
- **A transaction below Arc's 20 Gwei minimum base fee is silently dropped.** No error.
- **ElevenLabs credits come through their Discord**, not the API console. Claiming takes minutes
  but it is a hard dependency for the 03:30 slot — do it before you start the contract.
- **The live demo breaks on stage.** The recorded video is the backup, and it is also a
  submission requirement. Record it at 04:30, not at 11:00.
