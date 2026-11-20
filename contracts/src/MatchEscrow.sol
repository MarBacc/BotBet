// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

enum Status {
    None,
    Open,
    Funded,
    Settled
}

/// @dev stakeAmount is per bot, in 6-decimal USDC base units.
struct Match {
    address botA;
    address botB;
    uint256 stakeAmount;
    bool stakedA;
    bool stakedB;
    Status status;
}

/// @dev The referee-signed outcome. The PGN itself travels beside the signature, unsigned.
struct MatchResult {
    bytes32 matchId;
    address winner;
    uint16 moveCount;
    bytes32 pgnHash;
    uint64 finishedAt;
}

/// @title MatchEscrow
/// @notice Two bots stake equal USDC; the winner takes the pot against a referee-signed result.
///         `settle` is authorised by the signature, not the caller, so a crashed referee
///         strands nothing.
contract MatchEscrow is EIP712, ReentrancyGuard {
    using SafeERC20 for IERC20;

    bytes32 private constant MATCH_RESULT_TYPEHASH =
        keccak256("MatchResult(bytes32 matchId,address winner,uint16 moveCount,bytes32 pgnHash,uint64 finishedAt)");

    address public immutable referee;
    address public immutable admin;
    IERC20 public immutable usdc;

    mapping(bytes32 => Match) public matches;

    event MatchCreated(bytes32 indexed matchId, address indexed botA, address indexed botB, uint256 stakeAmount);
    event Staked(bytes32 indexed matchId, address indexed bot, uint256 amount);
    event MatchFunded(bytes32 indexed matchId, uint256 pot);
    event Settled(bytes32 indexed matchId, address indexed winner, uint256 payout);

    error NotAdmin();
    error MatchExists();
    error MatchNotFound();
    error NotParticipant();
    error AlreadyStaked();
    error WrongStatus(uint8 expected, uint8 actual);
    error InvalidWinner();
    error ResultMismatch();
    error InvalidSignature();
    error InvalidMatch();

    constructor(address referee_, address usdc_) EIP712("BotBet", "1") {
        if (referee_ == address(0) || usdc_ == address(0)) revert InvalidMatch();
        referee = referee_;
        admin = msg.sender;
        usdc = IERC20(usdc_);
    }

    /// @notice Admin opens a match; `matchId` is 32 random bytes from the referee.
    function createMatch(bytes32 matchId, address botA, address botB, uint256 stakeAmount) external {
        if (msg.sender != admin) revert NotAdmin();
        if (matches[matchId].status != Status.None) revert MatchExists();
        if (botA == address(0) || botB == address(0) || botA == botB || stakeAmount == 0) revert InvalidMatch();

        matches[matchId] = Match({
            botA: botA, botB: botB, stakeAmount: stakeAmount, stakedA: false, stakedB: false, status: Status.Open
        });

        emit MatchCreated(matchId, botA, botB, stakeAmount);
    }

    /// @notice A participant posts its stake; the escrow must already be approved for it.
    function stake(bytes32 matchId) external nonReentrant {
        Match storage m = matches[matchId];
        if (m.status == Status.None) revert MatchNotFound();
        if (m.status != Status.Open) revert WrongStatus(uint8(Status.Open), uint8(m.status));
        if (msg.sender != m.botA && msg.sender != m.botB) revert NotParticipant();

        if (msg.sender == m.botA) {
            if (m.stakedA) revert AlreadyStaked();
            m.stakedA = true;
        } else {
            if (m.stakedB) revert AlreadyStaked();
            m.stakedB = true;
        }

        uint256 amount = m.stakeAmount;
        // Pull the stake before flipping to Funded: until the money is actually here, the
        // match must not claim a pot, or a settle could pay it out of another match's funds.
        usdc.safeTransferFrom(msg.sender, address(this), amount);
        emit Staked(matchId, msg.sender, amount);

        if (m.stakedA && m.stakedB) {
            m.status = Status.Funded;
            emit MatchFunded(matchId, amount * 2);
        }
    }

    /// @notice Pay the whole pot to the signed winner. Anyone may call it with a valid signature.
    function settle(bytes32 matchId, MatchResult calldata result, bytes calldata signature) external nonReentrant {
        Match storage m = matches[matchId];
        if (m.status == Status.None) revert MatchNotFound();
        if (m.status != Status.Funded) revert WrongStatus(uint8(Status.Funded), uint8(m.status));
        if (result.matchId != matchId) revert ResultMismatch();
        if (result.winner != m.botA && result.winner != m.botB) revert InvalidWinner();

        bytes32 structHash = keccak256(
            abi.encode(
                MATCH_RESULT_TYPEHASH,
                result.matchId,
                result.winner,
                result.moveCount,
                result.pgnHash,
                result.finishedAt
            )
        );
        (address signer, ECDSA.RecoverError err,) = ECDSA.tryRecover(_hashTypedDataV4(structHash), signature);
        if (err != ECDSA.RecoverError.NoError || signer != referee) revert InvalidSignature();

        // Settled before the transfer: the replay guard, so one signature never pays twice.
        m.status = Status.Settled;

        uint256 payout = m.stakeAmount * 2;
        emit Settled(matchId, result.winner, payout);
        usdc.safeTransfer(result.winner, payout);
    }

    function getMatch(bytes32 matchId) external view returns (Match memory) {
        return matches[matchId];
    }
}
