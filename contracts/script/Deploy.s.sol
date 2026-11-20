// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {VmSafe} from "forge-std/Vm.sol";
import {MatchEscrow} from "../src/MatchEscrow.sol";

/// @notice Deploys MatchEscrow and writes shared/deployments.json (interfaces.md section 4).
///
/// Env comes from the repo root .env, which forge does not load by itself:
///     cd contracts && set -a && source ../.env && set +a
///     forge script script/Deploy.s.sol --rpc-url "$ARC_RPC_URL"               # dry run
///     forge script script/Deploy.s.sol --rpc-url "$ARC_RPC_URL" --broadcast   # for real
///
/// Only a real broadcast writes deployments.json, so a dry run cannot leave a
/// simulated address behind. Arc's minimum base fee is 20 Gwei and anything under it is
/// dropped silently — if a broadcast never appears on the explorer, check that first.
contract Deploy is Script {
    address internal constant ARC_USDC = 0x3600000000000000000000000000000000000000;
    uint256 internal constant ARC_TESTNET = 5042002;
    uint256 internal constant ARC_MAINNET = 5042;

    string internal constant ARTIFACT = "out/MatchEscrow.sol/MatchEscrow.json";
    string internal constant DEPLOYMENTS = "../shared/deployments.json";

    error RealMoney();

    function run() external returns (MatchEscrow escrow) {
        // Arc mainnet's gas token is real USDC. Testnet burners only.
        if (block.chainid == ARC_MAINNET) revert RealMoney();

        uint256 deployerPk = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address referee = vm.envAddress("REFEREE_ADDRESS");
        address usdc = vm.envOr("USDC_ADDRESS", ARC_USDC);

        console2.log("chain     ", _network(block.chainid), block.chainid);
        console2.log("deployer  ", vm.addr(deployerPk));
        console2.log("referee   ", referee);
        console2.log("usdc      ", usdc);

        vm.startBroadcast(deployerPk);
        escrow = new MatchEscrow(referee, usdc);
        vm.stopBroadcast();

        console2.log("MatchEscrow", address(escrow));

        if (!vm.isContext(VmSafe.ForgeContext.ScriptBroadcast)) {
            console2.log("dry run -- shared/deployments.json not written; add --broadcast");
            return escrow;
        }

        _writeDeployments(address(escrow), referee, usdc);
        console2.log("wrote     ", DEPLOYMENTS);
    }

    /// @dev The ABI goes in as a placeholder, then gets overwritten in place with the raw
    ///      array from the build artifact — serializers would escape it into a string.
    function _writeDeployments(address escrow, address referee, address usdc) internal {
        string memory escrowKey = "escrow";
        vm.serializeAddress(escrowKey, "address", escrow);
        string memory escrowJson = vm.serializeString(escrowKey, "abi", "");

        string memory contractsKey = "contracts";
        string memory contractsJson = vm.serializeString(contractsKey, "MatchEscrow", escrowJson);

        string memory rootKey = "root";
        vm.serializeUint(rootKey, "chainId", block.chainid);
        vm.serializeString(rootKey, "network", _network(block.chainid));
        vm.serializeAddress(rootKey, "usdc", usdc);
        vm.serializeAddress(rootKey, "referee", referee);
        string memory rootJson = vm.serializeString(rootKey, "contracts", contractsJson);

        vm.writeJson(rootJson, DEPLOYMENTS);
        vm.writeJson(_artifactAbi(), DEPLOYMENTS, ".contracts.MatchEscrow.abi");
    }

    function _network(uint256 chainId) internal pure returns (string memory) {
        if (chainId == ARC_TESTNET) return "arc-testnet";
        if (chainId == 31337) return "anvil";
        return "unknown";
    }

    /// @dev Slice the `"abi": [ ... ]` array out of the Foundry artifact. Bracket counting
    ///      has to skip quoted strings, since ABI types like `bytes32[]` contain brackets.
    function _artifactAbi() internal view returns (string memory) {
        bytes memory file = bytes(vm.readFile(ARTIFACT));
        uint256 open = _openingBracket(file);

        uint256 depth;
        bool inString;
        for (uint256 i = open; i < file.length; i++) {
            bytes1 c = file[i];
            if (inString) {
                if (c == "\\") i++;
                else if (c == '"') inString = false;
            } else if (c == '"') {
                inString = true;
            } else if (c == "[") {
                depth++;
            } else if (c == "]") {
                depth--;
                if (depth == 0) return _slice(file, open, i);
            }
        }
        revert("abi array not closed");
    }

    function _openingBracket(bytes memory file) private pure returns (uint256) {
        bytes memory key = bytes('"abi":');
        for (uint256 i = 0; i + key.length < file.length; i++) {
            bool hit = true;
            for (uint256 j = 0; j < key.length; j++) {
                if (file[i + j] != key[j]) {
                    hit = false;
                    break;
                }
            }
            if (!hit) continue;
            for (uint256 k = i + key.length; k < file.length; k++) {
                if (file[k] == "[") return k;
            }
        }
        revert("no abi key in artifact");
    }

    function _slice(bytes memory data, uint256 from, uint256 to) private pure returns (string memory) {
        bytes memory out = new bytes(to - from + 1);
        for (uint256 i = 0; i < out.length; i++) {
            out[i] = data[from + i];
        }
        return string(out);
    }
}
