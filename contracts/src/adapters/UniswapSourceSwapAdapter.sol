// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {IPoolManager, IUnlockCallback} from "../uniswap/IPoolManager.sol";
import {PoolTypes} from "../uniswap/PoolTypes.sol";
import {ISourceSwapAdapter} from "../interfaces/ISourceSwapAdapter.sol";
import {RouteTypes} from "../core/RouteTypes.sol";
import {SafeTransferLib} from "../utils/SafeTransferLib.sol";
import {IERC20} from "../interfaces/IERC20.sol";

/// @title UniswapSourceSwapAdapter
/// @notice Executes Uniswap v4 swaps for the wallet executor and builds hook calldata.
contract UniswapSourceSwapAdapter is ISourceSwapAdapter, IUnlockCallback {
    using SafeTransferLib for address;

    IPoolManager public immutable poolManager;

    error InvalidInputToken(address expected, address provided);
    error NonPositiveInputDelta();
    error NonPositiveOutputDelta();
    error UnauthorizedCallback();

    event SourceSwapExecuted(
        address indexed caller,
        address indexed tokenIn,
        address indexed tokenOut,
        uint256 amountInSpent,
        uint256 amountOutReceived
    );

    constructor(IPoolManager poolManager_) {
        poolManager = poolManager_;
    }

    /// @inheritdoc ISourceSwapAdapter
    function executeSourceSwap(
        RouteTypes.SourceSwap calldata swapConfig,
        address tokenIn,
        uint256 amountIn,
        address /* payer */
    ) external override returns (uint256 amountOut) {
        PoolTypes.PoolKey calldata key = swapConfig.poolKey;
        PoolTypes.SwapParams calldata params = swapConfig.swapParams;

        address expectedTokenIn = params.zeroForOne ? key.currency0 : key.currency1;
        if (tokenIn != expectedTokenIn) {
            revert InvalidInputToken(expectedTokenIn, tokenIn);
        }
        address tokenOut = params.zeroForOne ? key.currency1 : key.currency0;

        // Pull funds from the wallet executor.
        tokenIn.safeTransferFrom(msg.sender, address(this), amountIn);
        tokenIn.safeApprove(address(poolManager), amountIn);

        bytes memory hookData = abi.encode(
            RouteTypes.HookData({bridgeFee: swapConfig.bridgeFee, gasFee: swapConfig.gasFee})
        );

        bytes memory result = poolManager.unlock(
            abi.encode(SwapContext({key: key, params: params, hookData: hookData}))
        );

        PoolTypes.BalanceDelta memory delta = abi.decode(result, (PoolTypes.BalanceDelta));

        // Clear any outstanding allowance regardless of the amount consumed.
        tokenIn.safeApprove(address(poolManager), 0);

        uint256 spentAmount = _calculateInputDelta(params.zeroForOne, delta);
        if (spentAmount == 0) revert NonPositiveInputDelta();

        // Refund any unspent input back to the wallet executor.
        uint256 remainingInput = IERC20(tokenIn).balanceOf(address(this));
        if (remainingInput > 0) {
            tokenIn.safeTransfer(msg.sender, remainingInput);
        }

        amountOut = _calculateOutputDelta(params.zeroForOne, delta);
        if (amountOut == 0) revert NonPositiveOutputDelta();

        // Forward swap proceeds to the wallet executor.
        uint256 outputBalance = IERC20(tokenOut).balanceOf(address(this));
        if (outputBalance >= amountOut) {
            tokenOut.safeTransfer(msg.sender, amountOut);
        } else if (outputBalance != 0) {
            tokenOut.safeTransfer(msg.sender, outputBalance);
        }

        emit SourceSwapExecuted(msg.sender, tokenIn, tokenOut, spentAmount, amountOut);
    }

    function unlockCallback(bytes calldata data) external override returns (bytes memory) {
        if (msg.sender != address(poolManager)) revert UnauthorizedCallback();
        SwapContext memory ctx = abi.decode(data, (SwapContext));
        PoolTypes.BalanceDelta memory delta = poolManager.swap(ctx.key, ctx.params, ctx.hookData);
        return abi.encode(delta);
    }

    function _calculateInputDelta(bool zeroForOne, PoolTypes.BalanceDelta memory delta)
        private
        pure
        returns (uint256)
    {
        int256 signedDelta = zeroForOne ? int256(delta.amount0) : int256(delta.amount1);
        if (signedDelta >= 0) return 0;
        return uint256(-signedDelta);
    }

    function _calculateOutputDelta(bool zeroForOne, PoolTypes.BalanceDelta memory delta)
        private
        pure
        returns (uint256)
    {
        int256 signedDelta = zeroForOne ? int256(delta.amount1) : int256(delta.amount0);
        if (signedDelta <= 0) return 0;
        return uint256(signedDelta);
    }
}
    struct SwapContext {
        PoolTypes.PoolKey key;
        PoolTypes.SwapParams params;
        bytes hookData;
    }
