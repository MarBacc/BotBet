# contracts — Person A

Foundry project for `AgentWallet`, `MatchEscrow` and `BetPool` on Arc testnet.
`lib/forge-std` is vendored (plain files, not a submodule), so a normal `git clone` is enough.

```bash
forge build
forge test
```

If `forge` prints a PHP notice, you are running Laravel Herd's Forge CLI, not Foundry:

```bash
export PATH="$HOME/.foundry/bin:$PATH"
```

Money rule: the 6-decimal ERC-20 USDC interface everywhere, never native 18-decimal amounts.
Deploy script writes addresses and ABIs to `../shared/deployments.json`.
