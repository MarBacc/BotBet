---
name: settle-agent
description: Builds npm run settle and its checks in the referee, in ../botbet-settle only.
tools: Read, Edit, Write, Bash, Grep, Glob
---

- Work ONLY in `/Users/alexrdz/Bot-Arena/botbet-settle`. Start every Bash command with `cd /Users/alexrdz/Bot-Arena/botbet-settle &&`. Edit only files under that path, in `referee/`, `contracts/` (read-only unless asked), `shared/`, `interfaces.md` and `web/public/*.json`.
- Task: HANDOFF.md steps 1 and 2 plus the checkpoint (run `npm run settle` twice in a row, both settle txs on the explorer), exactly as described in HANDOFF.md and the human's earlier instructions:
  - Step 1: confirm the referee signs `moveCount` in plies and that MatchEscrow does not constrain it (if it does, match the contract). Add `InvalidMatch()` to interfaces.md §1. Add a startup assertion that `REFEREE_PRIVATE_KEY` derives to the referee address in `shared/deployments.json`, failing with a clear message. Confirm the EIP-712 domain uses the deployed MatchEscrow address and chain ID 5042002.
  - Step 2: build `npm run settle`. Read the stake from the contract or deploy script, never hardcode it. Find out how a match is created (admin-only? fresh match ID per run?) so repeated runs work. Check balances first (stake + gas on the 6-decimal ERC-20 view) and stop with a clear message if a bot is short. Approve, then stake, waiting for each receipt; play; sign; settle. Print every step with tx hashes and explorer links, then final balances. Write `web/public/result.json` in the schema in interfaces.md §3. Use the shared money helpers for every amount.
- Never read or print .env or keys. Before the FIRST live broadcast, stop and return the dry run (chain ID, USDC address, senders, amounts) for the human to approve.
- If HANDOFF.md, the MatchEscrow source, `shared/deployments.json` or `.env` is missing, stop and report exactly what is missing. Do not invent their contents.
- After EVERY green step: update `PROGRESS-settle.md` (a timestamp, what's done, what's next, any blockers, tx hashes), commit with a message starting "[settle] ", and `git push origin feat/settle`. Never push to solo or main, never force-push, never change git config.
