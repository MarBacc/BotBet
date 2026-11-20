# interfaces.md

The contract between lanes. Change this file **first**, tell the other two, then write code.
If something here is unworkable, stop and say so — do not diverge quietly.

Status: **sections 0-6 agreed 2026-11-19.** The decisions log records what was signed off and why.
The open questions at the bottom are what is still genuinely undecided.

### Decisions log

| # | Decision | Why |
|---|---|---|
| D1 | Bots stake from their **EOAs**; `AgentWallet` holds only the intel budget | Keeps the cap refusal as the demo moment without coupling wallet to escrow |
| D2 | `pay(to, amount, matchId)` — three arguments | Per-match budget beats a time window, and binds an intel receipt to a match |
| D3 | An intel request **pauses the move clock** up to 15 s, **once per ply** | A chain round-trip cannot fit in 3 s; the per-ply limit stops a bot stalling the game |
| D4 | `MatchResult` carries `escrow` and `betPool`; each contract checks its own | Restores the replay protection lost by dropping `verifyingContract` from the domain |
| D5 | Betting closes at **ply 20** (referee-called), `closeTime` as backstop | Spectators must be able to bet *during* play — that is the demo |
| D6 | `BetPool` keeps **three outcomes** including Draw | Stockfish-vs-Stockfish draws are common; voiding the pool on a draw would fire on stage |
| D7 | Division dust stays in `BetPool`; no sweep | A few base units per pool, not worth the lines or the review surface |
| D8 | `matchId` = 32 random bytes from the referee | No derivation rules to agree, no collision logic to test |
| D9 | Write routes require `ADMIN_TOKEN` (bearer header) | One line of middleware; stops a stray browser tab starting matches mid-demo |
| D10 | `settle` / `resolve` are callable by **anyone** holding a valid signature | The signature is the authorisation; a crashed referee cannot strand a settled match |
| D11 | Money helpers ship as the `botbet-shared` package, imported `file:../shared` | Standalone lanes cannot reach across folders with a relative import; copying the file into each lane is how decimals bugs start |

---

## 0. Money — decided

- **The ERC-20 USDC interface, 6 decimals, everywhere.** Never Arc's native 18-decimal amounts.
- Every amount crossing a boundary (Solidity, JSON, env, UI props) is an **integer number of base
  units**: `1 USDC = 1_000_000`. `5.5 USDC` is `5500000`.
- In JSON, amounts are **decimal strings**, never JS numbers: `"amount": "5500000"`. A number
  literal loses precision above 2^53 and invites accidental float math.
- **One shared place for conversion:** `shared/src/money.ts`, shipped as the `botbet-shared`
  package (D11). Nobody writes their own.

```ts
// import { toBaseUnits } from "botbet-shared";
export const USDC_DECIMALS = 6;
export const USDC_UNIT = 1_000_000n;
export function toBaseUnits(human: string | number): bigint;   // "5.5"  -> 5500000n
export function fromBaseUnits(base: bigint | string): string;  // 5500000n -> "5.5"
export function formatUsdc(base, opts?): string;               // 5500000n -> "5.50 USDC"
export function parseBaseUnits(base: string | bigint): bigint; // "500000" -> 500000n
export class MoneyError extends Error {}                       // thrown, never a silent wrong amount
```

Each of `referee/`, `bots/` and `web/` depends on it as `"botbet-shared": "file:../shared"`.
`shared/dist/` is gitignored, so **build `shared/` before the lanes that import it**:
`cd shared && npm install && npm run build`.

Banned anywhere in the repo: `parseEther`, `formatEther`, `1e18`, `ethers.utils.parseUnits(x, 18)`.
Solidity holds `uint256` base units and converts nothing.

---

## 1. Solidity

Shared types, used by more than one contract:

