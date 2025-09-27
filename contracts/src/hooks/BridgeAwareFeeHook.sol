// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {BaseHook} from "./BaseHook.sol";
import {PoolTypes} from "../uniswap/PoolTypes.sol";
import {IPoolManager} from "../uniswap/IPoolManager.sol";
import {RouteTypes} from "../core/RouteTypes.sol";

/// @title BridgeAwareFeeHook
/// @notice Validates bridge fee metadata and returns extra fee bps to apply on source swaps.
contract BridgeAwareFeeHook is BaseHook {
    uint16 public immutable maxGlobalBps;

    error FeeTooHigh(uint16 requested, uint16 cap);
    error QuoteExpired(uint64 expiry, uint64 current);

    struct BridgeFeeConfig {
        uint16 extraFeeBps;
        uint16 maxFeeBps;
        uint64 quoteTimestamp;
        uint64 ttl;
        uint128 nativeFee;
    }

    event BridgeFeeApplied(address indexed sender, uint16 extraFeeBps, uint128 nativeFee, uint32 dstEid);

    constructor(IPoolManager poolManager_, uint16 maxGlobalBps_) BaseHook(poolManager_) {
        maxGlobalBps = maxGlobalBps_;
    }

    function getHookPermissions() public pure override returns (HookPermissions memory) {
        return HookPermissions({beforeSwap: true, afterSwap: false});
    }

    function _beforeSwap(address sender, PoolTypes.PoolKey calldata, PoolTypes.SwapParams calldata, bytes calldata data)
        internal
        override
        returns (bytes4, BeforeSwapDelta memory, uint24 dynamicFeeBps)
    {
        RouteTypes.HookData memory hookData = abi.decode(data, (RouteTypes.HookData));
        BridgeFeeConfig memory config = BridgeFeeConfig({
            extraFeeBps: hookData.bridgeFee.extraFeeBps,
            maxFeeBps: hookData.bridgeFee.maxFeeBps,
            quoteTimestamp: hookData.bridgeFee.quoteTimestamp,
            ttl: hookData.bridgeFee.ttl,
            nativeFee: hookData.bridgeFee.nativeFee
        });

        if (config.extraFeeBps > maxGlobalBps || config.extraFeeBps > config.maxFeeBps) {
            uint16 cap = config.maxFeeBps < maxGlobalBps ? config.maxFeeBps : maxGlobalBps;
            revert FeeTooHigh(config.extraFeeBps, cap);
        }

        uint64 expiry = config.ttl == 0 ? type(uint64).max : config.quoteTimestamp + config.ttl;
        if (config.ttl != 0 && block.timestamp > expiry) {
            revert QuoteExpired(expiry, uint64(block.timestamp));
        }

        emit BridgeFeeApplied(sender, config.extraFeeBps, config.nativeFee, 0);
        BeforeSwapDelta memory delta = BeforeSwapDelta({amount0: 0, amount1: 0});
        return (BaseHook.beforeSwap.selector, delta, uint24(config.extraFeeBps));
    }

    function _afterSwap(
        address,
        PoolTypes.PoolKey calldata,
        PoolTypes.SwapParams calldata,
        PoolTypes.BalanceDelta memory,
        bytes calldata
    ) internal pure override returns (bytes4, int128) {
        return (BaseHook.afterSwap.selector, 0);
    }
}
