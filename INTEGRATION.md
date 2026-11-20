# INTEGRATION.md — team board

Every agent: read **ASKS** every loop. Do your items, push, and the integration lead removes them when they land.
Merge order into `solo`: settle ✅ → agent-wallet ✅ → live-runs (needs human "go live") → web → demo.
Timeline (CST): 04:30 freeze warning · **05:00 feature freeze, fixes only** · 06:00 submission checklist · deadline 12:00.

## ASKS

### settle (feat/settle, merged into solo as #1)
_No open asks. Stay on call for fixes only in referee/** and shared/**._

### web (feat/web, PR #2, merges after live-runs)
1. Set the commit author for new commits: `git config --worktree user.name "Alex Rodriguez"` (no history rewrite). Latest commits are still "Tanish".
2. Eyeball the CapCard against the REAL cap-demo.json: `git show origin/feat/live-runs:web/public/cap-demo.json` (wallet 0xaEb5…5262, cap 0.05, paid 0.02, refused 0.10). Don't commit it; it lands via live-runs.

### demo (feat/demo, not started)
1. Create `feat/demo` from `origin/solo` and push it. Owns referee/src/demo/**, docs/demo-runbook.md, docs/submission.md, README.md, AGENTS.md, PROGRESS-demo.md.
2. docs/demo-runbook.md: the exact presenter sequence using the real script names in referee/package.json (`npm run check-setup`, `npm run play-game`, `npm run settle`, `npm run settle -- --fen "<FEN>"`, `npm run cap-demo`), and web `npm run dev` or `npm run preview` (`/api/tts` only exists there).
3. README.md: pitch ("referee-attested", never "trustless"), how to run, contract address 0x9d4EEE03C431c524822c6A1486bE6142d2a4916c, settle tx links copied from LIVE-RUNS.md (never invented).
4. If not started by 02:30 the integration lead drafts INTEGRATION-runbook-draft.md and INTEGRATION-readme-draft.md for you to adopt.

### live-runner (feat/live-runs, PR #4)
1. Add the literal line `CHECKPOINT PASSED` to LIVE-RUNS.md next to the two settle txs (0x41ba…02b4, 0xf177…f6f4). Both verified on Arc RPC.
2. `git merge origin/solo`, then push. Touch only web/public/result.json, web/public/cap-demo.json, LIVE-RUNS.md, contracts/broadcast/DeployAgentWallet.s.sol/5042002/*.json.
3. Optional, only if the human asks: one more `npm run settle` after the merge so result.json carries the new `referee` field.

### human
1. Start Codex B (demo-agent). feat/demo is not on origin yet.
2. LIVE-RUNNER is done ✅: 2 live settles, AgentWallet 0xaEb5…5262 deployed, cap demo paid 0.02 (tx 0xfa0a…239a), all verified on Arc RPC. Type **"go live"** to merge feat/live-runs into solo.
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

2026-11-20 02:07 CST — solo = settle #1 + agent-wallet #3. integration = solo + settle@f130dce + live-runs@1a2adc3 + web@a75449e, no conflicts.

- G1 ✅ shared builds
- G2 ✅ tsc clean (no referee code changes this round; keyless play-game green last round)
- G3 ✅ 14/14 tests
- G4 ✅ web build + smoke test green with the REAL result.json and REAL cap-demo.json in dist/
- G5 ✅ `npm run rehearse:local` (last round; unchanged code)
- G6 ⏭ waiting on demo branch. No "trustless" claim in repo

Verified on Arc RPC: settle 0x41ba…02b4 and 0xf177…f6f4 (status 1, to MatchEscrow); AgentWallet 0xaEb5…5262 has code; allowed payment 0xfa0a…239a status 1.
Flags: feat/web commits authored "Tanish" (expected Alex Rodriguez).
