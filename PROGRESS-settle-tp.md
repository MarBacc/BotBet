# PROGRESS — settle-tp (backup settle, ThinkPad)

Branch `feat/settle-tp` from origin/solo. Owns referee/** (not referee/src/demo/**), shared/**. Keyless only.

## Log
- 03:5x startup: shared built, referee installed. Health (Git Bash + PowerShell, Node 20.20.2, no .env):
  typecheck ✅ · build ✅ · play-game ✅ (offline, signs, nothing sent) · check-setup ✅ (REPLAY ONLY, lists
  missing keys, exit 0) · replay-last ✅ · settle/demo --dry-run without keys → clear ❌ box + replay hint (expected).
- Fix: `npm test` failed on Windows (`Could not find test\*.test.ts`): cmd.exe does not expand globs and
  Node 20 `--test` cannot either. Now `node scripts/run-tests.mjs` → `node --import tsx --test <files>`.
  17/17 pass in Git Bash and PowerShell.

## Next
- Loop: merge origin/solo, check INTEGRATION.md (settle / settle-tp), QA-REPORT.md ❌ for referee/shared, PR comments.
