# BotBet live demo runbook (3 minutes)

## Ten minutes before

- Have the settle operator confirm the deployer, referee, and bot wallets have enough USDC for the planned run using their balance check/dry run. Do not display keys or terminal environment variables.
- Confirm the operator's private `.env` is present in the repository root. Never open it on the projector.
- Start `npm run dev` in `web/`; open the page and confirm the current result and AgentWallet cap card load. Use only the integrated web build that includes Present mode and the cap card.
- Open the Arc testnet explorer and the recorded backup video in separate tabs. Put the successful settle transaction page in a ready tab.
- Enlarge the terminal font, turn on Do Not Disturb, and close unrelated windows.
- Check that the short FEN run has been rehearsed on the demo laptop. Its proposed FEN is `7k/8/5KQ1/8/8/8/8/8 w - - 0 1` (queen mate on g7). The local checker has not yet been run in this environment; if it is still unverified, use the recorded successful run and call it the recorded run.

## 0:00–0:20 — The problem

**Say:** “AI agents are starting to hold and move money. When two agents make a deal, who enforces the outcome? BotBet gives them a simple wager: two chess agents stake USDC, play for themselves, and a referee-attested result triggers the payout.”

## 0:20–0:40 — The flow

Show the page's **Stake → Play → Referee signs → Contract pays** strip.

**Say:** “That is the whole loop. The agents fund the match, Stockfish plays the game, the referee signs the result, and MatchEscrow pays the winner. The page lets everyone inspect the replay and the transaction.”

## 0:40–1:40 — Run or show the recorded game

From `referee/`, run on the laptop with the required keys, or play the recording:

```bash
npm run settle -- --fen "7k/8/5KQ1/8/8/8/8/8 w - - 0 1"
```

Point to each step in order: **createMatch** creates a fresh escrow match; each **approve + stake** pair authorizes and locks a bot's 2 USDC; **the game** runs from the selected FEN; **the EIP-712 signature** binds the winner, ply count, PGN hash, match ID, chain and escrow; **settle()** verifies that referee-attested result and pays the 4 USDC pot. The two recorded standard-game settles are linked in the README. If showing one of those recordings, say it used the normal starting position, not this short FEN.

**Say:** “Watch the contract events as the match is funded. The move loop is local; once the game ends, the referee signs a compact result and the escrow checks that signature before paying.”

## 1:40–2:10 — Verify the payout

Open the settle transaction in the Arc explorer and point to `Settled` and the 4 USDC payout. Return to the page, refresh, and press **P** (or click **Present**) for the fullscreen replay/result.

**Say:** “Here is the on-chain `Settled` event and the winner's payout. Now the page replays the moves and shows the 4 USDC pot with its referee-attested badge.”

## 2:10–2:30 — AgentWallet safety

Show the cap card: the deployed AgentWallet has a 0.05 USDC per-payment cap. Its allowed 0.02 USDC payment is the mined transaction; the 0.10 USDC attempt is simulated against the contract and returns `CapExceeded`. The refused request is not broadcast, so it spends no gas and moves no funds. If no current cap-demo record is loaded, show the recorded card or skip this segment; do not imply a live wallet payment just happened.

**Say:** “A small payment fits under the wallet's cap. A larger one hits the contract's `CapExceeded` check. We simulate the refusal so we can show the real contract error without sending a reverting transaction.”

## 2:30–3:00 — Why Arc, roadmap, close

**Say:** “Arc uses USDC for gas, so the fee and the stake are in the same asset, with fast finality. Next we want spectator betting pools, paid bot intel, agent spending limits, voice commentary, and on-chain move verification. Today the payout is referee-attested; verifying every move on-chain is a clear next step. BotBet makes the agents' deal visible, testable, and payable. Thanks.”

## Fallbacks

- **Arc RPC is slow or a transaction is stuck:** switch to the backup video at the same timestamp. Do not retry the same match; a fresh run needs a fresh match ID.
- **The settle run fails:** show the last successful recorded settle: [run 1 settle](https://explorer.testnet.arc.io/tx/0x41babdf1789a50d180d1e1c4b761de510f329cfbd0b2f1691b0bebb0af6c02b4) or [run 2 settle](https://explorer.testnet.arc.io/tx/0xf17764910dcf04c29830834d57d38c8ca8101c16036d694876faf4626f4af6f4), then show the page replay.
- **The page is broken:** open `web/public/result.json` in the repo or use the recording and explorer transaction.
- **Present mode does not start:** use the page's Present button; press `P` or `Esc` to exit, `Space` to skip to the result, and `R` to replay.
- **AgentWallet card is missing:** skip it and state that the deployed wallet's 0.05 USDC cap is on-chain; do not substitute sample data as live evidence.
