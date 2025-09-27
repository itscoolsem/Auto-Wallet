// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {BaseHook} from "./BaseHook.sol";
import {PoolTypes} from "../uniswap/PoolTypes.sol";
import {IPoolManager} from "../uniswap/IPoolManager.sol";
import {RouteTypes} from "../core/RouteTypes.sol";

/// @title GasShieldHook
/// @notice Records skim configuration so the wallet executor can reimburse its gas sponsor post-swap.
contract GasShieldHook is BaseHook {
    uint16 public immutable maxGlobalSkimBps;

    error SkimTooHigh(uint16 requested, uint16 cap);
    error InvalidVault();

    struct GasShieldConfig {
        address vault;
        uint16 skimBps;
        uint16 maxSkimBps;
    }

    event GasSkimPlanned(address indexed sender, address indexed vault, uint16 skimBps, uint256 amountOutHint);

    constructor(IPoolManager poolManager_, uint16 maxGlobalSkimBps_) BaseHook(poolManager_) {
        maxGlobalSkimBps = maxGlobalSkimBps_;
    }

    function getHookPermissions() public pure override returns (HookPermissions memory) {
        return HookPermissions({beforeSwap: false, afterSwap: true});
    }

    function _beforeSwap(address, PoolTypes.PoolKey calldata, PoolTypes.SwapParams calldata, bytes calldata)
        internal
        pure
        override
        returns (bytes4, BeforeSwapDelta memory, uint24)
    {
        return (BaseHook.beforeSwap.selector, BeforeSwapDelta({amount0: 0, amount1: 0}), 0);
    }

    function _afterSwap(
        address sender,
        PoolTypes.PoolKey calldata,
        PoolTypes.SwapParams calldata,
        PoolTypes.BalanceDelta memory delta,
        bytes calldata data
    ) internal override returns (bytes4, int128) {
        RouteTypes.HookData memory hookData = abi.decode(data, (RouteTypes.HookData));
        GasShieldConfig memory config = GasShieldConfig({
            vault: hookData.gasFee.vault,
            skimBps: hookData.gasFee.skimBps,
            maxSkimBps: hookData.gasFee.maxSkimBps
        });
        if (config.vault == address(0)) revert InvalidVault();
        if (config.skimBps > maxGlobalSkimBps || config.skimBps > config.maxSkimBps) {
            uint16 cap = config.maxSkimBps < maxGlobalSkimBps ? config.maxSkimBps : maxGlobalSkimBps;
            revert SkimTooHigh(config.skimBps, cap);
        }

        uint256 grossOut = _absoluteOutput(delta);
        emit GasSkimPlanned(sender, config.vault, config.skimBps, grossOut);
        return (BaseHook.afterSwap.selector, 0);
    }

    function _absoluteOutput(PoolTypes.BalanceDelta memory delta) private pure returns (uint256) {
        if (delta.amount0 < 0) {
            return uint256(uint128(-delta.amount0));
        }
        if (delta.amount1 < 0) {
            return uint256(uint128(-delta.amount1));
        }
        return 0;
    }
}
