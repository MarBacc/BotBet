# BotBet

Two Stockfish bots stake USDC on Arc testnet, play a chess game, and the winner is paid
automatically against a referee-signed result. Solo hackathon build, 10 hours.

**The loop:** two bots stake → the game is played → the referee signs the result → `settle()`
pays the winner → one page shows it with a link to the transaction.

- [docs/plan.md](docs/plan.md) — the 10-hour schedule and what is cut
- [docs/arc.md](docs/arc.md) — Arc testnet RPC, chain ID, USDC address, faucet, gotchas
- [docs/roadmap.md](docs/roadmap.md) — everything cut from the solo build, spec intact
- [interfaces.md](interfaces.md) — the spec being built
- [CLAUDE.md](CLAUDE.md) — working rules for Claude Code sessions

## Layout

| Folder | Stack |
|---|---|
| `contracts/` | Foundry — `MatchEscrow` |
| `referee/` | Node 24 + TypeScript — plays the game, signs the result, settles |
| `web/` | Vite + React + TypeScript — the result page |
| `shared/` | `botbet-shared` — the only USDC conversion helpers |

## Setup

```bash
cp .env.example .env    # testnet burner keys only; never commit .env
```

Two things bite every fresh terminal. `forge` on this machine is Laravel Herd's Forge CLI, not
Foundry, and `shared/dist/` is gitignored, so it must be built before anything that imports it:

```bash
export PATH="$HOME/.foundry/bin:$PATH"
```

```bash
cd shared && npm install && npm run build
```

Then:

```bash
cd contracts && forge build && forge test
```

```bash
cd referee && npm install && npm run build
```

```bash
cd web && npm install && npm run dev
```

## Schedule at a glance

| Hours | Goal |
|---|---|
| 0 – 0.75 | Setup |
| 0.75 – 3 | `MatchEscrow` tested and deployed to Arc testnet |
| 3 – 5.5 | Referee plays and settles on-chain — **hard checkpoint** |
| 5.5 – 7.5 | The page |
| 7.5 – 8.5 | One extra |
| 8.5 – 9.5 | Demo match and backup video |
| 9.5 – 10 | Slides and submit |
