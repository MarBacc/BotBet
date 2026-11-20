# BotBet live demo runbook (3 minutes)

## Ten minutes before

- Have the settle operator confirm the deployer, referee, and bot wallets have enough USDC for the planned run using the keyless setup check or the operator's balance check. Do not display keys or terminal environment variables.
- Confirm the operator's private `.env` is present in the repository root. Never open it on the projector.
- Start `npm run dev` in `web/`; open the page and confirm the live result and AgentWallet cap card load.
- Open the Arc testnet explorer and the backup video (`docs/screenshots/demo.webm`) in separate tabs. Pre-open the latest settle and allowed-payment transactions linked below.
- Enlarge the terminal font, turn on Do Not Disturb, and close unrelated windows.
- The live FEN is `8/8/8/4k3/8/8/8/3QK3 w - - 0 1`. The recorded Arc run ended by checkmate in 17 plies in 21.8 seconds.

## 0:00–0:20 — The problem

**Say:** “AI agents are starting to hold and move money. When two agents make a deal, who enforces the outcome? BotBet gives them a simple wager: two chess agents stake USDC, play for themselves, and a referee-attested result triggers the payout.”

## 0:20–0:40 — The flow

Show the page's **Stake → Play → Referee signs → Contract pays** strip.

**Say:** “That is the whole loop. The agents fund the match, Stockfish plays the game, the referee signs the result, and MatchEscrow pays the winner. The page lets everyone inspect the replay and the transaction.”

## 0:40–1:40 — Run or replay the live game

From `referee/`, run on the laptop with the required keys, or show the recorded live run:

```bash
npm run settle -- --fen "8/8/8/4k3/8/8/8/3QK3 w - - 0 1"
```

Point to each step in order: **createMatch** creates a fresh escrow match; each **approve + stake** pair authorizes and locks a bot's 2 USDC; **the game** uses the live FEN and finished in 17 plies (21.8 seconds) in the recorded rehearsal; **the EIP-712 signature** binds the winner, ply count, PGN hash, match ID, chain, and escrow; **settle()** verifies that referee-attested result and pays the 4 USDC pot. The recorded settle transaction is [`0x4f49823d648fc2512bd96c79622c17d04f4ce77d577ad87c6dd2f35c4d8755f3`](https://explorer.testnet.arc.io/tx/0x4f49823d648fc2512bd96c79622c17d04f4ce77d577ad87c6dd2f35c4d8755f3).

**Say:** “This is the exact position we rehearsed on Arc. Deep Thought won in 17 plies, and the whole run reached a verified settlement in 21.8 seconds. Here are the match funding steps, the signed result, and the settle transaction.”

## 1:40–2:10 — Verify the payout

Open the settle transaction in the Arc explorer and point to `Settled` and the 4 USDC payout. Return to the page, refresh, and press **P** (or click **Present**) for the fullscreen replay/result.

**Say:** “Here is the on-chain `Settled` event and the winner's payout. Now the page replays the moves and shows the 4 USDC pot with its referee-attested badge.”

## 2:10–2:30 — AgentWallet safety

Show the deployed AgentWallet [`0xaEb54edFe9F702B926DF7eaEB0e3Ebfa6C005262`](https://explorer.testnet.arc.io/address/0xaeb54edfe9f702b926df7eaeb0e3ebfa6c005262) and its 0.05 USDC per-payment cap. The allowed 0.02 USDC transfer to the referee was mined and verified in [`0xfa0a3a6faefa6c3fdd00a32620f089edb04b84432429428ba99fd3a3a468239a`](https://explorer.testnet.arc.io/tx/0xfa0a3a6faefa6c3fdd00a32620f089edb04b84432429428ba99fd3a3a468239a). The 0.10 USDC attempt was simulated and returned `CapExceeded(100000, 50000)`; it was not broadcast.

**Say:** “The allowed payment is on Arc. The larger request hit the wallet's `CapExceeded` check in simulation, so no reverting transaction was sent and no money moved.”

## 2:30–3:00 — Why Arc, roadmap, close

**Say:** “Arc uses USDC for gas, so the fee and the stake are in the same asset, with fast finality. Next we want spectator betting pools, paid bot intel, agent spending limits, voice commentary, and on-chain move verification. Today the payout is referee-attested; verifying every move on-chain is a clear next step. BotBet makes the agents' deal visible, testable, and payable. Thanks.”

## Fallbacks

- **Arc RPC is slow or a transaction is stuck:** switch to `docs/screenshots/demo.webm` at the same timestamp. Do not retry the same match; a fresh run needs a fresh match ID.
- **The settle run fails:** show the verified 17-ply live settle at [the Arc explorer](https://explorer.testnet.arc.io/tx/0x4f49823d648fc2512bd96c79622c17d04f4ce77d577ad87c6dd2f35c4d8755f3), then show the page replay. The earlier [run 1](https://explorer.testnet.arc.io/tx/0x41babdf1789a50d180d1e1c4b761de510f329cfbd0b2f1691b0bebb0af6c02b4) and [run 2](https://explorer.testnet.arc.io/tx/0xf17764910dcf04c29830834d57d38c8ca8101c16036d694876faf4626f4af6f4) are also verified settles.
- **The page is broken:** open `web/public/result.json` from the live run or use the recording and explorer transaction.
- **Present mode does not start:** click the page's Present button; press `P` or `Esc` to exit, `Space` to skip to the result, and `R` to replay.
- **AgentWallet card is missing:** open `web/public/cap-demo.json` and the allowed-payment transaction link; explain that the over-cap result is a simulation, not a mined refusal transaction.
