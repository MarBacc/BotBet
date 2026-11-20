# BotBet

Two AI agents stake USDC on Arc testnet, play a chess game, and the winner is paid automatically by
a smart contract against a **referee-attested** result. A spending-capped AgentWallet shows agents
can hold stablecoins without being able to overspend.

**The loop:** two bots stake → the game is played → the referee signs the result (EIP-712) →
`MatchEscrow.settle()` pays the winner → one page replays the game, narrated with ElevenLabs, with
links to every transaction.

## Live on Arc testnet (chain 5042002)

| What | Address / tx |
|---|---|
| MatchEscrow | [`0x9d4EEE03C431c524822c6A1486bE6142d2a4916c`](https://explorer.testnet.arc.io/address/0x9d4EEE03C431c524822c6A1486bE6142d2a4916c) |
| Referee (signer) | `0xE632a919CEE69FC9482a6A719D47878EEDA28345` |
| AgentWallet | [`0xaEb54edFe9F702B926DF7eaEB0e3Ebfa6C005262`](https://explorer.testnet.arc.io/address/0xaEb54edFe9F702B926DF7eaEB0e3Ebfa6C005262) (cap 0.05 USDC per payment) |
| Settle, live run 1 | [`0x41ba…02b4`](https://explorer.testnet.arc.io/tx/0x41babdf1789a50d180d1e1c4b761de510f329cfbd0b2f1691b0bebb0af6c02b4) |
| Settle, live run 2 | [`0xf177…f6f4`](https://explorer.testnet.arc.io/tx/0xf17764910dcf04c29830834d57d38c8ca8101c16036d694876faf4626f4af6f4) |
| AgentWallet allowed payment (0.02 USDC) | [`0xfa0a…239a`](https://explorer.testnet.arc.io/tx/0xfa0a3a6faefa6c3fdd00a32620f089edb04b84432429428ba99fd3a3a468239a) |
| AgentWallet refused payment (0.10 USDC) | reverted `CapExceeded(100000, 50000)`, so no money moved |

USDC is the 6-decimal ERC-20 at `0x3600000000000000000000000000000000000000`.

## Architecture

```
 Deep Thought (Stockfish d12) ─┐                         ┌─> web/public/result.json ─> page (replay,
 Hasty Hal    (Stockfish d4)  ─┼─ approve + stake 2 USDC │                              payouts, voice)
                               v                          │
                       MatchEscrow (Arc) <── settle(result, sig) ── referee (Node)
                               │                               plays the game, signs EIP-712
                               └─ pays 4 USDC pot to the winner
 AgentWallet (Arc): owner-only pay(); any payment above maxPerTx reverts CapExceeded
```

| Folder | Stack | What |
|---|---|---|
| `contracts/` | Foundry, Solidity 0.8.24 | `MatchEscrow` (stakes, EIP-712 settle, single settlement) and `AgentWallet` (per-payment cap) |
| `referee/` | Node 24 + TypeScript, viem, chess.js, Stockfish | plays, signs, settles, writes `result.json`; cap demo |
| `web/` | Vite + React + TypeScript | one page: board replay, pot, balances, attestation, AgentWallet card, ElevenLabs narration |
| `shared/` | `botbet-shared` | the only USDC conversion helpers (6 decimals, never `1e18`) |

## How this uses Arc

- Both contracts are deployed on Arc testnet (addresses above), built and tested with Foundry.
- USDC is Arc's gas token, so the agents pay their own fees in the same asset they stake.
- All amounts go through the 6-decimal ERC-20 interface at `0x3600…0000`, never the 18-decimal native view.
- Every step is a real Arc transaction with an explorer link: createMatch, approve and stake ×2, settle, and the AgentWallet payment.

## The agents' decision loop and safety limits

- **Decisions:** each bot is Stockfish at a fixed depth (12 vs 4) choosing its own moves. No human approves a move or a payment.
- **Funds move only on a referee-signed result.** `settle()` verifies an EIP-712 `MatchResult` (matchId, winner, moveCount, pgnHash, finishedAt) signed by the immutable referee key, bound to this contract and chain.
- **Bounded exposure:** a bot can lose at most its stake; a match settles exactly once; stakes above 1,000,000 USDC are refused at createMatch.
- **AgentWallet spending cap:** an owner-only wallet whose `pay()` reverts `CapExceeded` above `maxPerTx`. Shown live: 0.02 paid, 0.10 refused.
- **Trust model:** results are referee-attested. The contract pays whatever the referee signs; on-chain move verification is the next step (see `docs/roadmap.md`).

## ElevenLabs

The page's "Hear the result" button sends one announcer line built from `result.json` (e.g.
"Checkmate in 28 moves! Deep Thought takes the 4 USDC pot, settled on Arc.") to the **ElevenLabs
Text to Speech API** through a server-side `/api/tts` route. The key never reaches the browser.
Set `ELEVENLABS_API_KEY` and `ELEVENLABS_VOICE_ID` in `.env`.

## Run it

```bash
export PATH="$HOME/.foundry/bin:$PATH"
cp .env.example .env                                     # testnet burner keys only; never commit .env
cd shared && npm install && npm run build && cd ..       # shared/dist is gitignored; build it first
cd contracts && forge build && forge test && cd ..        # 14 tests
cd referee && npm install
npm test                                                 # 17 unit tests
npm run play-game                                        # one offline game, signed (no keys needed)
npm run rehearse:local                                   # the full settle loop on local anvil, no real money
npm run check-setup                                      # READY / REPLAY ONLY / NOT READY
npm run demo -- --dry-run                                # every live check, nothing sent
npm run demo                                             # live: settle from a mid-game position + cap demo
cd ../web && npm install && npm run dev                  # the page at http://localhost:5173 (P = present mode)
```

Full presenter steps and fallbacks: [docs/demo-runbook.md](docs/demo-runbook.md).

## More

- [interfaces.md](interfaces.md): the spec (contract, signed result, result.json schema)
- [docs/arc.md](docs/arc.md): Arc testnet RPC, chain ID, USDC, faucet
- [docs/roadmap.md](docs/roadmap.md): what's next (betting pool, paid intel, on-chain move verification)
- [docs/submission.md](docs/submission.md): the Devpost checklist
