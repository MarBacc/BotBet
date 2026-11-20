# BotBet stage checklist

## 10 minutes before

- Plug in the charger, check Wi-Fi, and enable Do Not Disturb. Set terminal text to 18 pt or larger.
- In the presenter terminal, change into `referee/`. From this laptop’s `codex2nd/BotBet/referee` checkout, run `export BOTBET_ENV_FILE="$PWD/../../../botbet-live/.env"` and `export ARC_RPC_URL=https://rpc.testnet.arc.io`.
- Run `npm run check-setup`. Look for **READY FOR THE LIVE DEMO** and check that `result.json` and `cap-demo.json` passed under **FALLBACK**.
- In a second terminal, start the dev server from `web/` with `npm run dev`. Open [BotBet Arena](http://localhost:5173) and confirm the recorded result and AgentWallet card load.
- Pre-open the [Arc settle transaction](https://explorer.testnet.arc.io/tx/0x44452164759c4ebcf9ff7ada9abd49b373e470b83c749978cfe332913d5a69f8) and the [backup video](screenshots/demo.webm) in separate tabs. The **Hear the result** button is off on this laptop.

## Three-minute flow

| Time | Action and talking point |
| --- | --- |
| 0:00–0:20 | In `referee/`, run **`npm run demo`**. Say “Two chess bots each stake 2 USDC on Arc testnet. The escrow pays the 4 USDC pot after it verifies the referee’s signed result.” |
| 0:20–1:05 | Keep the terminal on screen. Point out match creation, the stakes, the chess result, the EIP-712 signature, and settlement as they appear. When the page prompt appears, switch to the browser, refresh, and press **P**. |
| 1:05–1:45 | Let the board replay reach the QR end screen. Point to the winner, the amount paid, and the QR code for the Arc settle transaction. Press **Space** if you need to jump to the QR screen. |
| 1:45–2:30 | Press **P** to exit presentation mode and scroll to **Agent wallet safety**. Show the recorded 0.02 USDC payment and the 0.10 USDC attempt refused by the 0.05 USDC cap. |
| 2:30–3:00 | Open the settle link from the page or the terminal. Point to `Settled` and the payout in the Arc explorer, then return to the QR screen for questions. |

If Arc is slow, say “If this run misses its 60-second window, BotBet automatically replays our last confirmed Arc testnet result. You can still scan the QR code for that settlement.” When **FALLBACK** appears, let the replay finish, then refresh the browser and press **P**. If replay cannot run, switch to the pre-opened backup video.

After the demo, press **Ctrl+C** in each terminal running a server.
