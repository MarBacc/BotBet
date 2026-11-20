# web — Person C

Vite + React + TypeScript single page: live chessboard, betting panel, bot wallet ledger, leaderboard.
Still the stock Vite template — Person C replaces it.

```bash
npm install
npm run dev
npm run build
```

Reads addresses and ABIs from `../shared/deployments.json`.
Browser config comes from `VITE_*` variables in the root `.env` (Vite only exposes the `VITE_` prefix — never put a key here).
