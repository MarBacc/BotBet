# INTEGRATION.md — team board

Every agent: read **ASKS** every loop. Do your items, push, and the integration lead removes them when they land.
Merge order into `solo`: settle ✅ → agent-wallet ✅ → live-runs (needs human "go live") → web → demo.
Timeline (CST): 04:30 freeze warning · **05:00 feature freeze, fixes only** · 06:00 submission checklist · deadline 12:00.

## ASKS

### settle (feat/settle, merged into solo as #1)
_No open asks. Stay on call for fixes only in referee/** and shared/**._

### web (feat/web, PR #2, merges after live-runs)
1. Set the commit author for new commits: `git config --worktree user.name "Alex Rodriguez"` (no history rewrite). Latest commits are still "Tanish".
2. Once live-runner commits `web/public/cap-demo.json`, eyeball the CapCard against it. Its shape is already verified against the anvil rehearsal output.

### demo (feat/demo, not started)
1. Create `feat/demo` from `origin/solo` and push it. Owns referee/src/demo/**, docs/demo-runbook.md, docs/submission.md, README.md, AGENTS.md, PROGRESS-demo.md.
2. docs/demo-runbook.md: the exact presenter sequence using the real script names in referee/package.json (`npm run check-setup`, `npm run play-game`, `npm run settle`, `npm run settle -- --fen "<FEN>"`, `npm run cap-demo`), and web `npm run dev` or `npm run preview` (`/api/tts` only exists there).
3. README.md: pitch ("referee-attested", never "trustless"), how to run, contract address 0x9d4EEE03C431c524822c6A1486bE6142d2a4916c, settle tx links copied from LIVE-RUNS.md (never invented).
4. If not started by 02:30 the integration lead drafts INTEGRATION-runbook-draft.md and INTEGRATION-readme-draft.md for you to adopt.

### live-runner (feat/live-runs, PR #4)
1. Add the literal line `CHECKPOINT PASSED` to LIVE-RUNS.md next to the two settle txs (0x41ba…02b4, 0xf177…f6f4). Both are verified on Arc RPC: status 1, to MatchEscrow. (settle already recorded it in PROGRESS-settle.md.)
2. Deploy AgentWallet (`contracts/script/DeployAgentWallet.s.sol`), commit `contracts/broadcast/DeployAgentWallet.s.sol/5042002/run-latest.json`, record the address in LIVE-RUNS.md.
3. `npm run cap-demo` with AGENT_WALLET_ADDRESS set, commit `web/public/cap-demo.json`, record the allowed tx in LIVE-RUNS.md.
4. `git merge origin/solo` before pushing. Tip: `cd referee && npm run rehearse:local` (from feat/settle) rehearses the settle loop and the cap demo on anvil first. Optional: one more `npm run settle` afterwards so result.json carries the new `referee` field.
5. Touch only web/public/result.json, web/public/cap-demo.json, LIVE-RUNS.md, contracts/broadcast/DeployAgentWallet.s.sol/5042002/*.json.

### human
1. Start Codex B (demo-agent). feat/demo is not on origin yet.
2. LIVE-RUNNER is running ✅ (two live settles at 01:50). Type **"go live"** once it has added CHECKPOINT PASSED, so feat/live-runs can merge into solo.
3. For the voice button: ELEVENLABS_API_KEY and ELEVENLABS_VOICE_ID in the .env of the machine that runs `npm run dev`/`preview` for the demo.

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

2026-11-20 02:01 CST — solo = settle #1 + agent-wallet #3. integration = solo + settle@8d192f5 + live-runs@f90cda8 + web@f1692e0, no conflicts.

- G1 ✅ shared builds
- G2 ✅ tsc clean; keyless play-game plays and signs, nothing sent
- G3 ✅ forge build + 14/14 tests
- G4 ✅ web build + smoke test green with the real result.json; CapCard type matches cap-demo.json from the rehearsal
- G5 ✅ `npm run rehearse:local`: 2 settles on anvil in 1.5s + cap demo (paid 0.02, refused 0.10 CapExceeded)
- G6 ⏭ waiting on demo branch (README/runbook). No "trustless" claim in repo

Flags: feat/web new commits authored "Tanish" (expected Alex Rodriguez). Rewritten history ~01:30 (see PR comments).
