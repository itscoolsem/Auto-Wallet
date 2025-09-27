// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {PoolTypes} from "../uniswap/PoolTypes.sol";
import {IPoolManager} from "../uniswap/IPoolManager.sol";

/// @notice Minimal hook base mirroring Uniswap v4 hook entry points.
abstract contract BaseHook {
    IPoolManager public immutable poolManager;

    error NotPoolManager();

    constructor(IPoolManager _poolManager) {
        poolManager = _poolManager;
    }

    function getHookPermissions() public pure virtual returns (HookPermissions memory);

    struct HookPermissions {
        bool beforeSwap;
        bool afterSwap;
    }

    function beforeSwap(
        address sender,
        PoolTypes.PoolKey calldata key,
        PoolTypes.SwapParams calldata params,
        bytes calldata data
    ) external returns (bytes4, BeforeSwapDelta memory, uint24) {
        if (msg.sender != address(poolManager)) revert NotPoolManager();
        return _beforeSwap(sender, key, params, data);
    }

    function afterSwap(
        address sender,
        PoolTypes.PoolKey calldata key,
        PoolTypes.SwapParams calldata params,
        PoolTypes.BalanceDelta memory delta,
        bytes calldata data
    ) external returns (bytes4, int128) {
        if (msg.sender != address(poolManager)) revert NotPoolManager();
        return _afterSwap(sender, key, params, delta, data);
    }

    struct BeforeSwapDelta {
        int128 amount0;
        int128 amount1;
    }

    function _beforeSwap(
        address sender,
        PoolTypes.PoolKey calldata key,
        PoolTypes.SwapParams calldata params,
        bytes calldata data
    ) internal virtual returns (bytes4, BeforeSwapDelta memory, uint24);

    function _afterSwap(
        address sender,
        PoolTypes.PoolKey calldata key,
        PoolTypes.SwapParams calldata params,
        PoolTypes.BalanceDelta memory delta,
        bytes calldata data
    ) internal virtual returns (bytes4, int128);
}
