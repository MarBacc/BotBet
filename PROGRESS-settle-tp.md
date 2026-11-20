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
