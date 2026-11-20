// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {MatchEscrow, MatchResult} from "../../src/MatchEscrow.sol";

/// @dev A USDC that hands control back mid-transfer, the way a hook-enabled token would.
///      While the escrow is pulling a stake it calls `settle` on the match being funded.
contract ReenteringUSDC is ERC20 {
    MatchEscrow public escrow;
    bytes32 public matchId;
    MatchResult public result;
    bytes public signature;

    bool public attackAttempted;
    bool public attackReverted;
    bytes public attackRevertData;

    constructor() ERC20("USD Coin", "USDC") {}

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function arm(MatchEscrow escrow_, bytes32 matchId_, MatchResult calldata result_, bytes calldata signature_)
        external
    {
        escrow = escrow_;
        matchId = matchId_;
        result = result_;
        signature = signature_;
    }

    function transferFrom(address from, address to, uint256 value) public override returns (bool) {
        if (address(escrow) != address(0) && !attackAttempted) {
            attackAttempted = true;
            try escrow.settle(matchId, result, signature) {
                attackReverted = false;
            } catch (bytes memory reason) {
                attackReverted = true;
                attackRevertData = reason;
            }
        }
        return super.transferFrom(from, to, value);
    }
}
