# Hackathon Plan and Claude Code Prompts

Team of 3, using Claude Code. Start every session in plan mode (Shift+Tab). Save the plan section below as `docs/plan.md` so any session can reference it with `@docs/plan.md`.

---

# Part 1: The Plan

Two days really means about 30 to 36 working hours once you count sleep and the pitch. That's enough for a polished core plus two or three bounty integrations, but not everything. This plan assumes 3 to 4 people, with at least one comfortable writing Solidity.

## The rule: one loop, working end to end, by Thursday night

The loop is: **bots stake → match runs live → spectators bet → a bot buys intel → match ends → automatic payout → leaderboard updates.**

If that works by the end of Thursday, Friday goes to voice, integrations and polish. If it doesn't, drop the bounties and finish the loop. A clean core demo beats a half-working everything.

## What to build, in priority order

**Must have (no demo without these)**
- **Three contracts on Arc testnet:** `AgentWallet` (spending caps), `MatchEscrow`, and `BetPool` (the shared betting pool). Keep each under about 150 lines and test only the happy path and the cap refusal.
- **A referee server** that runs bot-vs-bot games of one game only. Use chess with a move cap of about 3 seconds per move and 80 moves max. Its result is signed by the referee's key.
- **3 or 4 built-in bots** with different personalities: a cheap one that never buys intel, a balanced one, and a big spender. Use Stockfish at different depths so moves are fast and believable.
- **Paid intel, done the simple way.** Skip x402 for now. The bot calls `wallet.pay(referee, amount)`, the referee checks the transaction receipt, then returns the evaluation. Call it "x402-style" in the pitch and list full x402 as next steps.
- **One page with the live board, betting panel, bot wallet ledger and leaderboard.**

**Should have (this is where you win)**
- **ElevenLabs commentator, text-to-speech only.** An LLM writes a one-line comment on big swings in the engine's evaluation, on intel purchases and on large bets, and ElevenLabs voices it. About 4 hours of work and the biggest wow factor.
- **QuickNode Stream → webhook → live odds and leaderboard.** About 3 to 4 hours, and it also makes the backend simpler.
- **The spending-cap refusal moment** in the demo. Almost free once the wallet contract exists.

**Only if time allows**
- **Grok Bot MCP server.** Only if the organizers give you access, with one person on a 4-hour timebox. If access isn't confirmed by Thursday noon, drop it.
- Checking Connect Four moves on-chain, so results need no trust at all.
- A voice agent spectators can ask questions.
- Bot registration for outside builders.

**Cut entirely:** poker, humans playing, multiple games, accounts and logins (use a demo wallet or wallet connect), and real weekly-ranking history (seed it with fake past data).

## Schedule

| When | Goal |
|---|---|
| **Wednesday night (1 to 2 hrs)** | Agree on the bot move API and contract function signatures in writing. Deploy stub contracts. Get testnet USDC from the faucet. Ask the organizers about Grok Bot access. Then sleep. |
| **Thursday morning** | Contracts finished and deployed. Referee runs a full game locally. Frontend shows a live board from mock data. |
| **Thursday afternoon** | Connect it all: escrow → game → payout on testnet. Betting works. |
| **Thursday evening** | Intel purchases plus the wallet ledger. **Checkpoint: the full loop works.** |
| **Friday morning** | Commentator, QuickNode Stream, cap-refusal demo. Grok Bot only if access came through. |
| **Friday afternoon** | **Feature freeze 6 hours before the deadline.** Seed the leaderboard, fix bugs, record a backup demo video. |
| **Final 2 to 3 hrs** | Write slides, rehearse the 3-minute demo at least twice, submit early. |

## Biggest risks and fallbacks

- **The contracts and the referee don't connect.** The most common failure. Lock the interfaces on Wednesday night so nobody waits on anyone.
- **The live demo breaks on stage.** Have a recorded backup video and pre-funded wallets. Make the demo match short (10 to 15 moves) or start it from a mid-game position.
- **USDC decimals.** Arc's native USDC uses 18 decimals, but its ERC-20 interface uses 6. Pick one in the contracts and the frontend on Wednesday night, or you'll lose hours to amounts that are off by a factor of 10^12.
- **LLM latency in the commentary.** Generate lines in parallel with play and drop any that arrive late. Never let the game wait on the voice.
- **A sudden urge to add features.** Anything not in the "must" list waits until the Thursday checkpoint passes.

