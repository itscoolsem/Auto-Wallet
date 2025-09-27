// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";

import {AutoBridgePaymaster} from "../src/core/AutoBridgePaymaster.sol";

contract TopUpPaymaster is Script {
    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address payable paymasterAddr = payable(vm.envAddress("PAYMASTER_ADDRESS"));
        uint256 depositAmount = vm.envUint("PAYMASTER_DEPOSIT_WEI");

        vm.startBroadcast(pk);
        AutoBridgePaymaster(paymasterAddr).deposit{value: depositAmount}();
        vm.stopBroadcast();

        console2.log("Paymaster topped up", paymasterAddr, depositAmount);
    }
}
