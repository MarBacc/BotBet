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
