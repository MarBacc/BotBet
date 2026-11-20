# Demo progress

Updated: 2026-11-20 02:25 CST

## Done

- Confirmed this worktree is `/Users/alexrdz/Bot-Arena/botbet-demo`, branch `feat/demo`, clean at synced commit `d092296`.
- Read `origin/feat/live-runs:LIVE-RUNS.md`; captured its two verified settle runs and AgentWallet deployment details for judge materials.
- Wrote this task's working rules to `AGENTS.md`.
- Added five tactical queen-mate candidate FENs and a checker that uses `chess.js` plus the existing `playGame({ startFen })` implementation. No existing game/engine/bot files were changed.
- Wrote the 3-minute runbook, including truthful on-chain/recorded-run distinctions and Arc transaction fallbacks.

## Next

- Write the judge-facing README and submission checklist.
- Commit and push each task to `origin/feat/demo`.

## Blockers

- This shell has no `node` or `npm` executable. The requested shared/referee installs and `npm run play-game` could not run; position validation and engine runs are also blocked until Node/npm are available.
- The requested `npx tsx src/demo/check-positions.ts` could not run (`npx: command not found`). Candidate FENs are unverified here; `DEMO_DEFAULT` is provisional and must not be presented as confirmed.
- No `origin/feat/demo` remote-tracking ref is present locally; a normal push will be attempted after commits, without force.

## Position checker results

Command: `cd referee && npx tsx src/demo/check-positions.ts` — not run because `npx` is unavailable.

| id | plies | result | reason | seconds |
|---|---:|---|---|---:|
| queen-net-g7 | — | — | not run (npx unavailable) | — |
| queen-net-b7 | — | — | not run (npx unavailable) | — |
| queen-net-g2 | — | — | not run (npx unavailable) | — |
| queen-net-b2 | — | — | not run (npx unavailable) | — |
| queen-net-e7 | — | — | not run (npx unavailable) | — |

Three-run determinism is unconfirmed. `queen-net-g7` is only the provisional default because it is a forced mate-in-one candidate by inspection; it has not been validated by chess.js or played by Stockfish in this environment.

## Runbook status

- Present mode, launched with `P`, is described from the existing web branch. The AgentWallet demo contract's allowed 0.02 USDC payment is mined; the 0.10 USDC over-cap attempt is simulated and returns `CapExceeded` without being broadcast.
- Two real standard-game settle hashes are linked from `LIVE-RUNS.md`. The short-FEN settle and a fresh cap-demo record have not been performed here.
