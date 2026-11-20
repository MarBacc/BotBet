# BotBet QA report

**🟢 SOLO RELEASE GATE: PASS** (solo @ `775d267`, fresh clone, 04:18 CST; 9 checks, G9 now exercised with the on-chain refusal). First PASS was at `907b1e7` (03:11).
**🔴 feat/poker `2b7b8d8` merged onto solo (preview, 04:25): FAIL (1): G10.** Bot registry (PR #31) does not verify on a Windows clone: `register-bot --verify` → MISMATCH for all 5 house bots (Deep Thought, Hasty Hal, Maniac, Nit, Theory) with `core.autocrlf=true`. Registered hashes are over LF bytes; Windows checks the sources out as CRLF. `npm test` (32/32) does not catch it. Confirms FIXER's P3 (feat/settle-tp `586375a`). **Do not merge feat/poker into solo until G10 is ✅.** Fix (registry owner, either one): (a) one line in the repo-root `.gitattributes`: `referee/src/registry/house/** text eol=lf` (forces LF checkout everywhere, hashes unchanged); or (b) FIXER's tested `readForHash()` in registry-core.ts (CRLF→LF for text files before hashing). Check: `MERGE=feat/poker bash qa/release-gate.sh solo <dir>` → G10 ✅.
At `5b83148` (before the registry): PASS 9/9. Poker checks: live result (`offline:false`, Theory beats Maniac 200–0 in 9 hands), handHistoryHash recomputes and equals the signed pgnHash, moveCount = hands, all 6 txs + matchId in LIVE-RUNS.md, Poker (beta) tab 0 console errors. Nit P1 below.
Earlier heads: feat/demo `f7aa2e4` (in solo), feat/web `b75a3ae` (in solo), feat/settle-tp `ff5a9e6` (in solo), **feat/live-runs `19ffa31` (preview merge: FAIL G9, see #7, merge only together with a docs update)**.

## Release gate (solo)

Fresh clone of `origin/solo` on each loop: `bash qa/release-gate.sh solo <dir> 4175`. For a branch preview, add `MERGE=feat/demo`.

| Gate | solo `907b1e7` (03:11) | history |
|---|---|---|
| G1 judge README on solo | ✅ | ❌ at `8b49caa`/`c022a07`, fixed by PR #8 |
| G2 no `[video link` / `[team` / `<validated` (also no `[...]`/TODO/TBD) | ✅ | ❌ on feat/demo `cc0dafb`, fixed `e7dbce3` |
| G3 keyless path: play-game, check-setup, replay-last, npm test, web build + preview | ✅ | ✅ |
| G4 0 console errors, real data, Present end screen | ✅ | ✅ |
| G5 page + README hashes all in data, testnet explorer only | ✅ | ✅ |
| G6 mobile 390px overflow = 0 | ✅ | ✅ since `e74dada` |
| G7 README references docs/screenshots/*, files exist | ✅ main.png, present.png, demo.webm | ❌ before `0b69caa` |
| G8 docs/demo-runbook.md `npm run` scripts exist | ✅ | ❌ before PR #8 |
| G9 cap refusal wording matches cap-demo.json (on-chain tx ⇒ docs must not say "not broadcast") | ✅ (no refusal tx yet) | ❌ on solo + feat/live-runs `19ffa31`, see #7 |

Backup video: `docs/screenshots/demo.webm`, 3.78 MB, 1920×1080, 34 s (page → Present replay → winner/payout → cap card → About). Made by `qa/record-demo.mjs`. No mp4/gif because ffmpeg is not installed here.

Tested: `origin/solo` @ `49e5c2e`, `origin/feat/demo` @ `c6e885d` (README unchanged since `28c8d6d`; `docs/submission.md` hashes match, still has `[video link]` at line 12, see #2) · Windows 11, Git Bash, Node v20.20.2, npm 10.8.2 · 2026-11-20 02:38 CST.
Fresh clone in an empty temp folder, no keys (`.env` copied from `.env.example`), no transactions sent.

**Open: 0 ❌ on solo; 1 nit on feat/poker (P1). #7 fixed in `775d267` ("Record the on-chain cap refusal everywhere"; G9 ✅).
P1 (nit, poker-engine + poker-web): the poker banner reads "Pot paid to 0xBAe2…0E24" with no amount, because poker-result.json has no stake/pot field. Fix: the engine adds `stakeUsdc`/`potUsdc` (base units, as in result.json) to settle-poker's output, and poker-web shows them. Only needed if poker is in the demo.
Screenshots + demo.webm regenerated from solo `775d267` at 04:18 (wallet card now shows the reverted tx; 0 console errors). Fixed: #1 #2 #3 (`e7dbce3`, solo `907b1e7`), #4 #5 (`e74dada`), #6 (`72e4105`). Screenshots + demo.webm regenerated from solo `907b1e7` at 03:12 (main 396 KB, mobile 191 KB, demo.webm 3.66 MB, 0 console errors).**

## Results

| # | Check | | Details | Owner | Fix instruction |
|---|---|---|---|---|---|
| 1 | Judge README is on `solo` | ✅ PR #8 → solo `907b1e7`. Originally ❌ BLOCKER: | `solo`'s README is still the internal one ("Fill these in as they become true…", needs `forge`). The judge README exists only on `origin/feat/demo` (28c8d6d). | demo-agent | Open a PR `feat/demo` → `solo` and merge it before the 05:00 freeze. |
| 2 | README has no placeholders | ✅ `e7dbce3` (no `[...]`, TODO or TBD left). Originally: | `feat/demo` README lines 5, 49, 90 `[video link]`; 88 `[team member names]`; 89 `[credits and roles]`. | demo-agent | Replace the 3 `[video link]` with the real URL (or delete those lines until it exists), fill Team and Credits. |
| 3 | README run steps are safe for judges | ✅ `e7dbce3`: separate Judges (no keys) / Live on Arc / Contract development sections, Node 20.12+. Originally: | The "Run it yourself" block pastes `npm run settle` (real transactions) and an unfilled `--fen "<validated demo FEN>"`. It says Foundry is needed "for contract development" but still puts `export PATH="$HOME/.foundry/bin:$PATH"` in the judge path. Missing the keyless commands that work: `npm run check-setup`, `npm run replay-last`, web `build` + `preview`. It says Node 20; `check-setup` requires **20.12**. | demo-agent | Split into two blocks (text below the table). |
| 4 | Mobile layout (390×844) | ✅ `e74dada` (on solo via PR #11, `8b49caa`); gate G6 overflow 0. Originally: | 59 px horizontal scroll; the Moves panel reaches x = 505 px. Cause: `web/src/index.css:59` `@media(max-width:1400px){… .grid{grid-template-columns:minmax(0,520px) minmax(0,1fr)} …}` comes after the 1000 px single-column rule on line 19, so it wins on phones. | web-agent | At the end of `web/src/index.css` add `@media(max-width:1000px){.grid{grid-template-columns:minmax(0,1fr)}}`. Check with `node qa/screenshots.mjs` ("horizontal overflow px: 0"). |
| 5 | Cap card wording matches the facts | ✅ `e74dada` now reads "Refused by the contract (simulated)". Originally: | The card says **"Refused on-chain: 0.10 USDC"**. README and LIVE-RUNS.md:43 say the 0.10 payment was *simulated* and not broadcast; `cap-demo.json` has no refusal tx. A judge looking for that tx won't find one. | web-agent | `web/src/CapCard.tsx:76`: change `Refused on-chain:` to `Refused by the contract (simulated):`. |
| 6 | `npm test` (referee) on Windows | ✅ `72e4105` (`node scripts/run-tests.mjs`, on solo via PR #10); passes in the gate. Originally: | `Could not find '…\referee\test\*.test.ts'`, exit 1. npm runs scripts through cmd.exe, which does not expand globs, and Node 20's `--test` doesn't either. | settle | `referee/package.json`: `"test": "tsx --test test/eip712.test.ts test/fen.test.ts test/money.test.ts"`. |
| 7 | Cap refusal story is the same everywhere | ✅ `775d267` (G9). Originally ❌ latent: | feat/live-runs `19ffa31` adds `refusedTxHash 0xd21f2097…3aa3` (on-chain revert, status 0, block 73163897). Once merged, the page shows "Refused on-chain (tx reverted)" with a link, but README.md:51 and :63, docs/demo-runbook.md:42, :44 (presenter line "no reverting transaction was sent") and :56, and LIVE-RUNS.md:45 still say *simulated / not broadcast*. | demo-agent (README, docs) + live-runs (LIVE-RUNS.md:45) | Merge feat/live-runs **only together with** the doc update in the owner message, or don't merge it. Check: `MERGE=feat/live-runs bash qa/release-gate.sh` → G9 ✅. |
| 7a | Fresh clone of `solo` | ✅ | 1 s | | |
| 8 | `shared`: `npm install && npm run build` | ✅ | 3 s + 1 s (`prepare` already builds) | | |
| 9 | `referee`: `npm install` | ✅ | 18 s. Nit: rewrites `referee/package-lock.json` (drops 2 `"peer": true`), harmless | | |
| 10 | `npm run play-game` (no keys) | ✅ | 4 s, 55 plies, signs with a throwaway key, "Nothing was sent to the chain." | | |
| 11 | `npm run check-setup` (no keys) | ✅ | Clear ✅/❌ list naming each missing key, RPC reachable, ends "REPLAY ONLY … npm run replay-last". No key values printed. | | |
| 12 | `npm run settle -- --dry-run` (no keys) | ✅ | Stops at "setup" with a clear message and sends nothing. | | |
| 13 | `npm run replay-last` | ✅ | 2 s, shows the recorded run 2 and the cap demo, with explorer links | | |
| 14 | `referee`: `npm run build` | ✅ | 4 s | | |
| 15 | `web`: `npm install && npm run build` | ✅ | 4 s + 3 s | | |
| 16 | `web`: `npm run preview` renders real data | ✅ | Banner "Deep Thought wins vs Hasty Hal · Pot 4.00 USDC paid to 0xBAe2…0E24", no SAMPLE ribbon, cap card present, **0 console/page errors** | | |
| 17 | Windows portability | ✅ | No `.sh` scripts; npm scripts use `node`/`tsx`. Stockfish WASM runs. Only failure is #6. | | |
| 18 | Hashes/addresses: README ↔ data | ✅ | Every 0x value in both READMEs is in `result.json` / `cap-demo.json` / `LIVE-RUNS.md` / `deployments.json`. Nothing invented. | | |
| 19 | Page links ↔ data | ✅ | All 13 links on the page match `result.json`, `cap-demo.json` and `deployments.json` (referee `0xE632…8345`). | | |
| 20 | Explorer base URL | ✅ | Every link uses `https://explorer.testnet.arc.io` (docs/arc.md). The mainnet URL appears only in arc.md's table. | | |
| 21 | Run 1 / Run 2 claims | ✅ | LIVE-RUNS: both Deep Thought, 55 plies, 4.000000 USDC; settle hashes `0x41ba…02b4` and `0xf177…f6f4` match the README | | |
| 22 | `MAX_STAKE` claim | ✅ | `1_000_000_000_000` base units = 1,000,000 USDC (MatchEscrow.sol:45) | | |
| 23 | Word "trustless" | ✅ | Only in HANDOFF.md:13 ("referee-attested, not trustless") and the vendored OpenZeppelin README. | | |
| 24 | Screenshots for README | ✅ | `docs/screenshots/{main,wallet-card,present,winner,mobile}.png` on `feat/qa`, 34 to 393 KB each. Script: `qa/screenshots.mjs` | demo-agent | Once `feat/qa` is merged, embed `docs/screenshots/main.png` and `winner.png` under the README intro. |

### Fix #3: proposed README "Run it yourself" text

````markdown
## Run it yourself

**Judges (no keys, nothing sent on-chain).** Node.js 20.12+ and npm. Foundry is *not* needed.

```bash
git clone https://github.com/MarBacc/BotBet.git && cd BotBet
cd shared && npm install && npm run build
cd ../referee && npm install
npm run play-game      # plays a full Stockfish game offline and signs the result
npm run check-setup    # shows what a live run would need
npm run replay-last    # replays the recorded live Arc run, with explorer links
cd ../web && npm install && npm run build && npm run preview   # open the printed URL
```

**Live settle on Arc testnet (needs funded burner keys).** `cp .env.example .env`, add four testnet keys,
then in `referee/` run `npm run settle -- --dry-run` and, after checking it, `npm run settle`.
Foundry (`forge`) is only needed to rebuild or redeploy `contracts/`.
````

## Console log (qa/screenshots.mjs, 1920×1080 + 390×844)

```
[main] sample ribbon present: false
[mobile] horizontal overflow px: 59
main.png 393 KB · wallet-card.png 34 KB · present.png 114 KB · winner.png 89 KB · mobile.png 207 KB
no console errors, no page errors, no failed requests
```

## Reproduce

```bash
cd web && npm run build && npx vite preview --port 4173 &
cd qa && npm install && npx playwright install chromium
node screenshots.mjs http://localhost:4173/   # PNGs + qa/console.log
node fresh-check.mjs http://localhost:4173/   # banner / sample / errors as JSON
node links.mjs http://localhost:4173/         # every external href on the page
node overflow.mjs http://localhost:4173/      # elements wider than 390px
```
