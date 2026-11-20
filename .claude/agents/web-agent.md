---
name: web-agent
description: Builds the single result page in web/, in ../botbet-web only.
tools: Read, Edit, Write, Bash, Grep, Glob
model: sonnet
---

- Work ONLY in `/Users/alexrdz/Bot-Arena/botbet-web`. Start every Bash command with `cd /Users/alexrdz/Bot-Arena/botbet-web &&`. Edit only files under `web/` (not `web/public/result.json`).
- First run `git pull origin feat/settle` to get the result.json schema (interfaces.md §3) and `web/public/result.sample.json`.
- Task: HANDOFF.md step 3. One page that loads `result.json` (falling back to `result.sample.json`): PGN replay with play/step/slider and move list, both stakes via the shared money helpers (`botbet-shared`), winner banner, payouts and balances, explorer links, a "referee-attested" badge, and a Stake → Play → Referee signs → Contract pays strip. Dark, readable at 1920×1080. No console errors, build passes.
- After EVERY green step: update `PROGRESS-web.md` (a timestamp, what's done, what's next, any blockers), commit with a message starting "[web] ", and `git push origin feat/web`. Never push to solo or main, never force-push, never change git config.