```solidity
enum Outcome { BotAWins, BotBWins, Draw }   // 0, 1, 2

struct MatchResult {
    bytes32 matchId;
    uint8   outcome;      // Outcome
    address winner;       // address(0) when outcome == Draw
    address escrow;       // the MatchEscrow this result may settle
    address betPool;      // the BetPool this result may resolve
    uint16  moveCount;
    bytes32 pgnHash;      // keccak256(bytes(pgn))
    uint64  finishedAt;   // unix seconds
}
```

`matchId` is a referee-generated `bytes32` (random 32 bytes, hex). It is the join key in every
contract, every WS event and every API route.

### 1.1 AgentWallet

One instance **per bot**. Holds that bot's USDC operating budget and enforces the spending cap.
Stakes do **not** go through it (D1) — this wallet is the agent's spending
account, and the cap refusal is the demo moment.

```solidity
contract AgentWallet {
    address public immutable owner;   // the bot's EOA; the only caller of pay()
    address public immutable admin;   // deployer; funds, withdraws, sets the cap
    IERC20  public immutable usdc;

    uint256 public capPerMatch;                          // base units
    mapping(bytes32 => uint256) public spentPerMatch;    // matchId => spent

    constructor(address owner_, address admin_, address usdc_, uint256 capPerMatch_);

    // --- bot ---
    function pay(address to, uint256 amount, bytes32 matchId) external;  // onlyOwner

    // --- admin ---
    function setCapPerMatch(uint256 newCap) external;                    // onlyAdmin
    function withdraw(address to, uint256 amount) external;              // onlyAdmin

    // --- views ---
    function remainingForMatch(bytes32 matchId) external view returns (uint256);
    function balance() external view returns (uint256);

    event Paid(bytes32 indexed matchId, address indexed to, uint256 amount, uint256 spentAfter);
    event CapUpdated(uint256 oldCap, uint256 newCap);
    event Withdrawn(address indexed to, uint256 amount);

    error NotOwner();
    error NotAdmin();
    error SpendingCapExceeded(bytes32 matchId, uint256 requested, uint256 spent, uint256 cap);
    error InsufficientBalance(uint256 requested, uint256 available);
    error ZeroAmount();
}
```

`pay` reverts with `SpendingCapExceeded` when `spentPerMatch[matchId] + amount > capPerMatch`.
That revert, surfaced in the UI, is the "Try overspend" demo.

Funding is a plain `usdc.transfer(wallet, amount)` from anyone — no `fund()` function needed.

**Funding checklist — the deploy/funding script must do all four, per bot (D1).** Miss any one and
the first live match dies on an allowance error:

1. bot **EOA** holds at least `stakeAmount` USDC (plus gas);
2. bot EOA has called `usdc.approve(MatchEscrow, stakeAmount)` — or more, for several matches;
3. bot's **AgentWallet** holds at least `capPerMatch` USDC;
4. `capPerMatch` is set high enough for the balanced bot and the big spender, and deliberately
   **below** what the big spender will try to spend in the overspend demo.

### 1.2 MatchEscrow

Both bots stake the same amount from their **EOAs** (each must `usdc.approve(escrow, stake)` first).
Settlement is driven by a referee-signed `MatchResult`.

```solidity
contract MatchEscrow {
    enum Status { None, Open, Funded, Settled, Cancelled }

    struct Match {
        address botA;
        address botB;
        uint256 stakeAmount;   // per bot, base units
        uint64  stakeDeadline; // unix seconds
        bool    stakedA;
        bool    stakedB;
        Status  status;
    }

    address public immutable referee;  // recovers from the result signature
    address public immutable admin;
    IERC20  public immutable usdc;

    mapping(bytes32 => Match) public matches;

    function createMatch(
        bytes32 matchId, address botA, address botB,
        uint256 stakeAmount, uint64 stakeDeadline
    ) external;                                         // onlyAdmin

    function stake(bytes32 matchId) external;           // botA or botB, pulls stakeAmount
    function settle(bytes32 matchId, MatchResult calldata result, bytes calldata signature) external;
    function cancel(bytes32 matchId) external;          // after stakeDeadline, refunds whoever staked

    function getMatch(bytes32 matchId) external view returns (Match memory);

    event MatchCreated(bytes32 indexed matchId, address indexed botA, address indexed botB, uint256 stakeAmount);
    event Staked(bytes32 indexed matchId, address indexed bot, uint256 amount);
    event MatchFunded(bytes32 indexed matchId, uint256 pot);
    event Settled(bytes32 indexed matchId, uint8 outcome, address indexed winner, uint256 payout);
    event Cancelled(bytes32 indexed matchId);

    error MatchExists();
    error MatchNotFound();
    error NotParticipant();
    error AlreadyStaked();
    error WrongStatus(uint8 expected, uint8 actual);
    error DeadlinePassed();
    error DeadlineNotReached();
    error ResultMismatch();       // result.matchId != matchId
    error InvalidWinner();        // winner not a participant, or non-zero on a draw
    error InvalidSignature();     // recovered signer != referee
    error WrongContract();        // result.escrow != address(this)   (D4)
}
```