---

# Part 2: Lanes

| Person | Lane | Owns |
|---|---|---|
| **A** | Contracts | `contracts/`, deploys, USDC decimals decision |
| **B** | Referee and bots | `referee/`, `bots/`, intel payment check |
| **C** | Frontend and extras | `web/`, commentator, QuickNode webhook |

Rules:
- One folder per person. Nobody's agent edits another lane's folder.
- Interface changes go in `interfaces.md` first, then everyone is told, then code changes.
- Each person has their own `.env` and a testnet-only burner wallet. Never commit secrets.
- Commit after each green step. Merge small and often, and pull before starting each task.

---

# Part 3: Prompts

Replace anything in `[brackets]`.

## Wednesday night (everyone, one person drives)

### 1. Scaffold
```
Read @docs/plan.md. Create a monorepo with folders contracts/ (Foundry), referee/ (Node + TypeScript), bots/ (TypeScript), web/ (Vite + React + TypeScript). Add a root .gitignore that excludes .env, node_modules, out/ and cache/. Add a .env.example listing every variable we'll need (RPC URL, deployer key, referee key, ElevenLabs key, QuickNode key) with no real values. Don't write any feature code yet.
```

### 2. CLAUDE.md
```
Write CLAUDE.md for this repo. Include: the one-loop goal (bots stake, match runs live, spectators bet, a bot buys intel, match ends, automatic payout, leaderboard updates); the stack per folder; the rule that each person owns one folder and nobody edits another lane's folder; the rule that interface changes go in interfaces.md first; the exact commands to test and run each part (leave placeholders we'll fill in); and security rules: never read or print .env, testnet burner keys only, never commit secrets. Keep it under 80 lines.
```

### 3. interfaces.md (review this one carefully)
```
Read @docs/plan.md and draft interfaces.md. Define: (a) Solidity function signatures, events and custom errors for AgentWallet, MatchEscrow and BetPool, (b) the bot move API between referee and bots (request and response JSON, timeouts), (c) the referee HTTP and websocket API the frontend uses, (d) the signed match-result format and how MatchEscrow verifies it, (e) the intel-purchase flow: bot calls wallet.pay(referee, amount), referee verifies the receipt, returns the evaluation. Money decision: use the ERC-20 USDC interface with 6 decimals everywhere, never native 18-decimal amounts, and put helper functions for conversion in one shared place. List open questions at the end instead of guessing.
```

### 4. Settings and reviewer agent
```
Create .claude/settings.json that allows forge, npm, npx, node and git commands, and denies reading .env files. Then create a subagent at .claude/agents/solidity-reviewer.md: read-only, reviews a Solidity file for reentrancy, access control, unchecked token transfers, decimals mistakes and spending-cap bypasses, and reports findings ordered by severity with line numbers. It must not edit files.
```

### 5. Docs
```
Fetch the current official docs for Arc testnet (RPC, chain ID, USDC address, faucet), QuickNode Streams webhooks, and the ElevenLabs text-to-speech API. Save a concise summary of each in docs/arc.md, docs/quicknode.md and docs/elevenlabs.md with the exact endpoints and code samples. Note anything you could not verify.
```

## Person A: contracts

### Thursday morning
```
Read CLAUDE.md and interfaces.md. In contracts/, implement AgentWallet (owner, per-bot spending cap, pay() that reverts with a custom error over the cap), MatchEscrow (stake, settle with a referee-signed result, payout) and BetPool (place bet, close, claim). Use OpenZeppelin. Each contract under about 150 lines. Write Foundry tests for the happy path and the spending-cap refusal only. Work until forge test passes, then show me the summary. Do not change interfaces.md; if something is unworkable, stop and tell me.
```
```
Use the solidity-reviewer subagent on all three contracts. Fix every high and medium finding, keeping tests green.
```
```
Write a Foundry deploy script for Arc testnet that reads keys from env, deploys all three contracts, and writes the addresses and ABIs to shared/deployments.json. Dry run it first and show me the output before broadcasting.
```

