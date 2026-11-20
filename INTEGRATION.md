# INTEGRATION.md — team board

Every agent: read **ASKS** every loop. Do your items, push, and the integration lead removes them when they land.
Merge order into `solo`: settle ✅ (#1, #5) → agent-wallet ✅ (#3) → live-runs ✅ (#4) → web ✅ (#2) → demo.
Loop: every 2 min. Run all gates: `bash INTEGRATION-gates.sh` (~14s). Timeline (CST): 04:30 freeze warning · **05:00 feature freeze, fixes only** · 06:00 submission checklist · deadline 12:00.

## ASKS

> **02:47 solo moved** to 8299f96 (qa #9: screenshots + QA-REPORT.md; settle-tp #10: Windows `npm test`). Everyone: `git merge origin/solo`.
>
> Earlier: **02:10 solo moved** to c2ddf51 (live-runs #4, web #2, settle #5 merged). **Every agent: `git fetch origin && git merge origin/solo` now** (keep solo's AGENTS.md/HANDOFF.md). For new work, open a new PR into solo; your old PR is merged.

### settle / settle-tp
QA #6 (Windows `npm test`) fixed in settle-tp #10 ✅. ⚠ settle-tp commits are authored "name of the person using the ThinkPad": set a real `user.name`.

### settle (feat/settle)
1. `git merge origin/solo`. Your 3 new commits (check-setup verdict, box URLs) are gated green; open a new PR into solo when you want them in.

### web (feat/web) — QA fixes, see `git show origin/solo:QA-REPORT.md`
1. `git merge origin/solo`.
2. **QA #4 mobile overflow (59 px at 390×844):** at the END of `web/src/index.css` add `@media(max-width:1000px){.grid{grid-template-columns:minmax(0,1fr)}}`. The 1400 px rule on line 59 currently overrides the 1000 px single-column rule on line 19. Check with `cd qa && npm install && npx playwright install chromium && node screenshots.mjs http://localhost:4173/` (want "horizontal overflow px: 0").
3. **QA #5 cap card wording:** `web/src/CapCard.tsx:76` change `Refused on-chain:` to `Refused by the contract (simulated):`. The 0.10 payment was simulated (LIVE-RUNS.md:43); there is no refusal tx.
4. `npm run build && npm run test:smoke`, commit, push. Integration merges into solo.
5. New commits: author "Alex Rodriguez" (`git config --worktree user.name "Alex Rodriguez"`).

### demo (feat/demo, PR #8). **Blocker for solo (QA #1): solo still has the internal README.** Integration merges #8 as soon as 1–3 land.
1. `git merge origin/solo` (brings docs/screenshots/*.png and QA-REPORT.md).
2. **QA #2 placeholders:** README lines 5, 49, 90 `[video link]` (use the real URL, or delete those lines until it exists); 88 `[team member names]`; 89 `[credits and roles]`. Fill or remove every one.
3. **QA #3 run steps:** replace "Run it yourself" with the two-block text in `git show origin/solo:QA-REPORT.md` ("Fix #3"): a judge block with no keys and no Foundry (Node 20.12+, play-game, check-setup, replay-last, web build + preview) and a separate live block (`settle -- --dry-run` then `settle`). No unfilled `--fen "<…>"`.
4. **ElevenLabs section** in README (the bounty needs it): copy from `git show origin/feat/integration:INTEGRATION-readme-draft.md`.
5. QA #24: embed `docs/screenshots/main.png` and `docs/screenshots/winner.png` under the README intro.
6. Runbook/positions: the FEN `7k/8/5KQ1/…` is 1 ply; use KQ vs K `8/8/8/4k3/8/8/8/3QK3 w - - 0 1` (17 plies) and add the `npm run replay-last` fallback.
7. Push, then mark PR #8 ready.

### live-runner (feat/live-runs, merged as #4)
1. `git merge origin/solo`. Stand by: no more live txs unless the human asks. (CHECKPOINT PASSED line added ✅)

### human
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
