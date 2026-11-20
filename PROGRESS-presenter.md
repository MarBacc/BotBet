# Presenter progress

- `npm run demo` checks readiness and streams `settle` from the verified demo position. The 60-second deadline covers setup and settlement. A failure stops the live path and starts the recorded offline replay.
- Arc read-only dry run passed in **2.2 s**. Settle confirmed no transactions were sent.
- Invalid RPC rehearsal completed the offline replay in **1.0 s**. The preflight listed the RPC failure, and the recorded result showed a 4 USDC payout and the AgentWallet cap refusal.
- A simulated stalled `settle` hit the 60-second deadline and switched to replay. Total elapsed time with replay was **62.3 s**.
- The shared build, 18 referee tests, and web smoke tests passed. In Chrome, refreshing `http://localhost:5173` loaded the recorded result. **P**, the settle QR, and the AgentWallet card worked. `web/.env.local` is absent, and the voice button is off.
- After operator approval, the single live run took **26.7 s** end to end. Settle took **21.1 s**, including **0.4 s** for the 17-ply game. Deep Thought won the 4 USDC pot. [Verified Arc settle transaction](https://explorer.testnet.arc.io/tx/0x44452164759c4ebcf9ff7ada9abd49b373e470b83c749978cfe332913d5a69f8)
- After the live run, Chrome refreshed to the new 17-ply result and showed the matching settle link in the presentation QR. The result remains on the laptop for the stage replay.
