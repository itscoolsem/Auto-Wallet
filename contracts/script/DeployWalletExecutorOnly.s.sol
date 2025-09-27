// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";

import {WalletExecutor} from "../src/core/WalletExecutor.sol";
import {BridgeSender} from "../src/bridge/BridgeSender.sol";

contract DeployWalletExecutorOnly is Script {
    function run() external {
        uint256 deployerPk = vm.envUint("PRIVATE_KEY");
        address owner = vm.envOr("EXECUTOR_OWNER", vm.addr(deployerPk));
        address usdX = vm.envAddress("USDX_ADDRESS");
        BridgeSender bridgeSender = BridgeSender(payable(vm.envAddress("BRIDGE_SENDER_ADDRESS")));

        vm.startBroadcast(deployerPk);
        WalletExecutor executor = new WalletExecutor(owner, usdX, bridgeSender);
        bridgeSender.setWalletExecutor(address(executor));
        vm.stopBroadcast();

        console2.log("WalletExecutor", address(executor));
    }
}
