# INTEGRATION.md — team board

Every agent: read **ASKS** every loop. Do your items, push, and the integration lead removes them when they land.
Merge order into `solo`: settle ✅ (#1, #5) → agent-wallet ✅ (#3) → live-runs ✅ (#4) → web ✅ (#2) → demo.
Timeline (CST): 04:30 freeze warning · **05:00 feature freeze, fixes only** · 06:00 submission checklist · deadline 12:00.

## ASKS

> **02:10 solo moved** to c2ddf51 (live-runs #4, web #2, settle #5 merged). **Every agent: `git fetch origin && git merge origin/solo` now** (keep solo's AGENTS.md/HANDOFF.md). For new work, open a new PR into solo; your old PR is merged.

### settle (feat/settle)
1. `git merge origin/solo`. No other open asks. 17/17 `npm test` and rehearse:local green.

### web (feat/web)
1. `git merge origin/solo`. Solo now serves the REAL web/public/result.json and cap-demo.json; check them with `npm run dev`.
2. Set the commit author for new commits: `git config --worktree user.name "Alex Rodriguez"` (no history rewrite).

### demo (feat/demo, not started)
1. Create `feat/demo` from `origin/solo` and push it. Owns referee/src/demo/**, docs/demo-runbook.md, docs/submission.md, README.md, AGENTS.md, PROGRESS-demo.md.
2. docs/demo-runbook.md: the presenter sequence using the real scripts in referee/package.json (`npm run check-setup`, `npm run demo` / `--dry-run`, `npm run replay-last` as the no-chain fallback, `npm run settle -- --fen "<FEN>"`, `npm run cap-demo`, `npm run rehearse:local`), and web `npm run dev`/`preview` (`/api/tts` only exists there).
3. README.md: pitch ("referee-attested", never "trustless"); MatchEscrow 0x9d4EEE03C431c524822c6A1486bE6142d2a4916c; AgentWallet 0xaEb54edFe9F702B926DF7eaEB0e3Ebfa6C005262; settle tx links copied from LIVE-RUNS.md (never invented).
4. If not started by 02:30, the integration lead drafts INTEGRATION-runbook-draft.md and INTEGRATION-readme-draft.md for you to adopt.

### live-runner (feat/live-runs, merged as #4)
1. `git merge origin/solo`. Stand by. No more live txs unless the human asks (e.g. a fresh settle so result.json carries `referee`).

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

2026-11-20 02:10 CST — solo@c2ddf51 = settle (#1, #5) + agent-wallet #3 + live-runs #4 + web #2. integration = solo.

- G1 ✅ shared builds
- G2 ✅ tsc clean; keyless play-game green; `npm test` 17/17
- G3 ✅ 14/14 forge tests
- G4 ✅ web build + smoke test green with the real result.json and cap-demo.json
- G5 ✅ `npm run rehearse:local`: 2 settles + cap demo on anvil
- G6 ⏭ waiting on demo branch. No "trustless" claim in repo

Verified on Arc RPC: settle 0x41ba…02b4 and 0xf177…f6f4; AgentWallet 0xaEb5…5262 has code; allowed payment 0xfa0a…239a status 1.
live-runs was merged on the human's "go live" with CHECKPOINT PASSED waived (two verified live settles, literal line missing).
