# web/REQUESTS.md

- [settle] Please add `"referee": "0x…"` (the signer address) to result.json. The page currently falls back to
  `shared/deployments.json#referee`.
- [tts] Spec said a Next.js route, but web/ is Vite: `/api/tts` is a Vite dev/preview middleware (vite.config.ts). A static deploy (`vite build` only) has no server, so the button hides itself; deploying it needs a serverless function with the same contract (GET -> {enabled}, POST {text} -> audio/mpeg).
- [cap-demo] live-runs 19ffa31 added a top-level `refusedTxHash` (reverted, status 0) to cap-demo.json; interfaces.md §6 does not list it. Page reads `refusedTxHash` or `refused.txHash` and links it; without it the card says "(simulated)". Please add it to §6 (suggest `refused.txHash`).
