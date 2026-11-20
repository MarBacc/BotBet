# INTEGRATION.md — team board

Every agent: read **ASKS** every loop. Do your items, push, and the integration lead removes them when they land.
Merge order into `solo`: settle ✅ (#1, #5) → agent-wallet ✅ (#3) → live-runs ✅ (#4) → web ✅ (#2) → demo.
Loop: every 2 min. Run all gates: `bash INTEGRATION-gates.sh` (~14s). Timeline (CST): 04:30 freeze warning · **05:00 feature freeze, fixes only** · 06:00 submission checklist · deadline 12:00.

## ASKS

> **02:10 solo moved** to c2ddf51 (live-runs #4, web #2, settle #5 merged). **Every agent: `git fetch origin && git merge origin/solo` now** (keep solo's AGENTS.md/HANDOFF.md). For new work, open a new PR into solo; your old PR is merged.

### settle (feat/settle)
1. `git merge origin/solo`. Your 3 new commits (check-setup verdict, box URLs) are gated green; open a new PR into solo when you want them in.

### web (feat/web)
1. `git merge origin/solo`. Solo now serves the REAL web/public/result.json and cap-demo.json; check them with `npm run dev`.
2. Set the commit author for new commits: `git config --worktree user.name "Alex Rodriguez"` (no history rewrite).

### demo (feat/demo, PR #8, started 02:03; blocked: no node/npm in its shell)
1. Install Node 24 so you can run checks: `brew install node@24 && export PATH="/opt/homebrew/opt/node@24/bin:$PATH"` (or nvm). Until then, items 2–4 need NO node.
2. Runbook + README: `git show origin/feat/integration:INTEGRATION-runbook-draft.md > docs/demo-runbook.md` and `git show origin/feat/integration:INTEGRATION-readme-draft.md > README.md`. Fix the title lines, review, commit, push.
3. Positions: your `check-positions.ts` ran here (integration has node). Every position is white checkmate, deterministic over 3 runs; all are 1 ply except queen-net-b2 (7 plies). A 1-ply game is one move on the replay, too thin for the stage. **Set `DEMO_DEFAULT` to a longer one**: queen-net-b2 (7 plies), or KQ vs K `8/8/8/4k3/8/8/8/3QK3 w - - 0 1` (17 plies, settled on anvil; see `git show origin/feat/integration:INTEGRATION-positions-draft.ts`). Update the PROGRESS table with these results.
4. docs/submission.md: tick what's done; the repo is already public (fix that line). Add the contract + tx links from the README draft.

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
