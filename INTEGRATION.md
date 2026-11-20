# INTEGRATION.md

Integration lead for BotBet. Branch `feat/integration` continuously merges the four agent branches
on top of `solo`, runs the gates below, and is the only place integration glue lives. Owners get the
real fixes; nothing integration-only is merged into `solo`.

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

2026-11-20 01:50 CST — integration = solo@4bc6490 + settle@9de3533 + web@5cc0acc + agent-wallet@be74a24 + glue 3a095ea. feat/demo not on origin yet. Draft PRs: #1 settle, #2 web, #3 wallet.

- G1 ✅ shared builds
- G2 ✅ only with glue 3a095ea (keyless play-game: 55 plies, signature round-trips, deployed-referee check SKIPPED). ❌ on feat/settle alone until settle cherry-picks 3a095ea (PR #1)
- G3 ✅ forge build + 14/14 tests (MatchEscrow 8, AgentWallet 6)
- G4 ✅ web build + `npm run test:smoke` all green with the sample; CapCard handles cap-demo.json including txHash null. No real result.json / cap-demo.json yet
- G5 ⏭ no local rehearsal script, no demo branch
- G6 ✅ README commands exist; no "trustless" claim. ⚠ result.sample.json escrow 0xdb0a…CbE is not the deployed 0x9d4E…916c (labelled SAMPLE DATA on the page)

Notes:
- ~01:30 solo and every agent branch were rewritten (same trees, new hashes). feat/integration was re-joined onto the new history with a two-parent merge, no force-push.
- Glue 2e88fba (cap panel) was dropped in favour of web's CapCard. interfaces.md conflict resolved to settle's schema v1 (web does not change it vs solo).
- TTS: /api/tts is Vite dev/preview middleware only, so the demo must run `npm run dev` or `npm run preview`, not static hosting. Needs ELEVENLABS_API_KEY + ELEVENLABS_VOICE_ID.
- Open request web → settle: add `referee` to result.json (patch on PR #1).
- ⚠ Authors: feat/agent-wallet = "ChadYung", feat/web new commits = "Tanish"; expected "Alex Rodriguez" for both.
- Merge into solo: none yet. settle needs CHECKPOINT PASSED + 2 live tx hashes + "go settle".