Payout: winner takes the whole pot (`2 * stakeAmount`). Draw refunds each bot its stake.
No fee in v1 (Q1). `settle` is callable by **anyone** holding a valid signature (D10) — the
signature is the authorisation, which keeps the referee server off the critical path and means a
crashed referee cannot strand a settled match. In practice the referee submits it.

### 1.3 BetPool

Parimutuel, three outcomes, one pool per match. Pull payouts.

```solidity
contract BetPool {
    enum PoolStatus { None, Open, Closed, Resolved, Refunding }

    address public immutable referee;
    address public immutable admin;
    IERC20  public immutable usdc;
    uint16  public immutable feeBps;   // 0 in v1

    // matchId => outcome => total staked
    mapping(bytes32 => uint256[3]) public totals;
    // matchId => bettor => outcome => amount
    mapping(bytes32 => mapping(address => uint256[3])) public bets;
    // matchId => bettor => already claimed
    mapping(bytes32 => mapping(address => bool)) public claimed;

    function openPool(bytes32 matchId, uint64 closeTime) external;            // onlyAdmin
    function placeBet(bytes32 matchId, uint8 outcome, uint256 amount) external;
    function closePool(bytes32 matchId) external;                             // admin, or anyone after closeTime
    function resolve(bytes32 matchId, MatchResult calldata result, bytes calldata signature) external;
    function claim(bytes32 matchId) external;                                 // winnings, or refund when Refunding

    function poolTotals(bytes32 matchId) external view returns (uint256[3] memory);
    function previewPayout(bytes32 matchId, address bettor) external view returns (uint256);

    event PoolOpened(bytes32 indexed matchId, uint64 closeTime);
    event BetPlaced(bytes32 indexed matchId, address indexed bettor, uint8 outcome, uint256 amount, uint256[3] totalsAfter);
    event PoolClosed(bytes32 indexed matchId);
    event PoolResolved(bytes32 indexed matchId, uint8 outcome, uint256 winningTotal, uint256 losingTotal);
    event Claimed(bytes32 indexed matchId, address indexed bettor, uint256 amount);
    event PoolRefunding(bytes32 indexed matchId);   // nobody backed the winning outcome

    error PoolExists();
    error PoolNotFound();
    error BettingClosed();
    error PoolNotClosed();
    error AlreadyResolved();
    error NothingToClaim();
    error AlreadyClaimed();
    error InvalidOutcome();
    error ZeroAmount();
    error ResultMismatch();
    error InvalidSignature();
    error WrongContract();        // result.betPool != address(this)   (D4)
}
```

Payout for a winning bet `b` on outcome `o`:

```
payout = b + (b * losingTotal) / winningTotal        // feeBps = 0 in v1
```

Integer division leaves dust in the contract; that is accepted (D7).
If `winningTotal == 0`, the pool goes to `Refunding`, emits `PoolRefunding`, and every bettor
claims their own bet back. `previewPayout` is what the frontend shows as live odds.

