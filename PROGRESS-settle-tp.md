# PROGRESS — settle-tp (backup settle, ThinkPad)

Branch `feat/settle-tp` from origin/solo. Owns referee/** (not referee/src/demo/**), shared/**. Keyless only.

## Log
- 02:30 startup: shared built, referee installed. Health (Git Bash + PowerShell, Node 20.20.2, no .env):
  typecheck ✅ · build ✅ · play-game ✅ (offline, signs, nothing sent) · check-setup ✅ (REPLAY ONLY, lists
  missing keys, exit 0) · replay-last ✅ · settle/demo --dry-run without keys → clear ❌ box + replay hint (expected).
- Fix: `npm test` failed on Windows (`Could not find test\*.test.ts`): cmd.exe does not expand globs and
  Node 20 `--test` cannot either. Now `node scripts/run-tests.mjs` → `node --import tsx --test <files>`.
  17/17 pass in Git Bash and PowerShell.

## Next
- Loop: merge origin/solo, check INTEGRATION.md (settle / settle-tp), QA-REPORT.md ❌ for referee/shared, PR comments.

## QA-REPORT.md (02:38, solo@49e5c2e)
- #6 ❌ `npm test` on Windows (owner settle) → **fixed in 72e4105** on feat/settle-tp (runner globs in Node,
  so new test files are picked up; QA's explicit-list fix not needed). Lands in solo when the PR is merged.
- #1–#5 owned by demo-agent / web-agent: not mine.
- PR not opened by me: `gh` is not installed on this machine. Open it at
  https://github.com/MarBacc/BotBet/pull/new/feat/settle-tp (base solo, title "[settle-tp] fixes").

## 02:55 FIXER (role upgrade)
- Merged origin/solo 8b49caa. QA #6 merged as PR #10 ✅.
- QA #4 / #5: already fixed by web-agent (e74dada, PR #11 in solo), so FIXER made no web edit (no duplicate CSS).
  Verified on 8b49caa: `qa/overflow.mjs` at 390×844 → `[]` (0 elements overflow); CapCard.tsx:76 reads
  "Refused by the contract (simulated):".
- Gates: referee npm test 17/17, play-game 55 plies keyless "Nothing was sent", web build ✅.
- QA ❌ owned by settle/web: 0. Remaining #1–#3 are README (demo-agent; FIXER may not edit README.md).

## 03:10
- Merged origin/solo 907b1e7 (PR #8 demo README merged → QA blocker #1 resolved upstream).
- PR #17 (live, cap-demo.json adds `refusedTxHash`) checked: replay-last + web build ✅ with it.
- `replay-last` now prints the on-chain refusal tx link when `cap-demo.json` has `refusedTxHash`
  (optional field; unchanged output without it). typecheck ✅, npm test 17/17, play-game keyless ✅.

## 03:55 POKER GATE: FAIL (P3, P4 not built yet) — fresh clone of origin/feat/poker @ 30698ce
- P1 chess unchanged ✅: diff vs solo is poker-only (+package.json). shared build, referee install, tsc,
  typecheck, npm test 29/29, play-game keyless, check-setup, replay-last, referee build, web build all ✅.
  (G3 contracts not run: no Foundry on this machine.)
- P2 play-poker keyless ✅: Git Bash + PowerShell, 12–30 hands, signs, "Nothing was sent to the chain".
  Random seed per run by design; `--seed 0x…` twice → same winner + handHistoryHash 0xc01c…c862.
- P3 register-bot --verify ❌: no `register-bot` script in referee/package.json.
- P4 poker tab ❌: no poker code in web/src (play-poker already writes web/public/poker-result.json).
- Screenshots poker.png / poker-present.png: not taken (no tab; and they belong on feat/qa).

## 04:00 POKER GATE: FAIL (P3 only) — origin/feat/poker @ 65ba721 (+ poker-web #28)
- P1 chess ✅: npm test 29/29, play-game keyless, web build, web test:smoke all green.
- P2 play-poker keyless ✅ (unchanged).
- P3 register-bot --verify ❌: still no `register-bot` script (feat/poker-registry not merged yet).
- P4 poker tab ✅ (Chromium 1920×1080, vite preview of a fresh clone): without poker-result.json → no tab,
  0 errors; with a keyless play-poker result → "Poker (beta)" tab, "OFFLINE RUN · NOT SETTLED ON-CHAIN",
  present mode (P key) renders, 0 console/page errors, 0 failed requests.
  Screenshots poker.png + poker-present.png taken locally (scratchpad), not committed: they belong on feat/qa.
- Board nit (keyless play-poker writes web/public/poker-result.json): owner poker-engine, touched 03:45 → left to them.

## 04:05 Review: PR #29 [presenter] (feat/presenter → solo), referee/scripts/demo.mjs — ❌ on Windows
- Reproduced keyless on Windows (Node 20.20.2): preflight → fallback `spawn("npm", …)` cannot start npm.cmd
  without a shell → skips replay-last, prints "Open the backup video", exit 1. Same for the live
  `npm run settle` step on a Windows laptop with keys. Also `process.kill(-pid)` / `detached` are POSIX-only.
- Fix (tested, not pushed: presenter owns the branch, PR opened <15 min ago): run
  `process.execPath --import tsx src/settle.ts|src/replay-last.ts` instead of npm; `detached: !isWin`;
  on win32 kill with `taskkill /pid <pid> /T /F`. With it: fallback replay works, exit 0, Git Bash + PowerShell.
- Note: new `npm run demo` no longer runs src/presenter.ts (cap demo + summary box): intentional?

## 04:08 POKER GATE: FAIL (P3 only) — origin/feat/poker @ 5b83148 (+ live poker run #30)
- P1 ✅ npm test 29/29, play-game keyless, web build + smoke; replay-last now prints the on-chain refusal link.
- P2 ✅ unchanged. P3 ❌ no register-bot script yet (poker-registry not on origin).
- P4 ✅ real poker-result.json: "LIVE ON ARC", Theory wins, settle 0xa794…304d, referee 0xE632…8345,
  stake tx links for both bots, present mode OK, 0 console/page errors. Screenshots refreshed (scratchpad).
- ⚠ feat/poker now carries cap-demo.json `refusedTxHash` (via #30). If feat/poker merges into solo,
  QA #7 (README/runbook still say "simulated / not broadcast") becomes real unless demo's doc fix lands first.

## 04:30 Solo 775d267 merged (Pages deploy + on-chain cap refusal everywhere): npm test 18/18, tsc, play-game, web build + smoke ✅.

## 04:30 POKER GATE: FAIL on Windows (P3) — feat/poker 5b83148 + PR #31 feat/poker-registry merged locally
- P1 ✅ P2 ✅ P4 ✅ as at 04:08. npm test with registry 32/32, tsc ✅.
- P3 ❌ on Windows: `npm run register-bot -- --verify <name> --dir src/registry/house/<bot>` → MISMATCH for all
  5 house bots. Cause: git core.autocrlf=true checks the bot sources out with CRLF; registry-core.ts hashes raw
  bytes, while the registered hashes come from LF files. Proven: LF-normalized files → VERIFIED.
  Expected to pass on macOS/Linux.
- Fix (tested, not pushed: registry agent owns PR #31, opened <15 min ago): registry-core.ts
  `readForHash()` = readFile, and for text files (no NUL byte) replace CRLF with LF before hashing; use it
  for package files and the @entry alias. LF hashes unchanged. With it on a CRLF checkout: all 5 VERIFIED
  (Deep Thought 0x132e…d904, Hasty Hal 0x8bf7…5fd9, Maniac 0x9665…7228, Nit 0x0ee1…6c4d, Theory 0x5e57…bde0).

## 04:27 P3 fix pushed (human OK for a new branch): feat/settle-tp-poker @ 9dceec0, base feat/poker 2b7b8d8
- registry-core.ts `readForHash()` (CRLF → LF for text files before hashing) + regression test
  "CRLF checkout verifies against an LF registration" (fails without the fix). npm test 33/33, tsc ✅.
- Windows CRLF checkout: all 5 house bots VERIFIED. PR (base feat/poker):
  https://github.com/MarBacc/BotBet/compare/feat/poker...feat/settle-tp-poker?expand=1
