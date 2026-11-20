// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {MatchEscrow, Match, MatchResult, Status} from "../src/MatchEscrow.sol";
import {MockUSDC} from "./mocks/MockUSDC.sol";

contract MatchEscrowTest is Test {
    bytes32 private constant MATCH_RESULT_TYPEHASH =
        keccak256("MatchResult(bytes32 matchId,address winner,uint16 moveCount,bytes32 pgnHash,uint64 finishedAt)");
    bytes32 private constant DOMAIN_TYPEHASH =
        keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)");

    /// @dev 6-decimal base units: 2 USDC per bot, a 4 USDC pot.
    uint256 private constant STAKE = 2_000_000;
    bytes32 private constant MATCH_ID = bytes32(uint256(0x8f1c));

    MockUSDC private usdc;
    MatchEscrow private escrow;

    address private admin = makeAddr("admin");
    address private stranger = makeAddr("stranger");
    address private botA;
    address private botB;
    address private referee;
    uint256 private refereePk;
    uint256 private strangerPk;

    function setUp() public {
        (referee, refereePk) = makeAddrAndKey("referee");
        (, strangerPk) = makeAddrAndKey("impostor");
        botA = makeAddr("deep");
        botB = makeAddr("hasty");

        usdc = new MockUSDC();
        vm.prank(admin);
        escrow = new MatchEscrow(referee, address(usdc));

        usdc.mint(botA, STAKE);
        usdc.mint(botB, STAKE);
        vm.prank(botA);
        usdc.approve(address(escrow), STAKE);
        vm.prank(botB);
        usdc.approve(address(escrow), STAKE);

        vm.prank(admin);
        escrow.createMatch(MATCH_ID, botA, botB, STAKE);
    }

    // --- the six ---

    function test_BothStakeAndWinnerIsPaid() public {
        _bothStake();

        Match memory m = escrow.getMatch(MATCH_ID);
        assertEq(uint8(m.status), uint8(Status.Funded), "funded once both staked");
        assertEq(usdc.balanceOf(address(escrow)), STAKE * 2, "pot held by the escrow");
        assertEq(usdc.balanceOf(botA), 0);
        assertEq(usdc.balanceOf(botB), 0);

        MatchResult memory result = _result(botA);
        escrow.settle(MATCH_ID, result, _sign(refereePk, address(escrow), result));

        assertEq(usdc.balanceOf(botA), STAKE * 2, "winner takes the whole pot");
        assertEq(usdc.balanceOf(botB), 0, "loser gets nothing");
        assertEq(usdc.balanceOf(address(escrow)), 0, "escrow holds nothing after settling");
        assertEq(uint8(escrow.getMatch(MATCH_ID).status), uint8(Status.Settled));
    }

    function test_RevertWhen_SignatureIsNotTheReferees() public {
        _bothStake();
        MatchResult memory result = _result(botA);

        vm.expectRevert(MatchEscrow.InvalidSignature.selector);
        escrow.settle(MATCH_ID, result, _sign(strangerPk, address(escrow), result));

        assertEq(usdc.balanceOf(address(escrow)), STAKE * 2, "pot untouched");
    }

    /// @dev The replay guard: a valid signature settles once and can never pay twice.
    function test_RevertWhen_ResultIsReplayed() public {
        _bothStake();
        MatchResult memory result = _result(botA);
        bytes memory signature = _sign(refereePk, address(escrow), result);

        escrow.settle(MATCH_ID, result, signature);
        assertEq(usdc.balanceOf(botA), STAKE * 2);

        vm.expectRevert(
            abi.encodeWithSelector(MatchEscrow.WrongStatus.selector, uint8(Status.Funded), uint8(Status.Settled))
        );
        escrow.settle(MATCH_ID, result, signature);

        assertEq(usdc.balanceOf(botA), STAKE * 2, "winner was paid exactly once");
    }

    function test_RevertWhen_SignedForAnotherContract() public {
        _bothStake();
        vm.prank(admin);
        MatchEscrow other = new MatchEscrow(referee, address(usdc));

        MatchResult memory result = _result(botA);
        // Same referee, same match, same fields — only the verifyingContract differs.
        vm.expectRevert(MatchEscrow.InvalidSignature.selector);
        escrow.settle(MATCH_ID, result, _sign(refereePk, address(other), result));

        assertEq(usdc.balanceOf(address(escrow)), STAKE * 2, "pot untouched");
    }

    function test_RevertWhen_SettlingBeforeBothStaked() public {
        vm.prank(botA);
        escrow.stake(MATCH_ID);

        MatchResult memory result = _result(botA);
        vm.expectRevert(
            abi.encodeWithSelector(MatchEscrow.WrongStatus.selector, uint8(Status.Funded), uint8(Status.Open))
        );
        escrow.settle(MATCH_ID, result, _sign(refereePk, address(escrow), result));

        assertEq(usdc.balanceOf(address(escrow)), STAKE, "only one stake is held");
    }

    function test_RevertWhen_StrangerSettlesWithoutAValidSignature() public {
        _bothStake();
        MatchResult memory result = _result(stranger);

        // A stranger cannot name themselves the winner...
        vm.prank(stranger);
        vm.expectRevert(MatchEscrow.InvalidWinner.selector);
        escrow.settle(MATCH_ID, result, _sign(strangerPk, address(escrow), result));

        // ...nor forge a result for a real participant.
        MatchResult memory forged = _result(botB);
        vm.prank(stranger);
        vm.expectRevert(MatchEscrow.InvalidSignature.selector);
        escrow.settle(MATCH_ID, forged, _sign(strangerPk, address(escrow), forged));

        assertEq(usdc.balanceOf(stranger), 0, "stranger is paid nothing");
        assertEq(usdc.balanceOf(address(escrow)), STAKE * 2, "pot untouched");
    }

    // --- helpers ---

    function _bothStake() private {
        vm.prank(botA);
        escrow.stake(MATCH_ID);
        vm.prank(botB);
        escrow.stake(MATCH_ID);
    }

    function _result(address winner) private view returns (MatchResult memory) {
        return MatchResult({
            matchId: MATCH_ID,
            winner: winner,
            moveCount: 57,
            pgnHash: keccak256(bytes("1. e4 e5 2. Nf3 Nc6")),
            finishedAt: uint64(block.timestamp)
        });
    }

    function _sign(uint256 pk, address verifyingContract, MatchResult memory result)
        private
        view
        returns (bytes memory)
    {
        bytes32 domainSeparator = keccak256(
            abi.encode(
                DOMAIN_TYPEHASH, keccak256(bytes("BotBet")), keccak256(bytes("1")), block.chainid, verifyingContract
            )
        );
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
        (uint8 v, bytes32 r, bytes32 s) =
            vm.sign(pk, keccak256(abi.encodePacked("\x19\x01", domainSeparator, structHash)));
        return abi.encodePacked(r, s, v);
    }
}
