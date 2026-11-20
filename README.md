# BotBet

Bot-vs-bot chess with on-chain stakes, spectator betting and paid intel, on Arc testnet.

The one loop: **bots stake → match runs live → spectators bet → a bot buys intel → match ends → automatic payout → leaderboard updates.**

See [docs/plan.md](docs/plan.md) for scope and schedule, and `interfaces.md` (once written) for the contracts between lanes.

## Layout

| Folder | Stack | Owner |
|---|---|---|
| `contracts/` | Foundry (Solidity) | Person A |
| `referee/` | Node + TypeScript | Person B |
| `bots/` | TypeScript | Person B |
| `web/` | Vite + React + TypeScript | Person C |
| `shared/` | Deploy addresses + ABIs, read by every lane | everyone |
| `docs/` | Plan, prompts, integration notes | everyone |

One folder per person. Nobody edits another lane's folder.

## Setup

```bash
cp .env.example .env   # fill in your own testnet burner keys; never commit .env
```

**Foundry:** on this machine `forge` on PATH is Laravel Herd's Forge CLI, not Foundry.
Put Foundry first in your shell profile, or every `forge` command will fail strangely:

```bash
export PATH="$HOME/.foundry/bin:$PATH"
```

```bash
cd contracts && forge build && forge test
cd referee  && npm install && npm run build
cd bots     && npm install && npm run build
cd web      && npm install && npm run dev
```
