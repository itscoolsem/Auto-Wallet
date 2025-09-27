// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {RouteTypes} from "../core/RouteTypes.sol";

interface ISourceSwapAdapter {
    function executeSourceSwap(
        RouteTypes.SourceSwap calldata swapConfig,
        address tokenIn,
        uint256 amountIn,
        address payer
    ) external returns (uint256 amountOut);
}
