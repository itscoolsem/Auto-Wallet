// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";

import {AutoBridgeAccount} from "../src/core/AutoBridgeAccount.sol";
import {AutoBridgeAccountFactory} from "../src/core/AutoBridgeAccountFactory.sol";

/// @notice Deploys the AutoBridge smart-account template and factory on a target chain.
/// @dev Usage: 
/// forge script script/DeploySmartAccountFactory.s.sol \
///   --rpc-url $BASE_SEPOLIA_RPC \
///   --private-key $BASE_SEPOLIA_DEPLOYER_PK \
///   --broadcast \
///   -vvvv
/// Environment variables:
///   ENTRY_POINT - address of the ERC-4337 EntryPoint (0x5f… for Sepolia).
///   TEMPLATE_OWNER (optional) - initial owner for the template; defaults to deployer EOA.
contract DeploySmartAccountFactory is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address entryPoint = vm.envAddress("ENTRY_POINT");

        address templateOwner = vm.envOr("TEMPLATE_OWNER", vm.addr(deployerKey));

        vm.startBroadcast(deployerKey);

        AutoBridgeAccount template = new AutoBridgeAccount(templateOwner, entryPoint);
        AutoBridgeAccountFactory factory = new AutoBridgeAccountFactory(address(template));

        vm.stopBroadcast();

        console2.log("AutoBridgeAccount template", address(template));
        console2.log("AutoBridgeAccountFactory", address(factory));
        console2.log("EntryPoint", entryPoint);
    }
}
