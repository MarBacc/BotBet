# BotBet — the solo 10-hour plan

Cut down from the 3-person, 2-day plan (still in `docs/prompts.md`; the full spec it was written
against is in `docs/roadmap.md`). One person, 10 hours, one loop that works.

## The loop

**Two bots stake → the game is played → the referee signs the result → `settle()` pays the
winner → one page shows it with a link to the transaction.**

That is the entire product. A judge should see real USDC move on Arc testnet because a chess
game ended.

## Schedule

| Hours | Goal |
|---|---|
| **0 – 0.75** | Setup: Foundry PATH, build `shared/`, branch, settings, Arc docs, spec cut |
| **0.75 – 3** | `MatchEscrow` written, tested, deployed to Arc testnet |
| **3 – 5.5** | Referee plays a full game and settles it on-chain. **HARD CHECKPOINT at 5.5** |
| **5.5 – 7.5** | The page: replayed board, stakes, winner, link to the settle transaction |
| **7.5 – 8.5** | One extra, chosen *after* the checkpoint passes |
| **8.5 – 9.5** | Short demo match from a mid-game position, and a backup video |
| **9.5 – 10** | Slides, rehearse, submit early |

**The checkpoint is the whole plan.** At hour 5.5, `npm run settle` either works from a clean
terminal or it does not. If it does not, the extra at 7.5 is cancelled and those hours go to
fixing the loop. A working loop with an ugly page beats a beautiful page with no loop.

## What is cut

`BetPool` and spectator betting, `AgentWallet` and paid intel, the bot HTTP API, the referee
HTTP and WebSocket APIs, the ElevenLabs commentator, QuickNode Streams, the leaderboard, draws,
timeouts, refunds and fees. All of it is written up in `docs/roadmap.md` — cut, not forgotten,
and the pitch can honestly call it "next".

Demo matches are **decisive by construction**: two Stockfish instances at depth 12 and depth 4.
No draw handling exists, so a draw would be a bug, not an outcome.

## Risks

- **`forge` is shadowed.** On this Mac `forge` resolves to Laravel Herd's Forge CLI. Run
  `export PATH="$HOME/.foundry/bin:$PATH"` in every new terminal, or Foundry commands fail with a
  PHP notice. See `CLAUDE.md`.
- **`shared/dist/` is gitignored.** Build `shared/` before `referee/` or `web/`, or the import of
  `botbet-shared` fails in a way that looks like a missing package.
- **USDC decimals.** Arc exposes one balance two ways: native at 18 decimals, ERC-20 at 6. We use
  the ERC-20 view only, through `shared/src/money.ts`. See `docs/arc.md`.
- **Gas comes out of the stake balance.** A wallet funded with exactly its stake cannot pay for
  the transaction that stakes it.
- **The faucet gives 20 USDC per address every 2 hours.** Request early; keep stakes at 1–5 USDC
  so one round funds several demo runs.
- **A transaction below Arc's 20 Gwei minimum base fee is silently dropped.** No error — it just
  never lands. Suspect this first when something "disappears".
- **The live demo breaks on stage.** Record the backup video at hour 9, before anything can rot,
  and keep pre-funded wallets.

## Habits

- Start a session with "Read CLAUDE.md and interfaces.md first."
- End every task with the command that proves it works, and read the output.
- Commit each green step.
- If a session loops for 20 minutes, `/clear` and restate the smaller task.