## Person B: referee and bots

### Thursday morning
```
Read CLAUDE.md and interfaces.md. In referee/, build a chess game runner using chess.js for rules, with a 3 second move limit and an 80 move cap. It calls bots through the bot move API, uses Stockfish for evaluation, and produces a result signed with the referee key in the format from interfaces.md. Add a script npm run play-game that plays one full game between two bots locally and prints the PGN and the signed result. Work until it runs end to end.
```
```
In bots/, create 4 bots using Stockfish at different depths: a cheap one that never buys intel, a balanced one, a big spender, and one random-ish. Each has a name, personality and intel-buying rule in one config file. Add a test that every bot returns a legal move within the time limit.
```

### Thursday evening
```
Add paid intel. A bot calls wallet.pay(referee, amount) on Arc testnet, sends the tx hash to the referee's /intel endpoint, and the referee verifies the receipt (right recipient, amount, not reused) before returning the engine evaluation. Write a test for a reused hash and an underpaid receipt, both rejected. Use addresses from shared/deployments.json.
```

## Person C: frontend

### Thursday morning
```
Read CLAUDE.md and interfaces.md. In web/, build a single page with four panels: live chessboard, betting panel, bot wallet ledger, leaderboard. Drive everything from a mock data provider that emits the same events the real referee websocket will, so swapping to the real one later is one config change. Use a clean dark theme. Run it and check the page renders with no console errors.
```

### Thursday afternoon
```
Connect the betting panel to BetPool using wallet connect, with a demo wallet fallback. Read ABIs and addresses from shared/deployments.json. Show a clear pending, success and error state for every transaction.
```

## Integration (Thursday afternoon and evening, one driver)

```
Read CLAUDE.md and interfaces.md. Wire the full loop on Arc testnet: bots stake into MatchEscrow, referee runs the match, spectators bet through BetPool, a bot buys intel mid-match, the referee settles with its signature, payouts happen, and the leaderboard updates. Write scripts/e2e.ts that runs the whole loop once and prints each step with tx hashes. Run it, and when it fails, diagnose from the logs and fix the smallest thing. Report which lane the bug belongs to instead of editing another lane's folder.
```

**Thursday evening checkpoint:** all three run the full loop together. Don't start Friday's extras until it works.

## Friday morning (extras)

### Commentator
```
Add a commentator service. Subscribe to the referee websocket and trigger a line on big engine-evaluation swings, intel purchases, and large bets. Generate a one-sentence comment with the Claude API, voice it with ElevenLabs text-to-speech per @docs/elevenlabs.md, and play it in the web page. Generate in parallel with play and drop any line that arrives more than 3 seconds late. The game must never wait on the voice.
```

### QuickNode
```
Following @docs/quicknode.md, add a QuickNode Stream that sends BetPool and MatchEscrow events to a webhook in referee/. Use it to update live odds and the leaderboard. Add a replay script that sends sample events so we can test without chain activity.
```

### Cap-refusal moment
```
Add a "Try overspend" button on the wallet ledger panel that makes the big-spender bot attempt a payment over its cap, then shows the revert reason and a red refusal banner. Reuse the existing cap test's logic.
```

## Friday afternoon (freeze and polish)

```
Feature freeze. Seed the leaderboard with 10 fake past matches in a clearly separated seed file. Add a demo mode with a short 12 move match from a mid-game position. Then run the full loop five times and list every failure with its cause, without fixing anything yet.
```

---

# Habits for every session

- Start with: "Read CLAUDE.md and interfaces.md first."
- End with a command that proves it works, and ask for the output.
- If a session loops for 20 minutes, `/clear` and restate the smaller task.
- Commit after each green step.
- Paste real logs and tx hashes into the session when debugging.
