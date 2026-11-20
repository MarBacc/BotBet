# BotBet demo runbook (DRAFT by integration lead, for demo-agent to adopt as docs/demo-runbook.md)

Every command below exists in `referee/package.json` or `web/package.json` on solo, and every tx
hash is copied from LIVE-RUNS.md and checked on Arc RPC. Nothing here is invented.

## Before going on stage (T-15 min)

```bash
export PATH="$HOME/.foundry/bin:$PATH"
cd shared && npm install && npm run build && cd ..
cd referee && npm install
npm run check-setup            # one-screen verdict: READY / REPLAY ONLY / NOT READY
npm run demo -- --dry-run      # every preflight check, nothing sent
```

Wallets need: each bot ≥ 2.05 USDC, admin and referee ≥ 0.05 USDC (ERC-20 6-decimal view).
Low? https://faucet.circle.com → Arc Testnet (20 USDC / 2 h).

Web (second terminal). The voice button needs `ELEVENLABS_API_KEY` and `ELEVENLABS_VOICE_ID` in
`.env`, and it only works under `dev` or `preview` (the `/api/tts` route is Vite middleware):

```bash
cd web && npm install && npm run dev       # or: npm run build && npm run preview
```

## What to have open

1. Terminal A: `referee/`, font size up, ready to type `npm run demo`.
2. Browser tab: the page (`http://localhost:5173/`; add `?present=1` for projector mode, or press **P**).
3. Browser tab: MatchEscrow on the explorer:
   https://explorer.testnet.arc.io/address/0x9d4EEE03C431c524822c6A1486bE6142d2a4916c
4. Browser tab: AgentWallet:
   https://explorer.testnet.arc.io/address/0xaEb54edFe9F702B926DF7eaEB0e3Ebfa6C005262

## The live sequence (about 2 minutes)

1. **Say:** "Two AI agents, Deep Thought (Stockfish depth 12) and Hasty Hal (depth 4), each stake 2 USDC on Arc."
2. **Run:** `npm run demo`. It does the setup check, then a settle from a mid-game position
   (createMatch → approve/stake ×2 → play → referee signs EIP-712 → `settle()`), then the cap demo
   if `AGENT_WALLET_ADDRESS` is set. It prints the page URL.
3. **Show:** the terminal's `✅ SETTLED <explorer link>`. Click it: the 4 USDC payout on Arc.
4. **Switch to the page:** reload. The board replays (Space play/pause, ←/→ step), the pot, both
   balances before and after, the **referee-attested** badge, and the settle tx link.
5. **Hear the result:** the ElevenLabs button narrates the outcome.
6. **AgentWallet card:** cap 0.05 USDC per payment. A 0.02 payment went through; a 0.10 payment was
   refused on-chain with `CapExceeded(100000, 50000)`. This is the "agents safely hold stablecoins" proof.

Wording: results are **referee-attested** (the contract pays whatever the referee key signs).
Never say "trustless".

## If something goes wrong

| Symptom | Do this |
|---|---|
| Arc slow / tx not mined | Ctrl-C, then `npm run replay-last`: re-prints the last live run with its real tx links. No chain, no keys. |
| `insufficient USDC` | Faucet (above), or go straight to `npm run replay-last`. |
| Page shows **SAMPLE DATA** | `web/public/result.json` is missing. `git checkout origin/solo -- web/public/result.json`. |
| Voice button missing | ELEVENLABS vars not set, or the page is a static build. Skip; read the line aloud. |
| Everything is down | Play the backup video. |

## Proof already on-chain (from LIVE-RUNS.md, verified status 1)

- MatchEscrow: `0x9d4EEE03C431c524822c6A1486bE6142d2a4916c`
- Settle run 1: https://explorer.testnet.arc.io/tx/0x41babdf1789a50d180d1e1c4b761de510f329cfbd0b2f1691b0bebb0af6c02b4
- Settle run 2: https://explorer.testnet.arc.io/tx/0xf17764910dcf04c29830834d57d38c8ca8101c16036d694876faf4626f4af6f4
- AgentWallet: `0xaEb54edFe9F702B926DF7eaEB0e3Ebfa6C005262` (cap 0.05 USDC per payment)
- Allowed 0.02 USDC payment: https://explorer.testnet.arc.io/tx/0xfa0a3a6faefa6c3fdd00a32620f089edb04b84432429428ba99fd3a3a468239a

## Rehearsal with no real money

```bash
cd contracts && forge build && cd ../referee
npm run rehearse:local          # the real settle code ×2 + cap demo against local anvil
npm test                        # 17 unit tests: money, EIP-712 round-trip, FEN validation
```
