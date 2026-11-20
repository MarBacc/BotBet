# BotBet

**Two AI chess agents stake USDC on Arc, play their own game, and pay the winner through a referee-attested result.**

Demo video: [video link]

BotBet makes an agent-to-agent deal visible from stake to payout. Deep Thought (Stockfish depth 12) plays White against Hasty Hal (depth 4). Each bot stakes 2 USDC in MatchEscrow. After a decisive game, the referee signs the result with EIP-712 and the escrow pays the 4 USDC pot to the winner. The web page replays the game, links to the Arc transaction, and includes presentation and voice-commentary features.

## How it works

1. **Stake:** the admin creates a fresh match; each bot approves and stakes 2 USDC.
2. **Play:** the referee runs the Stockfish engines against a chess.js board and records the legal moves.
3. **Sign:** the referee signs the match ID, winner, ply count, PGN hash, and finish time using EIP-712.
4. **Settle:** MatchEscrow checks the signature and match state, then transfers the 4 USDC pot to the winner.
5. **Review:** the web app loads the result, replays the moves, and links to the settle transaction.

```mermaid
sequenceDiagram
    participant Bot1 as Bot 1 (Deep Thought)
    participant Bot2 as Bot 2 (Hasty Hal)
    participant Admin
    participant MatchEscrow
    participant Referee
    Admin->>MatchEscrow: createMatch(matchId, bots, stake)
    Bot1->>MatchEscrow: approve 2 USDC; stake(matchId)
    Bot2->>MatchEscrow: approve 2 USDC; stake(matchId)
    Referee->>Referee: play Stockfish game and record PGN
    Referee->>Referee: sign EIP-712 match result
    Referee->>MatchEscrow: settle(matchId, result, signature)
    MatchEscrow-->>Bot1: pay winner (or Bot2)
    MatchEscrow-->>Referee: Settled event
```

## Architecture

- `contracts/`: `MatchEscrow` holds stakes, verifies signed results, and pays the winner. `AgentWallet` is a separate agent-payment wallet with an on-chain per-payment cap.
- `referee/`: TypeScript referee, Stockfish WASM engine, chess.js game rules, and viem signing/Arc calls.
- `web/`: React replay page, Present mode (`P`), transaction links, and voice commentary.
- `shared/`: shared 6-decimal USDC conversion helpers used by the referee and web app.

## Deployed on Arc testnet

- Chain ID: `5042002`
- MatchEscrow: [`0x9d4EEE03C431c524822c6A1486bE6142d2a4916c`](https://explorer.testnet.arc.io/address/0x9d4EEE03C431c524822c6A1486bE6142d2a4916c) (address from `shared/deployments.json`)
- AgentWallet: [`0xaEb54edFe9F702B926DF7eaEB0e3Ebfa6C005262`](https://explorer.testnet.arc.io/address/0xaeb54edfe9f702b926df7eaeb0e3ebfa6c005262), deployed with a 0.05 USDC per-payment cap.
- Two recorded successful full-game settles paid 4 USDC to Deep Thought in 55 plies:
  - [Run 1 settle transaction](https://explorer.testnet.arc.io/tx/0x41babdf1789a50d180d1e1c4b761de510f329cfbd0b2f1691b0bebb0af6c02b4)
  - [Run 2 settle transaction](https://explorer.testnet.arc.io/tx/0xf17764910dcf04c29830834d57d38c8ca8101c16036d694876faf4626f4af6f4)
- Demo video: [video link]

Arc uses USDC as its native gas asset. BotBet uses the 6-decimal ERC-20 interface at `0x3600000000000000000000000000000000000000` for stake and payout amounts.

## Security model and limits

- The EIP-712 domain binds the signature to MatchEscrow's address and Arc testnet chain ID `5042002`.
- A match ID can settle only once, preventing a signed result from replaying against an already-settled match.
- `MAX_STAKE` limits an individual match stake to 1,000,000 USDC (6-decimal base units).
- AgentWallet enforces its 0.05 USDC per-payment limit in the contract. The over-cap demo request returns `CapExceeded` in simulation and is not broadcast.
- **Trust limitation:** MatchEscrow verifies the referee's attestation; it does not independently verify the chess moves or PGN. The referee could attest to an incorrect result. On-chain move verification is on the roadmap.

## Run it yourself

Prerequisites: Node.js 20 or newer, npm, and Foundry for contract development. Use testnet burner keys only for a real settle run.

```bash
git clone https://github.com/MarBacc/BotBet.git
cd BotBet
cp .env.example .env   # add the required testnet keys locally; never commit .env
export PATH="$HOME/.foundry/bin:$PATH"

cd shared && npm install && npm run build
cd ../referee && npm install
npm run play-game      # offline/keyless game; sends nothing on-chain
npm run settle         # broadcasts real Arc testnet transactions
npm run settle -- --fen "7k/8/5KQ1/8/8/8/8/8 w - - 0 1"  # verified offline; still sends real testnet transactions

cd ../web && npm install && npm run dev
```

`npm run settle` needs funded deployer, referee, and bot wallets. It creates a fresh match and sends transactions; review its dry-run and wallet configuration before running it. The short FEN is verified for an offline mate in one; its on-chain settlement has not yet been recorded.

## Roadmap

Next steps from [`docs/roadmap.md`](docs/roadmap.md): spectator betting pools, paid bot intel, per-match agent budgets, and on-chain move verification. The longer plan also includes bot APIs, match feeds, and a leaderboard.

## Team and credits

- Team: [team member names]
- Project credits: [credits and roles]
- Demo video: [video link]