**When betting closes (D5).** The pool opens when the match is created and stays open *while the
match is being played* — spectators betting on a live game is the demo. The referee calls
`closePool` at **ply 20** (about a third of the way into a typical game) and emits `pool.closed`.
`closeTime` is only a backstop so a stalled match cannot leave a pool open forever; set it to
match start + 10 minutes. Late parimutuel bets on an obvious winner are possible and accepted —
by ply 20 the evaluation is rarely decisive, and the alternative (betting only before the first
move) makes the live panel dead weight.

### 1.4 Who calls what

Every function below has exactly one real caller in the demo. Anything without one is cut.

| Contract.function | Called by | When |
|---|---|---|
| `AgentWallet.pay` | bot EOA | mid-match intel purchase (§5) |
| `AgentWallet.setCapPerMatch` | funding script, admin | setup, and resetting the overspend demo |
| `AgentWallet.withdraw` | admin | sweeping burners after the hackathon |
| `AgentWallet.remainingForMatch` | referee | fills `wallet.remaining` in every `/move` request |
| `AgentWallet.balance` | web | wallet ledger panel |
| `MatchEscrow.createMatch` | referee, on `POST /api/matches` | match setup |
| `MatchEscrow.stake` | each bot EOA | match setup |
| `MatchEscrow.settle` | referee (or anyone with the signature) | at `match.finished` |
| `MatchEscrow.cancel` | ops only | a bot never staked — not on the demo path |
| `MatchEscrow.getMatch` | web, referee | status panel |
| `BetPool.openPool` | referee, same call as `createMatch` | match setup |
| `BetPool.placeBet` | spectator wallet in web | during play, until ply 20 |
| `BetPool.closePool` | referee at ply 20 | D5 |
| `BetPool.resolve` | referee (or anyone with the signature) | after `settle` |
| `BetPool.claim` | spectator wallet in web | after resolve |
| `BetPool.poolTotals` / `previewPayout` | web | live odds, claimable amount |

**Event coverage.** Every panel and the Friday QuickNode stream are fed by the events in §1:
odds from `BetPlaced`, the ledger from `Paid`, the leaderboard from `Settled`, match state from
`MatchCreated` / `Staked` / `MatchFunded`, claims from `Claimed`. Two gaps are deliberate:

- `wallet.refused` is **not** an event (a revert emits nothing) — WebSocket only, see §4.
- `AgentWallet` is one contract **per bot**, so a QuickNode stream filtering on `Paid` must list
  all four addresses from `shared/deployments.json`. A factory emitting one shared event would be
  tidier; not worth the lines this week.

---

## 2. Signed match result

EIP-712. The **domain omits `verifyingContract`** so that one signature verifies in both
`MatchEscrow` and `BetPool` — signing twice would allow the two contracts to be settled with
mismatched results. Dropping it from the domain would also drop the binding between a signature
and a contract, so **the struct carries the two addresses instead (D4)**:

```
domain = { name: "BotBet", version: "1", chainId: <ARC_CHAIN_ID> }

MatchResult(bytes32 matchId,uint8 outcome,address winner,address escrow,address betPool,uint16 moveCount,bytes32 pgnHash,uint64 finishedAt)
```

Verification, in both contracts:

1. `result.matchId == matchId` else `ResultMismatch`.
2. **`result.escrow == address(this)`** in `MatchEscrow`, **`result.betPool == address(this)`** in
   `BetPool`, else `WrongContract`. This is what ties a signature to this deployment.
3. `ECDSA.recover(_hashTypedDataV4(structHash), signature) == referee` else `InvalidSignature`.
4. Status check (`Funded` / `Closed`) else `WrongStatus` / `PoolNotClosed`.

So a signature is now bound three ways: to the chain (domain `chainId`), to the two contract
instances (step 2), and to one match (step 1) that each contract can only settle once (step 4).
Re-submitting the same signature reverts on status.

The referee reads both addresses from `shared/deployments.json` when it signs. If the contracts are
redeployed, old signatures stop verifying — which is the point.

