# shared

Cross-lane artifacts. Committed, read by every folder, written by the deploy script.

- `deployments.json` — contract addresses and ABIs for Arc testnet (created by `contracts/script`).
- `money.ts` — the only USDC conversion helpers in the repo (6 decimals, base units). See
  `interfaces.md` §0. Imported as the `botbet-shared` package — see below.

Nothing else goes here. Interface decisions belong in `interfaces.md` at the repo root.
