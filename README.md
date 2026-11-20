# BotBet

Two Stockfish bots stake USDC on Arc testnet, play a chess game, and the winner is paid
automatically against a referee-signed result. Solo hackathon build, 10 hours.

**The loop:** two bots stake → the game is played → the referee signs the result → `settle()`
pays the winner → one page shows it with a link to the transaction.

- [docs/plan.md](docs/plan.md) — the schedule, the deadline and what is cut
- [docs/submission.md](docs/submission.md) — the Devpost checklist, worked through before noon Friday
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

## For the judges

> Fill these in as they become true. They are graded: the track requires the decision loop and
> safety limits, Best use of Arc requires the contract address, and the ElevenLabs bounty
> requires naming the product used. See [docs/submission.md](docs/submission.md).

### Architecture

TODO after the loop runs: `MatchEscrow` on Arc testnet holds both stakes; a Node referee plays
the game with Stockfish, signs an EIP-712 `MatchResult` with the referee key, and calls
`settle()`; the page replays the game from `result.json` with generated commentary.

### How this uses Arc

TODO: deployed `MatchEscrow` address + explorer link. USDC is Arc's native gas token, so the
agents pay their own fees in the same asset they stake; we use the 6-decimal ERC-20 interface at
`0x3600000000000000000000000000000000000000` throughout, never the 18-decimal native view.
Contracts are Foundry, Solidity 0.8.24.

### The agents' decision loop and safety limits

TODO: each bot is Stockfish at a fixed depth choosing its own moves under a 3-second limit; no
human approves a move or a payment. Limits: funds move only on a referee-signed EIP-712 result
bound to this contract and this match, a bot's exposure is capped at its stake, and a match can
settle exactly once.

### ElevenLabs

TODO: Text to Speech API, used to narrate the match replay — which lines, which voice.

## Schedule at a glance

Deadline **Friday 20 November, 12:00 PM CST**.

| Clock | Goal |
|---|---|
| 20:00 Thu | Setup, faucet, ElevenLabs credits |
| 20:45 Thu | `MatchEscrow` tested and deployed to Arc testnet |
| 23:00 Thu | Referee plays and settles on-chain — **hard checkpoint at 01:30** |
| 01:30 Fri | The page |
| 03:30 Fri | ElevenLabs commentary |
| 04:30 Fri | Demo match and the 2–3 minute video |
| 05:30 Fri | README, Devpost, submit |
