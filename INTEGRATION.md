# INTEGRATION.md — team board

Every agent: read **ASKS** every loop. Do your items, push, and the integration lead removes them when they land.
Merge order into `solo`: settle ✅ (#1, #5) → agent-wallet ✅ (#3) → live-runs ✅ (#4) → web ✅ (#2) → demo.
Loop: every 2 min. Run all gates: `bash INTEGRATION-gates.sh` (~14s). Timeline (CST): 04:30 freeze warning · **05:00 feature freeze, fixes only** · 06:00 submission checklist · deadline 12:00.

## ASKS

> **03:09 solo moved** to 907b1e7: **demo #8 merged, judge README on solo, QA release gate PASS 8/8.** Everyone: `git merge origin/solo`.
>
> **Pending: on-chain cap refusal.** live-runs 19ffa31 broadcast the 0.10 USDC over-cap payment, which reverted with `CapExceeded` (tx 0xd21f…3aa3, receipt status 0, verified). cap-demo.json gains `refusedTxHash`. It is held out of solo until web and demo stop saying "simulated / not broadcast".
>
> **02:55 solo moved** to 6fcb39c (live-runs #12: 17-ply live settle 0x4f49…55f3 is the page's result.json; qa #13: backup demo video docs/screenshots/demo.webm). Everyone: `git merge origin/solo`.
>
> **02:50 solo moved** to 8b49caa (web #11: QA #4 + #5). Everyone: `git merge origin/solo`.
>
> **02:47 solo moved** to 8299f96 (qa #9: screenshots + QA-REPORT.md; settle-tp #10: Windows `npm test`). Everyone: `git merge origin/solo`.
>
> Earlier: **02:10 solo moved** to c2ddf51 (live-runs #4, web #2, settle #5 merged). **Every agent: `git fetch origin && git merge origin/solo` now** (keep solo's AGENTS.md/HANDOFF.md). For new work, open a new PR into solo; your old PR is merged.

### settle / settle-tp
QA #6 (Windows `npm test`) fixed in settle-tp #10 ✅. ⚠ settle-tp commits are authored "name of the person using the ThinkPad": set a real `user.name`.

### settle (feat/settle)
1. `git merge origin/solo`. Your 3 new commits (check-setup verdict, box URLs) are gated green; open a new PR into solo when you want them in.

### web (feat/web)
1. `git merge origin/solo`.
2. **Cap card, on-chain refusal:** `cap-demo.json` on origin/feat/live-runs now has `"refusedTxHash": "0xd21f2097ccb7dd43093b5d6d526807ca8e672d20e585db1e946d74c2dfef3aa3"` (a reverted tx, status 0). In `web/src/CapCard.tsx`: add `refusedTxHash?: string` to the type. When present, render `Refused on-chain (tx reverted): 0.10 USDC` with an explorer link to that tx; when absent, keep `Refused by the contract (simulated):`. Test with `git show origin/feat/live-runs:web/public/cap-demo.json` (don't commit it). `npm run build && npm run test:smoke`, push.
3. New commits: author "Alex Rodriguez".

### demo (feat/demo, merged as #8 ✅)
1. `git merge origin/solo`, then open a new PR into solo.
2. **README: add an "## ElevenLabs voice commentary" section.** The bounty needs it and it is still missing. Text: `git show origin/feat/integration:INTEGRATION-readme-draft.md` ("## ElevenLabs").
3. **README lines 51 and 63:** the 0.10 USDC over-cap payment WAS broadcast and reverted with `CapExceeded(100000, 50000)`: [tx](https://explorer.testnet.arc.io/tx/0xd21f2097ccb7dd43093b5d6d526807ca8e672d20e585db1e946d74c2dfef3aa3) (receipt status 0, wallet balance unchanged). Replace "simulated … not broadcast" with that, and do the same in docs/demo-runbook.md if it says simulated.

### live-runner (feat/live-runs)
1. Stand by. 19ffa31 (on-chain refusal) is gated green and merges into solo as soon as web item 2 and demo item 3 land. No more live txs unless the human asks.

### human
0. README Team line now says "listed on the Devpost submission". If you want names in the README, tell demo-agent (or me) the team names and roles.
1. Start Codex B (demo-agent). It's the only piece not in solo.
2. For the voice button: ELEVENLABS_API_KEY and ELEVENLABS_VOICE_ID in the .env of the machine that runs `npm run dev`/`preview` for the demo.

## Role


- Merge order into `solo`: `feat/settle` → `feat/web` → `feat/agent-wallet` → `feat/demo`.
- A branch merges into `solo` (via `gh pr merge`) when: it is next in order, its ownership check
  passes, G1–G4 pass with it merged, the reviewer verdict is not "FIX FIRST", and for `feat/settle`
  only: PROGRESS says "CHECKPOINT PASSED" with two live settle tx hashes and the human said "go settle".
- No live transactions, no `.env` reads, no pushes to other agents' branches.

## Ownership

| branch | agent | owns |
|---|---|---|
| feat/settle | settle-agent | referee/** (not referee/src/demo/**), shared/**, interfaces.md, web/public/result*.json, web/public/cap-demo.json, PROGRESS-settle.md |
| feat/web | web-agent | web/** (not web/public/*.json), PROGRESS-web.md |
| feat/agent-wallet | wallet-agent | contracts/src/AgentWallet.sol, contracts/test/AgentWallet.t.sol, contracts/script/DeployAgentWallet.s.sol, AGENTS.md, PROGRESS-wallet.md |
| feat/demo | demo-agent | referee/src/demo/**, docs/demo-runbook.md, docs/submission.md, README.md, AGENTS.md, PROGRESS-demo.md |

AGENTS.md, HANDOFF.md and PROGRESS-*.md are shared; conflicts resolve to solo's version (keep both PROGRESS files).

## Gates

- **G1** shared builds: `cd shared && npm install && npm run build`
- **G2** referee: `cd referee && npm install && npx tsc --noEmit && npm run play-game` (no keys, no chain)
- **G3** contracts: `cd contracts && forge build && forge test`
- **G4** web: `cd web && npm install && npm run build` with result.sample.json, and with settle's real result.json / cap-demo.json when they exist
- **G5** local end to end against anvil (if a local rehearsal script exists); demo `check-positions.ts` if present
- **G6** docs sanity: README / docs/demo-runbook.md commands match referee/package.json; no "trustless"; no invented tx hashes

## Latest run

2026-11-20 02:14 CST — solo@49e5c2e (settle #1 #5 #6, wallet #3, live-runs #4, web #2 #7). integration = solo + settle@0c70445 + web@efc5a41 (sync/PROGRESS only).

G1 ✅ shared · G2 ✅ tsc + keyless play-game + npm test 17/17 · G3 ✅ 14/14 · G4 ✅ build + smoke with real result.json & cap-demo.json · G5 ✅ rehearse:local 2 settles · G6 ✅ docs/drafts commands exist, no trustless

Verified on Arc RPC: settle 0x41ba…02b4 and 0xf177…f6f4; AgentWallet 0xaEb5…5262 has code; allowed payment 0xfa0a…239a status 1.
Open: demo branch missing (drafts INTEGRATION-runbook-draft.md / INTEGRATION-readme-draft.md ready to adopt).
