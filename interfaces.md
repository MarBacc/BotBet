# interfaces.md

The spec for the solo 10-hour build; change it before the code, not after. Everything cut is in
`docs/roadmap.md`, intact; chain facts in `docs/arc.md`.

**Scope: stake, play, settle, payout from a script, then one page showing it, narrated.** No
draws, timeouts, refunds or fees — depth 12 vs depth 4 is decisive, so a draw is a bug. §5 is the
ElevenLabs bounty and only gets built once the loop works.

## 0. Money

- **ERC-20 USDC at `0x3600000000000000000000000000000000000000`, 6 decimals.** Arc exposes the
  *same balance* natively at 18 decimals; never touch it. Gas comes out of it, so fund above stake.
- Every amount is an integer of base units (`1 USDC = 1000000`); in JSON a **decimal string**.
- **One place converts:** `shared/src/money.ts` as `botbet-shared`, imported `file:../shared`
  (`toBaseUnits`, `fromBaseUnits`, `formatUsdc`, `parseBaseUnits`). `shared/dist/` is gitignored,
  so build `shared/` first. Banned everywhere: `parseEther`, `1e18`, `parseUnits(x, 18)`.

## 1. MatchEscrow

The only contract. Both bots stake the same amount from their EOAs (each `approve`s the escrow
first); the winner takes the pot against a referee-signed result. OpenZeppelin `SafeERC20`,
`EIP712`, `ECDSA`, `ReentrancyGuard`; under ~150 lines.

```solidity
enum Status { None, Open, Funded, Settled }

// stakeAmount is per bot, in 6-decimal base units
struct Match { address botA; address botB; uint256 stakeAmount; bool stakedA; bool stakedB; Status status; }

contract MatchEscrow is EIP712, ReentrancyGuard {
    // 1,000,000 USDC. A stake above it is an 18-decimal amount, i.e. the decimals trap.
    uint256 public constant MAX_STAKE = 1_000_000_000_000;
    address public immutable referee;   // signs results
    address public immutable admin;     // deployer; creates matches
    IERC20  public immutable usdc;
    mapping(bytes32 => Match) public matches;

    constructor(address referee_, address usdc_);                 // EIP712("BotBet", "1")
    function createMatch(bytes32 matchId, address botA, address botB, uint256 stakeAmount) external;
    function stake(bytes32 matchId) external;                     // nonReentrant; botA or botB
    function settle(bytes32 matchId, MatchResult calldata result, bytes calldata signature) external; // nonReentrant
    function getMatch(bytes32 matchId) external view returns (Match memory);
    event MatchCreated(bytes32 indexed matchId, address indexed botA, address indexed botB, uint256 stakeAmount);
    event Staked(bytes32 indexed matchId, address indexed bot, uint256 amount);
    event MatchFunded(bytes32 indexed matchId, uint256 pot);
    event Settled(bytes32 indexed matchId, address indexed winner, uint256 payout);
    error NotAdmin(); error MatchExists(); error MatchNotFound();
    error NotParticipant(); error AlreadyStaked(); error WrongStatus(uint8 expected, uint8 actual);
    error InvalidWinner();      // winner is not botA or botB
    error ResultMismatch();     // result.matchId != matchId
    error InvalidSignature();   // recovered signer != referee
    error InvalidMatch();       // zero or equal bots, or a stake of zero or above MAX_STAKE
}
```

Payout is the whole pot, `2 * stakeAmount`, to `result.winner`; `matchId` is 32 random bytes from
the referee. `createMatch` is admin-only, `stake` participants-only, while `settle` takes its
authorisation from the signature rather than the caller, so a crashed referee strands nothing.

## 2. The signed result

EIP-712 with the standard domain — `verifyingContract` binds a signature to this deployment, so
no contract address is carried in the struct.

```
domain = { name: "BotBet", version: "1", chainId: 5042002, verifyingContract: <MatchEscrow> }
MatchResult(bytes32 matchId,address winner,uint16 moveCount,bytes32 pgnHash,uint64 finishedAt)

struct MatchResult { bytes32 matchId; address winner; uint16 moveCount; bytes32 pgnHash; uint64 finishedAt; }
```

`winner` is never zero; `pgnHash` is `keccak256(bytes(pgn))` and the PGN travels beside the
signature, unsigned. **`moveCount` is plies (half-moves), not full moves** — the same unit as
`atPly` in section 5, so the page replays and the signed count never drift apart. The escrow
never reads the value, it only hashes it, so the single requirement is that the referee and
anyone verifying agree on the unit; 160 plies is the most the move cap allows, well inside
`uint16`. `settle` verifies in order:

