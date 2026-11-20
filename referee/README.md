# referee

Node scripts (no server) that play the match, sign the result and settle it on Arc testnet.
Spec: `interfaces.md` §2–3 and §6. Chain facts: `docs/arc.md`.

| Script | Chain? | What it does |
|---|---|---|
| `npm run play-game` | no | One offline game, printed and EIP-712 signed. With no keys it signs with a throwaway key (says so). |
| `npm run settle -- --dry-run` | reads only | Every preflight check, balances, the plan. Sends nothing. |
| `npm run settle` | **sends 6 txs** | createMatch → approve/stake ×2 → play → sign → settle; writes `web/public/result.json`. |
| `npm run cap-demo -- --dry-run` | reads/simulates | AgentWallet cap demo, nothing sent. |
| `npm run cap-demo` | **sends 1 tx** | Pays 0.02 under the cap, simulates 0.10 over it; writes `web/public/cap-demo.json`. |
| `npm run rehearse:local` | local anvil only | The REAL settle loop ×2 + cap demo against anvil (chain 5042002), MockUSDC, fresh MatchEscrow and AgentWallet, public test keys. Needs `cd contracts && forge build` (macOS libusb error: `export DYLD_FALLBACK_LIBRARY_PATH="$HOME/.foundry/lib"`). Writes `/tmp/rehearsal-*.json`. |
| `npm run check-setup` | no | Node version, shared build, dependencies. Runs automatically before every script above. |

Flags for `settle`: `--fen "<FEN>"` (start mid-game, demo mode), `--dry-run`, `--json` (summary JSON on
stdout, progress on stderr). Env: `STAKE_USDC` (default `2`), `ARC_RPC_URL` (default
`https://rpc.testnet.arc.io`), `BOTBET_ENV_FILE` (use a .env elsewhere).

## LIVE-RUNNER: exact commands, in order

From the repo root, on a machine whose `.env` has the four burner keys. Never print `.env`.

```bash
# 0. once per machine
cd shared && npm install && npm run build && cd ..
cd referee && npm install

# 1. offline sanity (no chain): the game plays and the signature recovers to the deployed referee
npm run play-game

# 2. dry run: must show ✅ on every line — chain 5042002, USDC 0x3600…0000,
#    escrow 0x9d4EEE03C431c524822c6A1486bE6142d2a4916c, each key → its expected address:
#      admin   0xEAb99118c98abbfA99aD55dd261c6fcEf8381f7F
#      referee 0xE632a919CEE69FC9482a6A719D47878EEDA28345
#      deep    0xBAe2658a561A7A37e7CF4fDF336772dD23460E24   (BOT_1)
#      hasty   0x016E0a0c6a153edFDd05947667Be12Be001Eb661   (BOT_2)
#    and every balance ≥ need (bots: 2.05 USDC, admin/referee: 0.05 USDC)
npm run settle -- --dry-run

# 3. CHECKPOINT: two live settles back to back; each ends "✅ SETTLED <explorer link>"
npm run settle
npm run settle
#    record both settle tx links; keep the second web/public/result.json

# 4. demo mode (optional): a mid-game start position
npm run settle -- --fen "<FEN>"

# 5. cap demo, once AgentWallet is deployed and AGENT_WALLET_ADDRESS is in .env
npm run cap-demo -- --dry-run
npm run cap-demo
```

If something fails, the last line is `❌ FAILED at "<step>": <reason>` with a `→` hint. Common ones:

- `missing or malformed in the environment: …`: the listed variables are not `NAME=0x<64 hex>` in `.env`.
- `insufficient USDC: <address> …`: fund it at https://faucet.circle.com (Arc Testnet, 20 USDC / 2 h).
- `<step> reverted: <ErrorName>(…)`: the decoded MatchEscrow custom error (e.g. `NotAdmin()`).
- `RPC … is unreachable`: check `ARC_RPC_URL`; `docs/arc.md` lists fallback RPCs.
- `tx … was not mined within 180s`: open the printed explorer link; Arc drops txs under 20 gwei.

A run that fails after `createMatch` leaves that match behind; the next run uses a fresh match ID,
so just run it again. MatchEscrow has no refund: if one bot staked and the other did not, that one
stake (2 USDC) stays in the escrow. Each run therefore checks every balance before sending anything.
