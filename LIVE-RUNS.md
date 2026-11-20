# BotBet Arc testnet live runs

## 2026-11-20 01:48:46 CST — Setup

- Created the live-run worktree from the settle branch and merged the wallet branch.
- All four required key variables are set. Foundry 1.8.5 is available, and npm dependencies and the shared build are ready.
- Deployment metadata lists Arc testnet chain 5042002 and MatchEscrow `0x9d4EEE03C431c524822c6A1486bE6142d2a4916c`.

## 2026-11-20 01:50:12 CST — Settle run 1

- Match ID: `0x95db89e43badceb2c3d7bb5ab2670896ae41037643ff93d07b68ce4499a1594b`.
- Winner: Deep Thought (`0xBAe2658a561A7A37e7CF4fDF336772dD23460E24`) in 55 plies. The verified Settled event paid 4.000000 USDC.
- Final balances in USDC: admin 19.957985, referee 19.998072, deep 21.996973, hasty 17.996876.
- createMatch [`0xb7ac12d39fab1dfc2504be96a5831ecc9df5402d0150274fbf64171942ea068c`](https://explorer.testnet.arc.io/tx/0xb7ac12d39fab1dfc2504be96a5831ecc9df5402d0150274fbf64171942ea068c)
- deep.approve [`0xb35ba4238040f176f1337ffeb0baa850e79a1cb38bf7fc00a081fcdcd203d1f7`](https://explorer.testnet.arc.io/tx/0xb35ba4238040f176f1337ffeb0baa850e79a1cb38bf7fc00a081fcdcd203d1f7)
- deep.stake [`0x294990f4bdd9c88c10a643a5ae58420dc14c796755b9ddca1d9f3655d1fde6a8`](https://explorer.testnet.arc.io/tx/0x294990f4bdd9c88c10a643a5ae58420dc14c796755b9ddca1d9f3655d1fde6a8)
- hasty.approve [`0xb9f4ef972ed0081b68ac2b745c1ae4a8b0e96ff84221f1a927502c768c5f95c7`](https://explorer.testnet.arc.io/tx/0xb9f4ef972ed0081b68ac2b745c1ae4a8b0e96ff84221f1a927502c768c5f95c7)
- hasty.stake [`0x7ba4d89503ac0fcd074086a7ca42849fd07faa6604fa8a2049eff11a2e305ea6`](https://explorer.testnet.arc.io/tx/0x7ba4d89503ac0fcd074086a7ca42849fd07faa6604fa8a2049eff11a2e305ea6)
- settle [`0x41babdf1789a50d180d1e1c4b761de510f329cfbd0b2f1691b0bebb0af6c02b4`](https://explorer.testnet.arc.io/tx/0x41babdf1789a50d180d1e1c4b761de510f329cfbd0b2f1691b0bebb0af6c02b4)

## 2026-11-20 01:50:41 CST — Settle run 2

- Match ID: `0xcd1bd3b32d765d92249297abd735286f8808c5719bd7902a604715b1b9932bfd`.
- Winner: Deep Thought (`0xBAe2658a561A7A37e7CF4fDF336772dD23460E24`) in 55 plies. The verified Settled event paid 4.000000 USDC.
- Final balances in USDC: admin 19.955117, referee 19.996146, deep 23.993947, hasty 15.993752.
- createMatch [`0xa5c452609c8b9e0c925ff3427fe2696debbcda7cc1223f41894402f2d37f1483`](https://explorer.testnet.arc.io/tx/0xa5c452609c8b9e0c925ff3427fe2696debbcda7cc1223f41894402f2d37f1483)
- deep.approve [`0xb8f7668bbcfc14232c5b4c509c54831b16c2d2116c3097c04931df8493a7a419`](https://explorer.testnet.arc.io/tx/0xb8f7668bbcfc14232c5b4c509c54831b16c2d2116c3097c04931df8493a7a419)
- deep.stake [`0xe86542a9779913e8e509d69fba164229a6cf74df629206c19d04038b300dabc4`](https://explorer.testnet.arc.io/tx/0xe86542a9779913e8e509d69fba164229a6cf74df629206c19d04038b300dabc4)
- hasty.approve [`0x2746ab2da6e0b0e6e522638be1d6cf1542937ac373f570398c923685b48cf97b`](https://explorer.testnet.arc.io/tx/0x2746ab2da6e0b0e6e522638be1d6cf1542937ac373f570398c923685b48cf97b)
- hasty.stake [`0x87c7cdeeae195e6dde8cb98085a97c0a25dbb0e975dca8ebd32b312315cc722c`](https://explorer.testnet.arc.io/tx/0x87c7cdeeae195e6dde8cb98085a97c0a25dbb0e975dca8ebd32b312315cc722c)
- settle [`0xf17764910dcf04c29830834d57d38c8ca8101c16036d694876faf4626f4af6f4`](https://explorer.testnet.arc.io/tx/0xf17764910dcf04c29830834d57d38c8ca8101c16036d694876faf4626f4af6f4)

CHECKPOINT PASSED

## 2026-11-20 01:57 CST — AgentWallet deployment and funding

- Arc testnet chain 5042002. Owner `0xEAb99118c98abbfA99aD55dd261c6fcEf8381f7F`. USDC `0x3600000000000000000000000000000000000000`. On-chain cap 50,000 base units (0.05 USDC).
- Wallet [`0xaEb54edFe9F702B926DF7eaEB0e3Ebfa6C005262`](https://explorer.testnet.arc.io/address/0xaeb54edfe9f702b926df7eaeb0e3ebfa6c005262).
- Deployment [`0xb046d2e222859c5d3d912cb6d89fe548b1616a6d9728e95a942a026c0d432e88`](https://explorer.testnet.arc.io/tx/0xb046d2e222859c5d3d912cb6d89fe548b1616a6d9728e95a942a026c0d432e88).
- Funding of 0.20 USDC verified by the Transfer event and wallet balance [`0x31f1e3f9b68216234609ae5d12b8ed4159494187a1a8beb7c45d809cba090093`](https://explorer.testnet.arc.io/tx/0x31f1e3f9b68216234609ae5d12b8ed4159494187a1a8beb7c45d809cba090093).

## 2026-11-20 02:00:41 CST — Cap demo

- Allowed payment of 0.02 USDC to referee `0xE632a919CEE69FC9482a6A719D47878EEDA28345`. Verified the wallet’s Paid event. [`0xfa0a3a6faefa6c3fdd00a32620f089edb04b84432429428ba99fd3a3a468239a`](https://explorer.testnet.arc.io/tx/0xfa0a3a6faefa6c3fdd00a32620f089edb04b84432429428ba99fd3a3a468239a)
- A simulated 0.10 USDC payment reverted with `CapExceeded(100000, 50000)`.
- Final wallet balance 0.18 USDC. Verified `web/public/cap-demo.json`.

## Demo-length rehearsal

- Started 2026-11-20 02:49:48 CST on Arc testnet (chain 5042002).
- FEN `8/8/8/4k3/8/8/8/3QK3 w - - 0 1`.
- 17 plies. 21.8 seconds from command start to the verified Settled event.
- Match ID `0xc237419496934a7158e7948427cfbafa02c2463e7d9da59cadaf582b80017fc0`.
- Deep Thought (`0xBAe2658a561A7A37e7CF4fDF336772dD23460E24`) won 4.000000 USDC.
- The result artifact includes the on-chain referee address and the PGN. Replaying the PGN from the FEN yielded checkmate in 17 plies.

| Account | Final balance (USDC) |
| --- | ---: |
| Admin | 19.743653 |
| Referee | 20.014220 |
| Deep Thought | 25.990920 |
| Hasty Hal | 13.990629 |

- createMatch [`0x72ca060d945121bca942e37a097cbbc52ca2ad8ec099f79836ef1414e2abf66f`](https://explorer.testnet.arc.io/tx/0x72ca060d945121bca942e37a097cbbc52ca2ad8ec099f79836ef1414e2abf66f)
- deep.approve [`0x62c85e13b3b3495920811d73ab400a18f89b7cc569105135e0e0bb190226cf90`](https://explorer.testnet.arc.io/tx/0x62c85e13b3b3495920811d73ab400a18f89b7cc569105135e0e0bb190226cf90)
- deep.stake [`0x65740ac3532e9ab8b6227d66e1a854c07315df55e57f7898e553cf165eb2ebe4`](https://explorer.testnet.arc.io/tx/0x65740ac3532e9ab8b6227d66e1a854c07315df55e57f7898e553cf165eb2ebe4)
- hasty.approve [`0x74dc489b74c7078273be2b640ef6756ac76d229fc0258ebbd6b34921f03b3b11`](https://explorer.testnet.arc.io/tx/0x74dc489b74c7078273be2b640ef6756ac76d229fc0258ebbd6b34921f03b3b11)
- hasty.stake [`0x1b7d4ad76a92a23c120afeae0723a1e0405a573ca8f0b57b325892a78029e99b`](https://explorer.testnet.arc.io/tx/0x1b7d4ad76a92a23c120afeae0723a1e0405a573ca8f0b57b325892a78029e99b)
- settle [`0x4f49823d648fc2512bd96c79622c17d04f4ce77d577ad87c6dd2f35c4d8755f3`](https://explorer.testnet.arc.io/tx/0x4f49823d648fc2512bd96c79622c17d04f4ce77d577ad87c6dd2f35c4d8755f3)

## Presenter checklist (this laptop)

- `npm run check-setup` reported **READY FOR THE LIVE DEMO**. Shared build, referee dependencies, deployment metadata, key presence, and Arc testnet chain 5042002 passed.
- The stage dry run, `npm run settle -- --fen "8/8/8/4k3/8/8/8/3QK3 w - - 0 1" --dry-run`, passed in **1.42 seconds** wall clock.
- `npm run demo -- --dry-run` passed in **2.87 seconds** wall clock. It uses the built-in position and also simulates the cap demo.
- For the rehearsed 17-ply stage match, run `npm run settle -- --fen "8/8/8/4k3/8/8/8/3QK3 w - - 0 1"` from `referee/` after a fresh dry run and human approval. The stake is 2 USDC per bot. The loser spends its stake plus gas.
- Web dependencies installed and `npm run build` passed. Vite preview at [127.0.0.1:4173](http://127.0.0.1:4173/) served byte-for-byte the latest rehearsal result and rendered its settlement link in Chrome. Rebuild the web app after a new `result.json` is written so preview serves the new file.

| Wallet | Arc testnet address | USDC at block 73163506 |
| --- | --- | ---: |
| Admin | `0xEAb99118c98abbfA99aD55dd261c6fcEf8381f7F` | 19.743653 |
| Referee | `0xE632a919CEE69FC9482a6A719D47878EEDA28345` | 20.014220 |
| Deep Thought | `0xBAe2658a561A7A37e7CF4fDF336772dD23460E24` | 25.990920 |
| Hasty Hal | `0x016E0a0c6a153edFDd05947667Be12Be001Eb661` | 13.990629 |
| AgentWallet | `0xaEb54edFe9F702B926DF7eaEB0e3Ebfa6C005262` | 0.180000 |

Both bots are above 8 USDC, and the admin and referee are above 1 USDC. No faucet top-up is needed.

## 2026-11-20 03:05:13 CST — On-chain cap refusal

- Sent one 0.10 USDC payment attempt to the referee from the wallet owner with a 100,000 gas limit.
- Verified Arc testnet receipt status 0 at block 73163897 and `CapExceeded(100000, 50000)` decoded by replaying the exact call at the preceding block. [`0xd21f2097ccb7dd43093b5d6d526807ca8e672d20e585db1e946d74c2dfef3aa3`](https://explorer.testnet.arc.io/tx/0xd21f2097ccb7dd43093b5d6d526807ca8e672d20e585db1e946d74c2dfef3aa3)
- The wallet balance stayed at 0.18 USDC. The owner paid 0.0005935 USDC in gas.