1. `status == Funded`, else `WrongStatus`. It flips to `Settled` **before** the transfer — this
   is the replay guard, so one signature can never pay twice.
2. `result.matchId == matchId` (`ResultMismatch`), and `result.winner` is `botA` or `botB`
   (`InvalidWinner`).
3. `ECDSA.recover(_hashTypedDataV4(structHash), signature) == referee`, else `InvalidSignature`.
   A signature is thus bound to the chain, to this contract, and to one match, settleable once.

**Foundry tests — these eight, nothing else:** both stake and the winner is paid; a bad signature,
a replayed result, and a signature made for a *different contract address* each revert; `settle`
before both bots staked reverts; a stranger without a valid signature cannot settle; a token
that re-enters `stake` cannot settle the match it is still funding; and a stake above `MAX_STAKE`
is refused.

`stake` pulls the USDC *before* flipping the match to `Funded`, and both `stake` and `settle` are
`nonReentrant`: the escrow pools every match's funds in one balance, so a match that claims a pot
it does not yet hold could be settled out of another match's money.

## 3. The referee flow

Node scripts, not a server: no HTTP, no WebSocket.

**`npm run play-game`** — one game offline: `chess.js` for rules, Stockfish at the two depths in
`referee/src/bots.ts`, 3 s per move, 80-move cap (80 *full* moves, so at most 160 plies; the cap
is the one count kept in full moves). Prints the PGN and the signed `MatchResult`;
touches no chain.

**`npm run settle`** — the whole loop, printing each step with its tx hash: read
`shared/deployments.json` → `createMatch` → each bot `approve` then `stake` → play → sign with
`REFEREE_PRIVATE_KEY` → `settle` → print both balances before and after → write
`web/public/result.json`:

```json
{ "matchId": "0x8f1c…", "stakeUsdc": "2000000", "potUsdc": "4000000",
  "bots": [{ "id": "deep", "name": "Deep Thought", "address": "0x…", "depth": 12 },
           { "id": "hasty", "name": "Hasty Hal", "address": "0x…", "depth": 4 }],
  "winner": "0x…", "moveCount": 57, "pgn": "1. e4 e5 …",
  // moveCount is plies: 57 half-moves, i.e. 29 full moves
  "settleTxHash": "0x…", "explorerUrl": "https://explorer.testnet.arc.io/tx/0x…", "finishedAt": 1763600000 }
```

The page reads exactly this: replayed board from `pgn`, both stakes, the winner, a link to
`explorerUrl`.

## 4. shared/deployments.json

Written by the deploy script, committed, read by the referee and the page.
```json
{ "chainId": 5042002, "network": "arc-testnet",
  "usdc": "0x3600000000000000000000000000000000000000", "referee": "0x…",
  "contracts": { "MatchEscrow": { "address": "0x…", "abi": [] } } }
```

## 5. Commentary — the ElevenLabs bounty (hour 7.5)

The bounty needs audio to be **a core feature, not an add-on**, and the demo video must show it
playing. So the page is narrated, not decorated.

After `settle` writes `result.json`, `npm run commentary` generates 4–6 lines from facts already
in that file — stakes posted, the first decisive swing, the winning move, the payout — voices
each with the **ElevenLabs Text to Speech API**
(`POST https://api.elevenlabs.io/v1/text-to-speech/{voice_id}`, `ELEVENLABS_API_KEY`,
`ELEVENLABS_VOICE_ID`), writes `web/public/audio/<n>.mp3`, and appends to `result.json`:

```json
"commentary": [
  { "atPly": 0,  "text": "Two agents, four USDC on the table…", "audio": "audio/0.mp3" },
  { "atPly": 41, "text": "Hasty Hal hangs the queen.",          "audio": "audio/41.mp3" }
]
```

The page plays each clip when the replay reaches `atPly`. **Generated ahead of time, never
live** — no API call is on the demo's critical path, and a missing file just means silence.
Line text is templated from the result; an LLM may improve it later, never block on it.

## Still open

**Does Arc's USDC implement EIP-2612 `permit`?** Not stated in the docs, so the flow uses a plain
`approve` before each `stake`. Permit2 is at `0x000000000022D473030F116dDEE9F6B43aC78BA3` if that
round-trip ever hurts.
