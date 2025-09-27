// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {BridgeMessages} from "../bridge/BridgeMessages.sol";

interface IDestSwapAdapter {
    function executeSwap(BridgeMessages.DestSwap calldata swapConfig, uint256 amountIn, address recipient)
        external
        returns (uint256 amountOut);
}
