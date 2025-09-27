// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {PoolTypes} from "./PoolTypes.sol";

interface IPoolManager {
    function swap(PoolTypes.PoolKey calldata key, PoolTypes.SwapParams calldata params, bytes calldata hookData)
        external
        returns (PoolTypes.BalanceDelta memory delta);

    function unlock(bytes calldata data) external returns (bytes memory result);
}

interface IUnlockCallback {
    function unlockCallback(bytes calldata data) external returns (bytes memory result);
}
