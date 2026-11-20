// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {AgentWallet} from "../src/AgentWallet.sol";
import {MockUSDC} from "./mocks/MockUSDC.sol";

contract AgentWalletTest is Test {
    uint256 private constant CAP = 50_000;
    uint256 private constant STARTING_BALANCE = 1_000_000;
    bytes32 private constant MEMO = keccak256("intel purchase");

    MockUSDC private usdc;
    AgentWallet private wallet;
    address private owner = makeAddr("owner");
    address private recipient = makeAddr("recipient");

    function setUp() public {
        usdc = new MockUSDC();
        wallet = new AgentWallet(address(usdc), owner, CAP);
        usdc.mint(address(wallet), STARTING_BALANCE);
    }

    function test_RevertWhen_OwnerIsZeroAddress() public {
        vm.expectRevert(AgentWallet.ZeroAddress.selector);
        new AgentWallet(address(usdc), address(0), CAP);
    }

    function test_PayUnderCapTransfersAndEmitsPaid() public {
        uint256 amount = CAP - 1;
        vm.expectEmit(true, false, false, true, address(wallet));
        emit AgentWallet.Paid(recipient, amount, MEMO);

        vm.prank(owner);
        wallet.pay(recipient, amount, MEMO);

        assertEq(usdc.balanceOf(recipient), amount);
        assertEq(wallet.balance(), STARTING_BALANCE - amount);
    }

    function test_PayAtCapTransfers() public {
        vm.prank(owner);
        wallet.pay(recipient, CAP, MEMO);

        assertEq(usdc.balanceOf(recipient), CAP);
        assertEq(wallet.balance(), STARTING_BALANCE - CAP);
    }

    function test_RevertWhen_PaymentExceedsCap() public {
        uint256 amount = CAP + 1;
        vm.expectRevert(abi.encodeWithSelector(AgentWallet.CapExceeded.selector, amount, CAP));
        vm.prank(owner);
        wallet.pay(recipient, amount, MEMO);

        assertEq(usdc.balanceOf(recipient), 0);
        assertEq(wallet.balance(), STARTING_BALANCE);
    }

    function test_RevertWhen_CallerIsNotOwner() public {
        vm.expectRevert(AgentWallet.NotOwner.selector);
        vm.prank(recipient);
        wallet.pay(recipient, CAP, MEMO);
    }

    function test_RevertWhen_RecipientIsZeroAddress() public {
        vm.expectRevert(AgentWallet.ZeroAddress.selector);
        vm.prank(owner);
        wallet.pay(address(0), CAP, MEMO);
    }
}
