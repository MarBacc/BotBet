# Demo progress

Updated: 2026-11-20 02:47 CST

## Done

- Confirmed this worktree is `/Users/alexrdz/Bot-Arena/botbet-demo`, branch `feat/demo`, clean at synced commit `d092296`.
- Read `origin/feat/live-runs:LIVE-RUNS.md`; captured its two verified settle runs and AgentWallet deployment details for judge materials.
- Wrote this task's working rules to `AGENTS.md`.
- Built `shared/` and installed `referee/` with Node 24 in `/private/tmp`; no lockfiles were changed.
- Ran keyless `npm run play-game`: Deep Thought checkmated in 28 moves (55 plies); no chain call was made.
- Added five chess.js-validated tactical FENs and a checker that uses the existing `playGame({ startFen })` function. Confirmed each position three times with identical moves; no existing game/engine/bot files were changed.
- Wrote the 3-minute runbook, including truthful on-chain/recorded-run distinctions and Arc transaction fallbacks.
- Wrote the judge-facing README with deployment addresses, verified settle transaction links, security limits, and setup steps.
- Filled the submission checklist with selected categories, linked deployments and settle transactions, and owner placeholders.
- Tasks 1–5 are committed and pushed to `origin/feat/demo`.
- Updated the runbook, README, checklist, and this results log after the offline position checks passed.

## Next

- Report the final branch/worktree state and remaining demo-preparation items.
- Commit and push each task to `origin/feat/demo`.

## Blockers

- The short-FEN run has not been settled on-chain in this task. Use the recorded standard-game transactions as the live proof unless the settle operator rehearses the short FEN on the demo laptop.
- `origin/feat/web` has Present mode, voice, and AgentWallet card work, but those files are not integrated into this branch's `web/` tree. Integrate that branch before using those UI features on stage.
- The demo video and team names remain placeholders.

## Position checker results

Command: `cd referee && npx tsx src/demo/check-positions.ts` — all FENs loaded successfully in chess.js; each game ran with the existing depth-12/depth-4 engines three times.

| id | plies (runs 1/2/3) | result | reason | seconds (runs 1/2/3) |
|---|---|---|---|---|
| queen-net-g7 | 1 / 1 / 1 | white wins all 3 | checkmate all 3; identical moves | 0.53 / 0.60 / 0.61 |
| queen-net-b7 | 1 / 1 / 1 | white wins all 3 | checkmate all 3; identical moves | 0.93 / 0.51 / 0.48 |
| queen-net-g2 | 1 / 1 / 1 | white wins all 3 | checkmate all 3; identical moves | 0.46 / 0.47 / 0.53 |
| queen-net-b2 | 7 / 7 / 7 | white wins all 3 | checkmate all 3; identical moves | 0.77 / 0.53 / 0.47 |
| queen-net-e7 | 1 / 1 / 1 | white wins all 3 | checkmate all 3; identical moves | 0.44 / 0.45 / 0.48 |

`DEMO_DEFAULT` is `queen-net-g7`, the first of the shortest reliable positions: one ply to checkmate with identical UCI moves in all three runs.

## Runbook status

- Present mode, launched with `P`, is described from the existing web branch. Its cap-demo implementation broadcasts the allowed 0.02 USDC payment and simulates the 0.10 USDC attempt, which returns `CapExceeded` without being broadcast. No cap-demo record or payment hash was found in `LIVE-RUNS.md`.
- Two real standard-game settle hashes are linked from `LIVE-RUNS.md`. The short-FEN settle and a fresh cap-demo record have not been performed here.
