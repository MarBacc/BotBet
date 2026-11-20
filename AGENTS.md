# Wallet agent hard rules

- Work only in this folder, on branch `feat/agent-wallet`. Never switch branches or change Git configuration. The author is preset. Use the preset identity without co-author trailers.
- Create or edit only `contracts/src/AgentWallet.sol`, `contracts/test/AgentWallet.t.sol`, `contracts/script/DeployAgentWallet.s.sol`, `AGENTS.md`, `PROGRESS-wallet.md`, and `HANDOFF.md`. Never edit `MatchEscrow.sol` or its test, `referee/`, `web/`, `shared/`, `interfaces.md`, or `docs/`.
- Never read `.env`. Never deploy, broadcast, or use private keys.
- After every green step, update `PROGRESS-wallet.md` with the time, what is done, what is next, and any blockers. Commit with the `[wallet] ` prefix, then ask before running `git push origin feat/agent-wallet`. Never push elsewhere or force-push.
- If Forge is unavailable, run `export PATH="$HOME/.foundry/bin:$PATH"`.
