# BotBet

**Two AI chess agents stake USDC on Arc, play their own game, and pay the winner through a referee-attested result.**

![The BotBet result page: board replay, pot, payouts and the referee-attested badge](docs/screenshots/main.png)

BotBet makes an agent-to-agent deal visible from stake to payout. Deep Thought (Stockfish depth 12) plays White against Hasty Hal (depth 4). Each bot stakes 2 USDC in MatchEscrow. After a decisive game, the referee signs the result with EIP-712 and the escrow pays the 4 USDC pot to the winner. The web page replays the game, links to the Arc transaction, and includes presentation and voice-commentary features.

![Winner banner: Deep Thought wins and the 4 USDC pot is paid on Arc](docs/screenshots/winner.png)

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
- Demo-length run from a king-and-queen endgame, the game shown on the page: 17 plies, Deep Thought wins, [settle transaction](https://explorer.testnet.arc.io/tx/0x4f49823d648fc2512bd96c79622c17d04f4ce77d577ad87c6dd2f35c4d8755f3).
- AgentWallet allowed 0.02 USDC payment: [transaction](https://explorer.testnet.arc.io/tx/0xfa0a3a6faefa6c3fdd00a32620f089edb04b84432429428ba99fd3a3a468239a). The 0.10 USDC over-cap payment was refused by the contract in simulation (`CapExceeded(100000, 50000)`), so it was never broadcast.

Arc uses USDC as its native gas asset. BotBet uses the 6-decimal ERC-20 interface at `0x3600000000000000000000000000000000000000` for stake and payout amounts.

## Security model and limits

- The EIP-712 domain binds the signature to MatchEscrow's address and Arc testnet chain ID `5042002`.
- A match ID can settle only once, preventing a signed result from replaying against an already-settled match.
- `MAX_STAKE` limits an individual match stake to 1,000,000 USDC (6-decimal base units).
- AgentWallet enforces its 0.05 USDC per-payment limit in the contract. The over-cap demo request returns `CapExceeded` in simulation and is not broadcast.
- **Trust limitation:** MatchEscrow verifies the referee's attestation; it does not independently verify the chess moves or PGN. The referee could attest to an incorrect result. On-chain move verification is on the roadmap.

## ElevenLabs voice commentary

The page's **Hear the result** button narrates the outcome with the **ElevenLabs Text to Speech API**. It builds one announcer line from `result.json` (for example "Checkmate in 28 moves! Deep Thought takes the 4 USDC pot, settled on Arc.") and sends it to a server-side `/api/tts` route in `web/vite.config.ts`, which calls ElevenLabs and returns the MP3. The API key stays on the server and never reaches the browser. Set `ELEVENLABS_API_KEY` and `ELEVENLABS_VOICE_ID` in `.env` and run the page with `npm run dev` or `npm run preview`. Without them, the button hides itself.

## Run it yourself

**Judges (no keys, nothing sent on-chain).** Node.js 20.12+ and npm. Foundry is *not* needed.

```bash
git clone https://github.com/MarBacc/BotBet.git && cd BotBet
cd shared && npm install && npm run build
cd ../referee && npm install
npm run play-game      # plays a full Stockfish game offline and signs the result
npm run check-setup    # shows what a live run would need
npm run replay-last    # replays the recorded live Arc run, with explorer links
cd ../web && npm install && npm run build && npm run preview   # open the printed URL
```

**Live settle on Arc testnet (needs funded burner keys).** `cp .env.example .env`, add four testnet keys,
then in `referee/` run `npm run settle -- --dry-run` and, after checking it, `npm run settle`.
Foundry (`forge`) is only needed to rebuild or redeploy `contracts/`.

## Roadmap

Next steps from [`docs/roadmap.md`](docs/roadmap.md): spectator betting pools, paid bot intel, per-match agent budgets, and on-chain move verification. The longer plan also includes bot APIs, match feeds, and a leaderboard.

## Team and credits

- Team and roles: listed on the Devpost submission.
- Built with Arc testnet, Circle USDC, Stockfish, chess.js, viem, Foundry, React + Vite and ElevenLabs.
