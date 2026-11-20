# Demo progress

Updated: 2026-11-20 03:05 CST

## Done

- Read the refreshed `origin/solo:LIVE-RUNS.md` and `origin/feat/qa:QA-REPORT.md`.
- Checked out `docs/screenshots/` from `origin/solo`, then merged `origin/solo` into `feat/demo` cleanly.
- `DEMO_DEFAULT` is the exact Arc live FEN: `8/8/8/4k3/8/8/8/3QK3 w - - 0 1`. The recorded game ended in checkmate after 17 plies; command start to verified settlement took 21.8 seconds. Settle transaction: `0x4f49823d648fc2512bd96c79622c17d04f4ce77d577ad87c6dd2f35c4d8755f3`.
- AgentWallet `0xaEb54edFe9F702B926DF7eaEB0e3Ebfa6C005262` has a 0.05 USDC cap. The allowed 0.02 payment was mined in `0xfa0a3a6faefa6c3fdd00a32620f089edb04b84432429428ba99fd3a3a468239a`. The 0.10 request was simulated and returned `CapExceeded(100000, 50000)`; no refusal transaction was sent.
- Added main, Present, and other screenshot assets. README links main/present screenshots and the repository's 34-second demo recording, has the supplied team names, and contains no video/team placeholder text.
- README run instructions now separate judge keyless commands from live Arc commands that require keys. Foundry appears only under Contract development.
- All five positions passed chess.js loading and three deterministic depth-12/depth-4 checkmate runs; none are mate-in-one.

## Position checker results

Command: `cd referee && npx tsx src/demo/check-positions.ts`

| id | plies (runs 1/2/3) | result | reason | seconds (runs 1/2/3) |
|---|---|---|---|---|
| arc-live-17-ply | 17 / 17 / 17 | white wins all 3 | checkmate; identical moves | 0.68 / 0.71 / 0.69 |
| arc-live-file-mirror | 15 / 15 / 15 | white wins all 3 | checkmate; identical moves | 0.70 / 0.71 / 0.73 |
| arc-live-rank-mirror | 13 / 13 / 13 | white wins all 3 | checkmate; identical moves | 0.58 / 0.58 / 0.56 |
| arc-live-double-mirror | 17 / 17 / 17 | white wins all 3 | checkmate; identical moves | 0.66 / 0.64 / 0.65 |
| queen-c1-candidate | 15 / 15 / 15 | white wins all 3 | checkmate; identical moves | 0.70 / 0.71 / 0.69 |

The checker reports the 13-ply mirrored position as the shortest offline candidate, but `DEMO_DEFAULT` deliberately remains the exact position run live on Arc.

## Next

- Commit and push the correction set to `origin/feat/demo`.
- Open a pull request from `feat/demo` into `solo`.

## Remaining submission items

- Replace the 34-second backup clip with an accessible 2–3 minute submission video if required by Devpost; include audible ElevenLabs commentary only if entering that bounty.
- Confirm repository visibility and complete the Devpost submission. Owners are listed in `docs/submission.md` as placeholders.