Wire format (referee → frontend, scripts, anyone):

```json
{
  "matchId": "0x8f1c…",
  "outcome": 1,
  "winner": "0xBotB…",
  "escrow": "0xEscrow…",
  "betPool": "0xPool…",
  "moveCount": 57,
  "pgnHash": "0x44ab…",
  "finishedAt": 1763600000,
  "signature": "0x…65 bytes…",
  "pgn": "1. e4 e5 2. Nf3 …",
  "signer": "0xReferee…"
}
```

`pgn` is carried alongside, not signed; `pgnHash` is what binds it.

---

## 3. Bot move API (referee → bot)

Each bot is an HTTP server. Base URL per bot in `bots/` config; the referee holds the roster.

### `GET /info`

```json
{ "name": "Gambit Greg", "personality": "big spender", "address": "0xBotA…", "wallet": "0xWalletA…", "version": "1" }
```

### `GET /health` → `200 {"ok": true}`

### `POST /move`

Request:

```json
{
  "matchId": "0x8f1c…",
  "ply": 17,
  "moveNumber": 9,
  "sideToMove": "w",
  "fen": "r1bqkb1r/… w KQkq - 0 9",
  "pgn": "1. e4 e5 …",
  "legalMoves": ["e2e4", "g1f3"],
  "timeLimitMs": 3000,
  "faults": 0,
  "wallet": { "address": "0xWalletA…", "capPerMatch": "5000000", "spentThisMatch": "1500000", "remaining": "3500000" },
  "intel": { "available": true, "priceUsdc": "500000", "payTo": "0xReferee…", "purchasesLeft": 2 },
  "intelResult": null
}
```

Response — one of two shapes, discriminated by `type`:

```json
{ "type": "move", "move": "e2e4", "comment": "optional, <= 120 chars" }
```

```json
{ "type": "intel_request" }
```

Rules:

- Moves are **UCI long algebraic**: `e2e4`, `e7e8q`. Not SAN.
- `timeLimitMs` is 3000. The referee allows a 500 ms grace, so it aborts the request at 3500 ms.
- Illegal move, malformed body, non-200, or timeout → the referee plays a **random legal move**,
  increments `faults` for that bot, and emits `bot.fault`. **3 faults forfeits the match.**
- 80 full moves (160 plies) with no result → adjudicated `Draw`.
- `intel_request` pauses the move clock for up to `intelWindowMs` (15000 ms) — an on-chain payment
  cannot complete inside 3 seconds. The referee then re-sends `POST /move` for the same ply with
  `intelResult` filled in (or `null` plus a `faults` bump if the purchase never landed).
- **At most one `intel_request` per ply (D3).** A second one for the same ply is answered with
  `intel: { "available": false, "reason": "ALREADY_REQUESTED_THIS_PLY" }`, and replying
  `intel_request` again counts as a fault. Without this a bot can stall the game indefinitely.
  Maximum **3** intel purchases per bot per match overall; `intel.available` goes false after that.
- Person B's bot tests must cover the `intel_request` round trip, not just `move`: a bot that
  never requests, one that requests and pays, and one that requests twice in a ply and is faulted.
- A bot whose `pay()` reverted on the cap replies with
  `{ "type": "move", "move": "…", "comment": "refused: over cap" }` and the referee emits
  `wallet.refused` from the revert it observes.

---

## 4. Referee API (frontend → referee)

Base URL `http://localhost:${REFEREE_PORT}` (8080). All JSON. No auth in v1 except the admin token
on write routes: `Authorization: Bearer $ADMIN_TOKEN` on `POST /api/matches` (D9). The bot-only
routes (`/api/intel`, `/api/intel/quote`) are authenticated by the payment itself, not a token.

