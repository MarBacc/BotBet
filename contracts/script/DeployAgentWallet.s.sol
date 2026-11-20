// SPDX-License-Identifier: MIT
// A later demo script will write web/public/cap-demo.json with this shape:
// {"wallet":"0x...","capUsdc":0.05,"allowed":{"amount":0.04,"txHash":"0x..."},"refused":{"amount":0.06,"reason":"CapExceeded"}}
pragma solidity 0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {AgentWallet} from "../src/AgentWallet.sol";

/// @notice Prepares an AgentWallet deployment with a 0.05 USDC per-payment cap.
contract DeployAgentWallet is Script {
    address private constant ARC_USDC = 0x3600000000000000000000000000000000000000;
    uint256 private constant CAP = 50_000;

    function run() external returns (AgentWallet wallet) {
        address usdc = vm.envOr("USDC_ADDRESS", ARC_USDC);
        address owner = vm.envAddress("AGENT_WALLET_OWNER");

        vm.broadcast();
        wallet = new AgentWallet(usdc, owner, CAP);

        console2.log("AgentWallet", address(wallet));
    }
}
