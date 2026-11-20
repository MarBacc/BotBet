# Arc testnet — what we need to build on it

Fetched from the official docs on 2026-11-19: `docs.arc.io` (connect-to-arc, contract-addresses,
rpc-endpoints, gas-and-fees, evm-differences), Circle's `circlefin/skills` use-arc skill, and
`faucet.circle.com`. Values quoted below came from those pages, not from memory.

## Network

| | Testnet | Mainnet (do not use) |
|---|---|---|
| RPC | `https://rpc.testnet.arc.io` | `https://rpc.mainnet.arc.io` |
| WebSocket | `wss://rpc.testnet.arc.io` | `wss://rpc.mainnet.arc.io` |
| Chain ID | **5042002** (`0x4CEF52`) | 5042 (`0x13B2`) |
| Explorer | `https://explorer.testnet.arc.io` | `https://explorer.arc.io` |
| Native gas token | USDC | USDC |
| Faucet | `https://faucet.circle.com` | none |

Third-party testnet RPCs, if the public one is rate-limited during the hackathon:
`https://rpc.quicknode.testnet.arc.io`, `https://rpc.drpc.testnet.arc.io`,
`https://rpc.blockdaemon.testnet.arc.io` (each also offers `wss://`).

```
ARC_RPC_URL=https://rpc.testnet.arc.io
ARC_CHAIN_ID=5042002
ARC_EXPLORER_URL=https://explorer.testnet.arc.io
USDC_ADDRESS=0x3600000000000000000000000000000000000000
```

## USDC and the decimals trap

**One balance, two views.** USDC is the native gas token *and* an ERC-20 at a fixed predeploy
address. They are not separate assets — reading both and adding them double-counts.

- Native view: **18 decimals**. Used for gas and `msg.value`.
- ERC-20 view: **6 decimals**, at `0x3600000000000000000000000000000000000000` — the same address
  on every Arc network. The docs: "Optional ERC-20 interface for interacting with the native USDC
  balance. Uses 6 decimals."
- To display a native value as USDC, divide by 10¹².

**Our rule stands:** everything goes through the 6-decimal ERC-20 interface, and every amount in
Solidity, JSON or TypeScript is a base-unit integer (`1 USDC = 1000000`). Conversion only ever
happens in `shared/src/money.ts`. Nothing in this project should ever touch an 18-decimal amount;
if you see `1e18` or `parseEther`, it is a bug.

**Event double-counting.** A native transfer emits an EIP-7708 `Transfer` log from the system
address `0xffffFFFfFFffffffffffffffFfFFFfffFFFfFFfE`, and the ERC-20 interface logs its own
6-decimal `Transfer`. A single ERC-20 transfer emits **both**. Filter by emitter address or you
will count every payment twice — this matters if we ever index events.

## Gas and finality

- Sub-second finality: "Transactions are final in under 1 second", ~0.5 s blocks, 30M gas/block.
  **1 confirmation is enough** for the intel-receipt check.
- **Minimum base fee is 20 Gwei, and a transaction below it is silently dropped by the mempool** —
  no error, it just never appears. If a deploy or a settle "disappears", check `maxFeePerGas`
  first. Gas is paid in USDC.
- Gas comes out of the same USDC balance as stakes. A wallet funded with exactly its stake cannot
  pay for the transaction that stakes it — fund above the stake.

## Other predeploys (same address on testnet and mainnet)

| Contract | Address |
|---|---|
| USDC (ERC-20 interface) | `0x3600000000000000000000000000000000000000` |
| System Transfer emitter | `0xffffFFFfFFffffffffffffffFfFFFfffFFFfFFfE` |
| Permit2 | `0x000000000022D473030F116dDEE9F6B43aC78BA3` |
| Multicall3 | `0xcA11bde05977b3631167028862bE2a173976CA11` |
| CREATE2 Factory | `0x4e59b44847b379578588920cA78FbF26c0B4956C` |

EURC on testnet is `0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a` (6 decimals). There is **no wrapped
USDC** on Arc.

## Faucet

`https://faucet.circle.com`, pick "Arc Testnet". **20 USDC per address every 2 hours, per chain.**

For the solo build that means: two bot EOAs need stake + gas, and the deployer needs gas. Request
early — at 20 USDC per 2 hours per address, you cannot top up three addresses in a hurry. Keep
demo stakes small (1-5 USDC) so one faucet round covers several runs.

## Foundry

The docs warn that a plain `anvil` does not reproduce Arc's behaviour and recommend Arc's own
`arc-anvil --network arc` for local simulation. For this build we test contract logic against
plain Foundry and verify the real behaviour on testnet — but if a test passes locally and fails
on Arc, this is the first thing to suspect.

## Which organizer questions this answers

Resolved by these docs — **do not ask the organizers**:

1. Arc basics (RPC, chain ID, USDC address, faucet) — above.
2. Faucet limits — 20 USDC / 2 h / address / chain.
4. Block time and finality — sub-second, 1 confirmation is fine.

Still worth asking:

3. **Does Arc's USDC support EIP-2612 `permit`?** Not stated on any page read. The docs mention
   only `transferFrom`, `approve` and allowance management. **Permit2 is deployed**
   (`0x0000...78BA3`), which is a different mechanism and would also remove the approve step —
   but using it is more work than a plain `approve`, so assume two-step approve for now.
5. **Grok Bot MCP access** — unrelated to Arc; ask only if that extra is back on the table.

## Not verified

- Whether the public testnet RPC rate-limits bursts (the deploy + settle flow is a handful of
  transactions, so this is unlikely to bite).
- Whether `arc-anvil` is needed for anything we are building.
- Mainnet values above are recorded only so nobody confuses them with testnet. **Never point
  `ARC_RPC_URL` at mainnet** — the gas token is real USDC there.