| Method | Route | Purpose |
|---|---|---|
| `GET` | `/api/health` | `{ ok, chainId, refereeAddress, deployments }` |
| `GET` | `/api/bots` | roster: name, personality, address, wallet, cap, record |
| `GET` | `/api/matches` | recent matches, newest first |
| `GET` | `/api/matches/:matchId` | full state: status, fen, moves[], evals[], intel[], pot, pool totals |
| `GET` | `/api/matches/:matchId/pgn` | `text/plain` PGN |
| `GET` | `/api/leaderboard` | `[{ rank, bot, wins, losses, draws, netUsdc, intelSpentUsdc }]` |
| `POST` | `/api/matches` | start one: `{ botA, botB, stakeUsdc, startFen? }` → `{ matchId }` |
| `POST` | `/api/intel` | bots only — see §5 |
| `GET` | `/api/intel/quote` | bots only — `?matchId=&bot=` → quote |
| `POST` | `/api/webhooks/quicknode` | QuickNode Stream target (Friday) |

### WebSocket

`ws://localhost:${REFEREE_PORT}/ws`. Every frame shares one envelope:

```json
{ "type": "move.played", "matchId": "0x8f1c…", "seq": 42, "ts": 1763600000123, "data": { } }
```

`seq` is a per-connection monotonic counter. Client sends `{"type":"subscribe","matchId":"0x…"}`
(or `"all"`) and may reconnect with `{"type":"subscribe","matchId":"0x…","since":41}` to replay
missed frames from an in-memory ring buffer of the last 500. Heartbeat `{"type":"ping"}` every 20 s.

| `type` | `data` |
|---|---|
| `match.created` | `{ botA, botB, stakeUsdc, poolCloseTime }` |
| `match.staked` | `{ bot, amountUsdc, txHash, bothStaked }` |
| `match.started` | `{ startFen, startedAt }` |
| `move.played` | `{ ply, uci, san, fen, clockMsUsed, evalCp, mateIn }` |
| `eval.update` | `{ ply, evalCp, mateIn, swingCp }` |
| `intel.purchased` | `{ bot, ply, priceUsdc, txHash, remainingCapUsdc }` |
| `wallet.refused` | `{ bot, attemptedUsdc, capUsdc, spentUsdc, reason }` |
| `bet.placed` | `{ bettor, outcome, amountUsdc, totals, txHash }` |
| `odds.updated` | `{ totals, impliedOdds }` |
| `pool.closed` | `{ ply, totals }` — the betting panel must disable itself here (D5) |
| `bet.claimed` | `{ bettor, amountUsdc, txHash }` |
| `bot.fault` | `{ bot, ply, reason, faults }` |
| `match.finished` | the §2 wire format |
| `payout.settled` | `{ winner, payoutUsdc, txHash }` |
| `leaderboard.updated` | the `/api/leaderboard` body |
| `commentary.line` | `{ text, audioUrl, trigger }` |

Mock providers in `web/` must emit exactly these, so swapping to the real socket is one config change.

**`wallet.refused` has no on-chain source.** A revert emits no event, so neither QuickNode nor an
indexer can see a refused payment. The referee is the only witness — it learns from the bot's reply
or from simulating the call — so the frontend must take that event from the WebSocket, never from
the chain. Everything else in this table also exists as an on-chain event (§1), which is what the
Friday QuickNode stream subscribes to.

---

## 5. Paid intel ("x402-style")

1. **Quote.** Bot calls `GET /api/intel/quote?matchId=0x…&bot=0xBotA…` →
   ```json
   { "matchId": "0x8f1c…", "ply": 17, "priceUsdc": "500000", "payTo": "0xReferee…", "expiresAt": 1763600060 }
   ```
2. **Pay.** Bot's EOA calls `AgentWallet.pay(payTo, price, matchId)`. Over the cap → the call
   reverts with `SpendingCapExceeded` and the bot moves on without intel.
3. **Claim.** Bot calls `POST /api/intel`:
   ```json
   { "matchId": "0x8f1c…", "ply": 17, "bot": "0xBotA…", "wallet": "0xWalletA…", "txHash": "0x…" }
   ```
