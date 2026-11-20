# BotBet

Bot-vs-bot chess with on-chain stakes, spectator betting and paid intel, on Arc testnet.
Hackathon: 3 people, 2 days. Scope and schedule in @docs/plan.md.

## The one loop

**bots stake → match runs live → spectators bet → a bot buys intel → match ends → automatic payout → leaderboard updates.**

That loop is the product. Work that doesn't serve it waits until the loop runs end to end.

## Lanes — one folder per person

| Folder | Stack | Owner |
|---|---|---|
| `contracts/` | Foundry / Solidity 0.8.24 — AgentWallet, MatchEscrow, BetPool | A |
| `referee/` | Node 24 + TypeScript (ESM) — match runner, bot API, /intel, WS feed | B |
| `bots/` | TypeScript — 4 Stockfish bots with personalities | B |
| `web/` | Vite + React + TypeScript — board, betting, ledger, leaderboard | C |
| `shared/` | `deployments.json` (addresses + ABIs), committed | everyone |

Nobody edits another lane's folder. If you find a bug outside your lane, say which lane it
belongs to and leave it alone.

## interfaces.md comes first

`interfaces.md` is the contract between lanes: Solidity signatures, events and custom errors;
the bot move API; the referee HTTP + WebSocket API; the signed match-result format; the
intel-purchase flow. Change `interfaces.md` first, tell the others, then write code.
If something in it is unworkable, stop and say so — do not quietly diverge.

**Money:** the 6-decimal ERC-20 USDC interface everywhere, never native 18-decimal amounts.
Every conversion goes through `botbet-shared` (`shared/src/money.ts`) — never convert by hand,
never `parseEther`.

## Commands

`forge` on this machine resolves to Laravel Herd's Forge CLI, not Foundry. Fix your shell first:
```bash
export PATH="$HOME/.foundry/bin:$PATH"
```

```bash
# shared/ — build FIRST. dist/ is gitignored and all three TS lanes import it.
cd shared && npm install && npm run build

# contracts/
forge build
forge test                    # add --match-test <name> -vvv for one test
forge script script/Deploy.s.sol --rpc-url "$ARC_RPC_URL"   # TODO: dry run before --broadcast

# referee/ and bots/ — npm install once in each, then:
npm run build                 # tsc -> dist/
npm run dev                   # tsx watch (referee)
npm run play-game             # TODO (referee): one game, prints PGN + signed result
npm test                      # TODO (bots): every bot returns a legal move in time

# web/
npm install && npm run dev
npm run build                 # tsc -b && vite build

# repo root
npx tsx scripts/e2e.ts        # TODO: the full loop once, printing every tx hash
```

End every task with the command that proves it works, and show its output. Commit each green step.

## Security

- **Never read, print, cat or echo `.env` or any `.env.*` file.** Read `.env.example` for the
  list of variable names.
- **Testnet burner wallets only.** Never a key that has held real funds.
- Never commit secrets. `.env` is gitignored — never `git add -f` it, and never paste a private
  key into a prompt, a log, a commit message or frontend code.
- Only `VITE_`-prefixed variables reach the browser. Never give a secret that prefix.
- `shared/deployments.json` is public data (addresses and ABIs) and is committed on purpose.
