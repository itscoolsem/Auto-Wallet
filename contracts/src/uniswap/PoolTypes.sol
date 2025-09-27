// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

/// @notice Lightweight replicas of Uniswap v4 pool structs used for hook integration.
library PoolTypes {
    struct PoolKey {
        address currency0;
        address currency1;
        uint24 fee;
        int24 tickSpacing;
        address hooks;
    }

    struct SwapParams {
        bool zeroForOne;
        int256 amountSpecified;
        uint160 sqrtPriceLimitX96;
    }

    struct BalanceDelta {
        int128 amount0;
        int128 amount1;
    }
}
