// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @title AgentWallet
/// @notice Holds USDC and lets the owner make payments up to an immutable per-payment cap.
contract AgentWallet {
    using SafeERC20 for IERC20;

    /// @notice The token this wallet holds and pays.
    IERC20 public immutable usdc;
    /// @notice The account authorized to make payments.
    address public immutable owner;
    /// @notice The largest payment allowed, in USDC base units.
    uint256 public immutable maxPerTx;

    error NotOwner();
    error CapExceeded(uint256 amount, uint256 cap);
    error ZeroAddress();

    /// @notice Records a successful payment and its caller-supplied memo.
    event Paid(address indexed to, uint256 amount, bytes32 memo);

    /// @param usdc_ The USDC token contract.
    /// @param owner_ The nonzero account authorized to make payments.
    /// @param maxPerTx_ The per-payment cap in USDC base units.
    constructor(address usdc_, address owner_, uint256 maxPerTx_) {
        if (owner_ == address(0)) revert ZeroAddress();

        usdc = IERC20(usdc_);
        owner = owner_;
        maxPerTx = maxPerTx_;
    }

    /// @notice Pays a recipient if the caller owns the wallet and the amount is within the cap.
    /// @param to The recipient of the USDC.
    /// @param amount The payment amount in USDC base units.
    /// @param memo A caller-supplied reference recorded with the payment.
    function pay(address to, uint256 amount, bytes32 memo) external {
        if (msg.sender != owner) revert NotOwner();
        if (amount > maxPerTx) revert CapExceeded(amount, maxPerTx);
        if (to == address(0)) revert ZeroAddress();

        usdc.safeTransfer(to, amount);
        emit Paid(to, amount, memo);
    }

    /// @notice Returns this wallet's USDC balance in base units.
    function balance() external view returns (uint256) {
        return usdc.balanceOf(address(this));
    }
}
