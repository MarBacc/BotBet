# web/REQUESTS.md

- [settle] Please add `"referee": "0x…"` (the signer address) to result.json. The page currently falls back to
  `shared/deployments.json#referee`.
- [cap-demo] Page assumes cap-demo.json amounts (`capUsdc`, `allowed.amount`, `refused.amount`) are 6-decimal base-unit strings, and decodes `refused.reason` of form `CapExceeded(amount, cap)`; any other reason string is shown verbatim.
- [tts] Spec said a Next.js route, but web/ is Vite: `/api/tts` is a Vite dev/preview middleware (vite.config.ts). A static deploy (`vite build` only) has no server, so the button hides itself; deploying it needs a serverless function with the same contract (GET -> {enabled}, POST {text} -> audio/mpeg).
