// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {PoolTypes} from "../uniswap/PoolTypes.sol";

library BridgeMessages {
    struct DestSwap {
        bool execute;
        address tokenOut;
        PoolTypes.PoolKey poolKey;
        PoolTypes.SwapParams swapParams;
        bytes hookData;
        uint256 minAmountOut;
    }

    struct DestPayload {
        address recipient;
        DestSwap destSwap;
        uint64 quoteTimestamp;
        uint64 ttl;
        bytes pricePayload;
    }
}
