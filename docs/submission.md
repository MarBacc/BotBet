# Submission checklist

**Devpost: ubc-hackathon-2026.devpost.com — due Friday 20 November, 12:00 PM CST.**
Work through this at 05:30 Friday. Every line is a requirement from the guide, not a nicety;
the participation prize alone needs all of it.

## Selections on Devpost

- [ ] Main track: **Agentic Payments and AI** (exactly one, cannot be changed by submitting twice)
- [ ] Chain award: **Best use of Arc** (never Solana as well — mutually exclusive)
- [ ] Bounty: **ElevenLabs** (opt in explicitly; opting in is what makes you eligible)
- [ ] Not entering: Gemini Prediction Markets, QuickNode Streams, Grok Bot

## Required artifacts

- [ ] **Public GitHub repo** — `github.com/MarBacc/BotBet` is currently **private**. Flip it.
- [ ] Setup instructions in the repo that actually work from a clean clone
- [ ] **README with technical documentation and an architecture overview**
- [ ] **2–3 minute demo video**, Google Drive or YouTube, accessible to judges (not "anyone with
      the link" turned off)
- [ ] A working demo or deployed application
- [ ] Project name, short description, all team members
- [ ] Technologies and sponsor tools used

## Written answers (Devpost fields)

- [ ] What did you build?
- [ ] What problem does it solve?
- [ ] How does it work?
- [ ] What makes it unique?
- [ ] What would you build next? — `docs/roadmap.md` is literally the answer: betting pool, paid
      intel, agent spending caps

## Track and award requirements (these are graded)

- [ ] **Agentic Payments:** the README documents the agent's decision loop **and the safety
      limits**. Ours: funds move only on a referee-signed EIP-712 result, each bot's exposure is
      capped at its stake, the escrow can settle a match exactly once.
- [ ] **Best use of Arc:** the README includes the deployed **contract address** and explains how
      the project uses Arc (USDC as native gas, the 6-decimal ERC-20 interface, Foundry).
- [ ] **ElevenLabs:** the README names which ElevenLabs product was used (Text to Speech API) and
      how. **The demo video must show the integration in action, with audible audio.**

## Video shot list (2–3 min)

1. One line on what it is: two AI agents bet real USDC on a chess game they play themselves.
2. `npm run settle` running in a terminal — stakes, the game, the signed result, the payout,
   each with a tx hash.
3. The page: board replaying, **commentary audible** (this is the ElevenLabs requirement), the
   winner, the balances.
4. The settle transaction open on `explorer.testnet.arc.io`. Real money moved on a real chain.
5. One line on what is next, from the roadmap.

## Before you close the laptop

- [ ] Submit early. The deadline is a wall, and Devpost does not care why you were late.
- [ ] **Be physically present at the closing ceremony on Saturday 21 November** — the guide says
      teams must attend in person to qualify for any prize, bounties included.
