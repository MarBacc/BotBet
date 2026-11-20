# Poker on the existing MatchEscrow

Heads-up **fixed-limit** Texas Hold'em (HU-LHE) between two bots, settled by the *unchanged*
`MatchEscrow` through the same EIP-712 `MatchResult` the chess match uses.

## What the contract checks (contracts/src/MatchEscrow.sol `settle`)

1. the match exists and is `Funded` (both bots staked),
2. `result.matchId == matchId`,
3. `result.winner` is `botA` or `botB`,
4. the EIP-712 signature over `MatchResult{matchId, winner, moveCount, pgnHash, finishedAt}`
   (domain `BotBet` / `1` / chain / escrow address) recovers to the deployed referee.

It never interprets `moveCount` or `pgnHash`; it only hashes them. Poker therefore fits without
any contract change.

## Mapping

| `MatchResult` field | chess | poker |
|---|---|---|
| `matchId` | random bytes32 | random bytes32, **and the deck seed** (anyone can re-deal every hand) |
| `winner` | the bot that mated | the bot with **more chips** after the last hand |
| `moveCount` (uint16) | plies | **hands played** (≤ 65535) |
| `pgnHash` | keccak256(PGN) | **keccak256(canonical hand-history JSON)**, see `history.ts` |
| `finishedAt` | unix seconds | unix seconds |

Canonical hand-history JSON = `JSON.stringify` of the `hands` array with object keys sorted
recursively, no whitespace, UTF-8. `finishedAt` is not part of it, so the same seed and bots
always give the same hash (determinism test).

## Rules that make it always settle

- The contract needs exactly one winner; a chip tie cannot settle. After the scheduled hands
  (default 30, or earlier if a bot is busted), if chips are equal, up to 10 extra hands are
  dealt. If it is still tied, the winner is the bot that won the last non-split pot (if none,
  bot A). All of this is deterministic in the seed.
- Stakes and payout are the escrow's: each bot stakes the same USDC, the winner gets the pot.
  Chips are only the in-game score; they are never converted to USDC.
- Same addresses as chess: bot slot A uses `BOT_1_PRIVATE_KEY`, slot B `BOT_2_PRIVATE_KEY`.

## Game rules (engine.ts)

Blinds 1/2, stacks 100, small bet 2 (preflop, flop), big bet 4 (turn, river), at most 4 bets per
street (the big blind counts as the first preflop bet). The button posts the small blind, acts
first preflop and last after the flop; the button alternates each hand. A player who cannot
cover a bet is all-in, the unmatched part is returned, and the board runs out.

## Files

`cards.ts` cards and the seeded RNG · `evaluator.ts` 7-card evaluator · `engine.ts` one hand ·
`bots/*.ts` Nit, Maniac, Theory (`referee/data/poker/preflop-chart.json`) · `match.ts` N hands +
result · `play-poker.ts` keyless run · `settle-poker.ts` on-chain flow (`--dry-run`).
