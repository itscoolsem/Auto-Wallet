// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";

import {IUSDXOFT} from "../src/interfaces/IUSDXOFT.sol";
import {LocalBridgeSender} from "../src/bridge/LocalBridgeSender.sol";
import {WalletExecutor} from "../src/core/WalletExecutor.sol";
import {AutoBridgePaymaster} from "../src/core/AutoBridgePaymaster.sol";

contract DeployWalletStack is Script {
    function run() external {
        uint256 deployerPk = vm.envUint("PRIVATE_KEY");
        address owner = vm.envOr("STACK_OWNER", vm.addr(deployerPk));
        address usdX = vm.envAddress("USDX_ADDRESS");
        address entryPoint = vm.envAddress("ENTRY_POINT");
        address gasVault = vm.envOr("GAS_VAULT", owner);

        vm.startBroadcast(deployerPk);

        LocalBridgeSender bridgeSender = new LocalBridgeSender(owner, IUSDXOFT(usdX));
        WalletExecutor executor = new WalletExecutor(owner, usdX, bridgeSender);
        bridgeSender.setWalletExecutor(address(executor));

        AutoBridgePaymaster paymaster = new AutoBridgePaymaster(owner, entryPoint, gasVault);
        paymaster.setWalletExecutor(address(executor));

        vm.stopBroadcast();

        console2.log("LocalBridgeSender", address(bridgeSender));
        console2.log("WalletExecutor", address(executor));
        console2.log("AutoBridgePaymaster", address(paymaster));
    }
}
