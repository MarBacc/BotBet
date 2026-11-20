# BotBet

Two Stockfish bots stake USDC on Arc testnet, play a game, and the winner is paid automatically
against a referee-signed result. Solo build, 10 hours. Schedule: @docs/plan.md.

## Before anything else, in every new terminal

```bash
export PATH="$HOME/.foundry/bin:$PATH"      # else `forge` is Laravel Herd's Forge CLI
cd shared && npm install && npm run build   # shared/dist is gitignored; referee and web import it
```

## The scope test

**Stake, play, settle, payout from a script, then one page showing it.**

A change that does not serve that sentence does not get built today, with one addition: once the
loop works, the page gets **ElevenLabs voice commentary** — that is the bounty we are entering
(`interfaces.md` §5). Everything else cut — `BetPool`, `AgentWallet`, paid intel, the bot and
referee HTTP/WS APIs, QuickNode — is parked in @docs/roadmap.md. `interfaces.md` is the spec:
change it before the code. **Deadline: Friday 20 November, 12:00 PM CST** (@docs/submission.md).

## Layout

`contracts/` Foundry, `MatchEscrow` only · `referee/` Node 24 + TS (ESM), plays, signs and
settles, bots in `src/bots.ts` · `web/` Vite + React + TS, one page loading `public/result.json` ·
`shared/` the `botbet-shared` money helpers, built first.

## Money

The 6-decimal ERC-20 USDC interface at `0x3600000000000000000000000000000000000000`, always.
Arc's native view of the *same balance* uses 18 decimals — never touch it. Every conversion goes
through `botbet-shared` (`shared/src/money.ts`); never `parseEther`, never `1e18`. Gas is paid in
USDC from that same balance, so fund a wallet above its stake. See @docs/arc.md.

## Commands

```bash
# contracts/
forge build && forge test     # add --match-test <name> -vvv for one test
forge script script/Deploy.s.sol --rpc-url "$ARC_RPC_URL"   # dry run before --broadcast

# referee/ (npm install once)
npm run build                 # tsc -> dist/
npm run play-game             # TODO: one game offline, prints PGN + signed result
npm run settle                # TODO: stake, play, sign, settle; writes web/public/result.json

# web/
npm install && npm run dev
npm run build                 # tsc -b && vite build
```

End every task with the command that proves it works, and show its output. Commit each green step.

## Security

- **Never read, print, cat or echo `.env` or any `.env.*` file.** `.env.example` has the names.
- **Testnet burner wallets only.** Never a key that has held real funds.
- Never commit secrets: `.env` is gitignored, never `git add -f` it, never paste a private key
  into a prompt, a log, a commit message or frontend code. Only `VITE_` vars reach the browser.
- `shared/deployments.json` is public data (address and ABI) and is committed on purpose.
