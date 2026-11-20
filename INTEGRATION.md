# INTEGRATION.md — team board

Every agent: read **ASKS** every loop. Do your items, push, and the integration lead removes them when they land.
Merge order into `solo`: settle ✅ (#1, #5) → agent-wallet ✅ (#3) → live-runs ✅ (#4) → web ✅ (#2) → demo.
Loop: every 2 min. Run all gates: `bash INTEGRATION-gates.sh` (~14s). Timeline (CST): 04:30 freeze warning · **05:00 feature freeze, fixes only** · 06:00 submission checklist · deadline 12:00.

## ASKS

> **04:18 solo moved** to 775d267 by direct push (Alex): GitHub Pages deploy + on-chain cap refusal recorded in README, runbook, cap-demo.json. QA release gate PASS 9/9. Everyone: `git merge origin/solo`.
>
> **03:25 solo moved** to a156dcd (web #23, settle #25, qa #26). Everyone: `git merge origin/solo`.
>
> **03:20 solo moved** to 7406c3f (settle-tp #21: replay-last prints the refusal tx; qa #22: release gate PASS, refreshed screenshots + video). Everyone: `git merge origin/solo`.
>
> **03:14 solo moved** to 1ed8417 (settle #19: money tests; web #18: cap card links an on-chain refusal when present). Everyone: `git merge origin/solo`.
>
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
Cap card "Refused on-chain (tx reverted)" ✅ merged (#23). Fixes only.

### demo (feat/demo, PR #24)
1. **`git fetch origin && git merge origin/solo && git cherry-pick 9422fae && git push`**. 9422fae (README.md only, 4 lines) adds the **ElevenLabs voice commentary** section the bounty needs. The refusal wording is already in solo (775d267), so 895ee6f is obsolete.

### live-runner (feat/live-runs)
1. Stand by. PR #17 (19ffa31, on-chain refusal) is gated green and web is ready (#18). It merges into solo together with demo's PR for 895ee6f. No more live txs unless the human asks.

### poker beta (umbrella `feat/poker`, created 03:45 from solo@a156dcd)
Open PRs **into `feat/poker`, not solo**: feat/poker-engine (ThinkPad), feat/poker-registry (Codex), feat/poker-web (web-agent), plus the live poker run on feat/live-runs. Integration merges them into feat/poker as they land and gates it:
- **P1** chess unchanged: G1–G6 still pass, chess page identical (QA release gate 9/9)
- **P2** `npm run play-poker` works keyless; `npm test` passes
- **P3** register-bot verify passes for all bots
- **P4** web builds; poker tab appears ONLY when `web/public/poker-result.json` exists; 0 console errors
- **P5** reviewer: no blockers
**Status 04:22 (feat/poker @ 2b7b8d8): P1 ✅ P2 ✅ P3 ✅ P4 ✅ · P5 ⏳ waiting on a reviewer verdict.** feat/poker merges cleanly into solo@775d267 (single merge base).
**04:45 decision:** all pass → feat/poker merges into solo and README gets "Poker mode (beta)". Any fail → stays a beta branch; README roadmap lists "Poker mode (beta branch), bot registry". Poker never delays the 05:00 chess freeze.
1. poker-engine ✅ merged into feat/poker (#27): P1 ✅ chess gates green, P2 ✅ play-poker keyless, npm test 29/29. Nit: keyless `play-poker` writes web/public/poker-result.json, which would turn the poker tab on with throwaway-key data. Write to /tmp unless `--out` is given.
2. live poker run ✅ merged into feat/poker (#30): Arc poker settle 0xa794…304d verified status 1 on MatchEscrow. **#17 (live-runs → solo) is blocked**: it now carries poker.
3. poker-registry ✅ merged into feat/poker (#31): P3 ✅, `npm run register-bot -- --verify <name> --dir <folder>` = VERIFIED for all 5 house bots; npm test 32/32.
4. poker-web ✅ merged into feat/poker (#28): P4 ✅. No tab and a byte-identical chess page without poker-result.json; with it the tab appears, the offline run is labelled "NOT SETTLED ON-CHAIN", 0 console errors.

### presenter (feat/presenter, PR #29, not in merge order)
Held: replaces `npm run demo` (settle-owned package.json) and fails on Windows (settle-tp). Needs a human yes/no before 05:00. If yes: new script name `demo:auto`, Windows spawn fix.

### human
0. README Team line now says "listed on the Devpost submission". If you want names in the README, tell demo-agent (or me) the team names and roles.
1. Start Codex B (demo-agent). It's the only piece not in solo.
2. For the voice button: ELEVENLABS_API_KEY and ELEVENLABS_VOICE_ID in the .env of the machine that runs `npm run dev`/`preview` for the demo.

## FINAL CHECK (03:12 CST, clean worktree of origin/solo @ 907b1e7)

**Result: READY TO RECORD BACKUP VIDEO.** No live transactions were sent during this check.

| Check | Result |
|---|---|
| G1–G6 integration gates | ✅ all six (npm test 17/17, forge 14/14, anvil rehearsal 2 settles) |
| QA release gate (fresh clone, keyless, browser) | ✅ PASS 8/8 |
| `npm run check-setup` (no keys) | ✅ "REPLAY ONLY … npm run replay-last" |
| `npm run replay-last` | ✅ run 2 with real explorer links + cap demo |
| `npm run settle -- --dry-run` / `npm run demo -- --dry-run` (no keys) | ✅ stop safely at setup, point to replay-last |
| Page (`vite preview`, Chromium) | ✅ real result.json (Deep Thought wins, 4.00 USDC to 0xBAe2…0E24), no SAMPLE ribbon, cap card present, 0 console errors, 0 px overflow at 390 px |

### Presenter: have these open
1. **Terminal A**, `referee/`, font enlarged: `npm run check-setup`, must say READY. Then `npm run settle -- --fen "8/8/8/4k3/8/8/8/3QK3 w - - 0 1"` (17 plies, ~22 s). Fallback: `npm run replay-last`.
2. **Terminal B**, `web/`: `npm run dev` (needed for the voice button; `.env` must have ELEVENLABS_API_KEY + ELEVENLABS_VOICE_ID).
3. **Browser tab: the page** `http://localhost:5173`. Press **P** for present mode (Space = skip to result, R = replay, Esc = exit).
4. **Explorer tabs (pre-opened):**
   - MatchEscrow https://explorer.testnet.arc.io/address/0x9d4EEE03C431c524822c6A1486bE6142d2a4916c
   - Settle (17-ply stage position) https://explorer.testnet.arc.io/tx/0x4f49823d648fc2512bd96c79622c17d04f4ce77d577ad87c6dd2f35c4d8755f3
   - Settle run 2 (page replay) https://explorer.testnet.arc.io/tx/0xf17764910dcf04c29830834d57d38c8ca8101c16036d694876faf4626f4af6f4
   - AgentWallet https://explorer.testnet.arc.io/address/0xaeb54edfe9f702b926df7eaeb0e3ebfa6c005262
   - Allowed 0.02 payment https://explorer.testnet.arc.io/tx/0xfa0a3a6faefa6c3fdd00a32620f089edb04b84432429428ba99fd3a3a468239a
5. **Backup video** `docs/screenshots/demo.webm` in a tab, in case everything fails.
6. Wording: "referee-attested", never "trustless".

### Still open (not blocking the recording)
- README has **no ElevenLabs section**, which the bounty needs (ASKS → demo 2).
- On-chain cap refusal 0xd21f…3aa3 is held on feat/live-runs. Until web + demo update, solo says the 0.10 refusal was *simulated*, which is accurate for solo's cap-demo.json. If you record now, say "refused by the contract".

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
