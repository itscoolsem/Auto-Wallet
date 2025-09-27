// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {PoolTypes} from "../uniswap/PoolTypes.sol";
import {ILayerZeroEndpointV2} from "../interfaces/ILayerZeroEndpointV2.sol";
import {BridgeMessages} from "../bridge/BridgeMessages.sol";

library RouteTypes {
    struct PermitData {
        bool usePermit;
        uint256 value;
        uint256 deadline;
        uint8 v;
        bytes32 r;
        bytes32 s;
    }

    struct BridgeFeeConfig {
        uint16 extraFeeBps;
        uint16 maxFeeBps;
        uint64 quoteTimestamp;
        uint64 ttl;
        uint128 nativeFee;
    }

    struct GasFeeConfig {
        address vault;
        uint16 skimBps;
        uint16 maxSkimBps;
    }

    struct HookData {
        BridgeFeeConfig bridgeFee;
        GasFeeConfig gasFee;
    }

    struct SourceSwap {
        bool execute;
        PoolTypes.PoolKey poolKey;
        PoolTypes.SwapParams swapParams;
        BridgeFeeConfig bridgeFee;
        GasFeeConfig gasFee;
        uint256 minAmountOut;
    }

    struct BridgeParams {
        uint32 dstEid;
        address destExecutor;
        bytes options;
        ILayerZeroEndpointV2.MessagingFee fee;
        address payable refundAddress;
        BridgeMessages.DestPayload destPayload;
    }

    struct RouteInput {
        address user;
        address tokenIn;
        uint256 amountIn;
        PermitData permit;
        SourceSwap sourceSwap;
        BridgeParams bridge;
    }
}
