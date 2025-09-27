// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";

import {Hooks} from "@uniswap/v4-core/src/libraries/Hooks.sol";
import {HookMiner} from "@uniswap/v4-periphery/src/utils/HookMiner.sol";

import {V4PoolManagerDeployer} from "hookmate/artifacts/V4PoolManager.sol";

import {BridgeAwareFeeHook} from "../src/hooks/BridgeAwareFeeHook.sol";
import {GasShieldHook} from "../src/hooks/GasShieldHook.sol";
import {IPoolManager} from "../src/uniswap/IPoolManager.sol";

contract DeployPoolManagerAndHooks is Script {
    address internal constant CREATE2_FACTORY_ADDR = 0x4e59b44847b379578588920cA78FbF26c0B4956C;

    function run() external {
        uint256 deployerPk = vm.envUint("PRIVATE_KEY");
        address owner = vm.envOr("POOL_OWNER", vm.addr(deployerPk));

        uint16 bridgeMaxBps = uint16(vm.envOr("BRIDGE_HOOK_MAX_BPS", uint256(500)));
        uint16 gasMaxBps = uint16(vm.envOr("GAS_HOOK_MAX_BPS", uint256(200)));

        vm.startBroadcast(deployerPk);

        address poolManagerAddress = V4PoolManagerDeployer.deploy(owner);
        IPoolManager poolManager = IPoolManager(poolManagerAddress);

        BridgeAwareFeeHook bridgeHook = _deployBridgeHook(poolManager, bridgeMaxBps);
        GasShieldHook gasHook = _deployGasHook(poolManager, gasMaxBps);

        vm.stopBroadcast();

        console2.log("PoolManager", poolManagerAddress);
        console2.log("BridgeAwareFeeHook", address(bridgeHook));
        console2.log("GasShieldHook", address(gasHook));
    }

    function _deployBridgeHook(IPoolManager poolManager, uint16 maxBps) private returns (BridgeAwareFeeHook) {
        bytes memory constructorArgs = abi.encode(poolManager, maxBps);
        (address predicted, bytes32 salt) = HookMiner.find(
            CREATE2_FACTORY_ADDR,
            uint160(Hooks.BEFORE_SWAP_FLAG),
            type(BridgeAwareFeeHook).creationCode,
            constructorArgs
        );

        BridgeAwareFeeHook hook = new BridgeAwareFeeHook{salt: salt}(poolManager, maxBps);
        require(address(hook) == predicted, "Bridge hook address mismatch");
        return hook;
    }

    function _deployGasHook(IPoolManager poolManager, uint16 maxBps) private returns (GasShieldHook) {
        bytes memory constructorArgs = abi.encode(poolManager, maxBps);
        (address predicted, bytes32 salt) = HookMiner.find(
            CREATE2_FACTORY_ADDR,
            uint160(Hooks.AFTER_SWAP_FLAG),
            type(GasShieldHook).creationCode,
            constructorArgs
        );

        GasShieldHook hook = new GasShieldHook{salt: salt}(poolManager, maxBps);
        require(address(hook) == predicted, "Gas hook address mismatch");
        return hook;
    }
}