4. **Verify.** The referee, before returning anything, checks all of:
   - receipt exists and `status == 1`, with at least `INTEL_MIN_CONFIRMATIONS` (default 1);
   - `tx.to == wallet`, and that wallet is the one registered for `bot`;
   - the receipt contains a `Paid(matchId, to, amount, spentAfter)` log from that wallet with
     `to == REFEREE_ADDRESS`, the **same `matchId`**, and `amount >= priceUsdc`;
   - `txHash` has never been accepted before (persisted set);
   - the quote has not expired.
5. **Deliver.**
   ```json
   { "evalCp": -45, "mateIn": null, "bestMove": "d2d4", "pv": ["d2d4", "g8f6"], "depth": 18, "ply": 17 }
   ```

Failures are HTTP + a stable `code`:

| Status | `code` | When |
|---|---|---|
| 402 | `UNDERPAID` | amount below the quote |
| 402 | `NO_PAYMENT_LOG` | receipt has no matching `Paid` event |
| 403 | `WRONG_RECIPIENT` | paid someone other than the referee |
| 404 | `TX_NOT_FOUND` | not mined yet — the bot may retry within the intel window |
| 409 | `TX_ALREADY_USED` | replayed `txHash` |
| 410 | `QUOTE_EXPIRED` | past `expiresAt` |
| 422 | `MATCH_MISMATCH` | `Paid.matchId` != requested match |

Required tests (Person B): a **reused hash** and an **underpaid receipt**, both rejected.

---

## 6. shared/deployments.json

Written by the Foundry deploy script, committed, read by referee, bots and web.

```json
{
  "chainId": 0,
  "network": "arc-testnet",
  "deployedAt": "2026-11-19T00:00:00Z",
  "usdc": "0x…",
  "referee": "0xReferee…",
  "contracts": {
    "MatchEscrow": { "address": "0x…", "abi": [] },
    "BetPool":     { "address": "0x…", "abi": [] }
  },
  "agentWallets": {
    "0xBotA…": { "address": "0x…", "capPerMatch": "5000000" }
  },
  "agentWalletAbi": []
}
```

---

## Ask the organizers tonight

These block Person A's deploy and cannot be answered from inside the repo. Send them Wednesday
evening, not Thursday morning.

1. **Arc testnet basics** — RPC URL, chain ID, the ERC-20 USDC address, and the faucet.
2. **Faucet limits** — enough testnet USDC for 4 bot EOAs, 4 agent wallets and a few spectator
   wallets? If it is rate-limited per address, we need to know tonight.
3. **Does Arc's USDC implement `permit` (EIP-2612)?** With it, staking and betting lose an approve
   round-trip, which is a visibly faster demo. Without it, the UI needs an explicit two-step
   approve → bet, and Person C should build that from the start.
4. **Block time and finality** — how many confirmations before an intel payment is safe to honour?
   Drafted as 1, which is a guess until they answer.
5. **Grok Bot MCP access** (from `docs/plan.md`) — confirmed or not by Thursday noon? If not, it is
   dropped, and nobody should start on it.

## Still open

| # | Question | Owner | Blocks |
|---|---|---|---|
| Q1 | **Protocol fee.** `feeBps = 0` and no escrow rake, as drafted. If the pitch wants a fee, it changes the payout maths and the tests. | whoever writes the pitch | Person A, Thursday morning |
| Q2 | **Are bots HTTP servers or in-process modules?** HTTP as drafted, which leaves the door open to outside bots; in-process is faster to build and removes four ports from the demo. | Person B | Person B only |
| Q3 | **Leaderboard source of truth** — referee memory seeded with fake history, or rebuilt from chain events via the QuickNode stream? Decides whether Friday's stream work is additive or a rewrite. | B + C | Friday, not Thursday |
| Q4 | **Stake size and intel price for the demo.** Needs to make the pot and the odds legible on a projector, and the cap refusal has to be reachable within one match. | everyone, at the Thursday checkpoint | the demo script |

Nothing else in this document is open. If you want to change something that is not on this list,
change it here first and tell the other two.
