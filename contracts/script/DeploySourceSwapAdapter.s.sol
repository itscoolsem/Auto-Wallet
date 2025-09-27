// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";

import {IPoolManager} from "../src/uniswap/IPoolManager.sol";
import {UniswapSourceSwapAdapter} from "../src/adapters/UniswapSourceSwapAdapter.sol";

contract DeploySourceSwapAdapter is Script {
    function run() external returns (UniswapSourceSwapAdapter adapter) {
        uint256 deployerPk = vm.envUint("PRIVATE_KEY");
        address poolManagerAddr = vm.envAddress("POOL_MANAGER");

        vm.startBroadcast(deployerPk);
        adapter = new UniswapSourceSwapAdapter(IPoolManager(poolManagerAddr));
        vm.stopBroadcast();

        console2.log("UniswapSourceSwapAdapter", address(adapter));
        console2.log("PoolManager", poolManagerAddr);
    }
}
