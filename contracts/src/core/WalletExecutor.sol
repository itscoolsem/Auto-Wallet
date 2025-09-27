// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Ownable} from "../utils/Ownable.sol";
import {SafeTransferLib} from "../utils/SafeTransferLib.sol";
import {IERC20Permit} from "../interfaces/IERC20Permit.sol";
import {IERC20} from "../interfaces/IERC20.sol";
import {BridgeSender} from "../bridge/BridgeSender.sol";
import {RouteTypes} from "./RouteTypes.sol";
import {ISourceSwapAdapter} from "../interfaces/ISourceSwapAdapter.sol";

/// @title WalletExecutor
/// @notice Orchestrates the end-to-end route: pull tokens from the user, optionally swap into USDX,
///         skim gas reimbursements, and forward the bridge request to LayerZero via BridgeSender.
contract WalletExecutor is Ownable {
    using SafeTransferLib for address;

    address public immutable usdx;
    BridgeSender public immutable bridgeSender;

    address public smartAccount;
    ISourceSwapAdapter public swapAdapter;

    event SmartAccountUpdated(address indexed smartAccount);
    event SwapAdapterUpdated(address indexed adapter);
    event RouteExecuted(
        address indexed user, address indexed tokenIn, uint256 amountIn, uint256 amountBridged, bytes32 messageId
    );

    error NotSmartAccount();
    error InvalidUser();
    error InvalidToken();
    error PermitValueMismatch();
    error SwapAdapterNotSet();
    error GasVaultNotSet();
    error AmountTooLow();
    error QuoteExpired(uint64 expiry, uint64 current);
    error FeeCapExceeded(uint16 requested, uint16 cap);
    error NativeFeeMismatch(uint128 expected, uint128 provided);

    constructor(address owner_, address usdx_, BridgeSender bridgeSender_) Ownable(owner_) {
        usdx = usdx_;
        bridgeSender = bridgeSender_;
    }

    function setSmartAccount(address smartAccount_) external onlyOwner {
        smartAccount = smartAccount_;
        emit SmartAccountUpdated(smartAccount_);
    }

    function setSwapAdapter(ISourceSwapAdapter adapter) external onlyOwner {
        swapAdapter = adapter;
        emit SwapAdapterUpdated(address(adapter));
    }

    function executeRoute(RouteTypes.RouteInput calldata route)
        external
        payable
        onlySmartAccount
        returns (bytes32 messageId)
    {
        if (route.user == address(0)) revert InvalidUser();
        if (route.tokenIn == address(0)) revert InvalidToken();

        _applyPermitIfNeeded(route);

        address tokenIn = route.tokenIn;
        uint256 amountForBridge = route.amountIn;
        uint256 preloadedBalance = IERC20(tokenIn).balanceOf(address(this));
        if (preloadedBalance < route.amountIn) {
            tokenIn.safeTransferFrom(route.user, address(this), route.amountIn);
        }

        if (route.sourceSwap.execute) {
            ISourceSwapAdapter adapter = swapAdapter;
            if (address(adapter) == address(0)) revert SwapAdapterNotSet();
            tokenIn.safeApprove(address(adapter), 0);
            tokenIn.safeApprove(address(adapter), route.amountIn);
            amountForBridge = adapter.executeSourceSwap(route.sourceSwap, tokenIn, route.amountIn, route.user);
            tokenIn.safeApprove(address(adapter), 0);
            tokenIn = usdx;
        }

        if (tokenIn != usdx) revert InvalidToken();
        if (route.sourceSwap.minAmountOut > 0 && amountForBridge < route.sourceSwap.minAmountOut) revert AmountTooLow();

        RouteTypes.BridgeParams calldata bridgeParams = route.bridge;
        _validateBridgeFee(route.sourceSwap.bridgeFee, bridgeParams.fee.nativeFee);

        amountForBridge = _skimGas(route.sourceSwap.gasFee, amountForBridge);

        if (amountForBridge == 0) revert AmountTooLow();

        BridgeSender.BridgeRequest memory request = BridgeSender.BridgeRequest({
            dstEid: bridgeParams.dstEid,
            destExecutor: bridgeParams.destExecutor,
            amount: amountForBridge,
            destPayload: bridgeParams.destPayload,
            options: bridgeParams.options,
            fee: bridgeParams.fee,
            refundAddress: bridgeParams.refundAddress
        });

        if (msg.value < bridgeParams.fee.nativeFee) revert AmountTooLow();

        address(usdx).safeApprove(address(bridgeSender), 0);
        address(usdx).safeApprove(address(bridgeSender), amountForBridge);

        messageId = bridgeSender.bridge{value: msg.value}(request);

        emit RouteExecuted(route.user, route.tokenIn, route.amountIn, amountForBridge, messageId);
    }

    function _skimGas(RouteTypes.GasFeeConfig calldata gasFee, uint256 amount) private returns (uint256) {
        if (gasFee.skimBps == 0) return amount;
        if (gasFee.vault == address(0)) revert GasVaultNotSet();
        if (gasFee.skimBps > gasFee.maxSkimBps) revert FeeCapExceeded(gasFee.skimBps, gasFee.maxSkimBps);

        uint256 skimAmount = (amount * gasFee.skimBps) / 10_000;
        if (skimAmount > 0) {
            address(usdx).safeTransfer(gasFee.vault, skimAmount);
            amount -= skimAmount;
        }
        return amount;
    }

    function _validateBridgeFee(RouteTypes.BridgeFeeConfig calldata feeConfig, uint128 providedNativeFee)
        private
        view
    {
        if (feeConfig.extraFeeBps > feeConfig.maxFeeBps) {
            revert FeeCapExceeded(feeConfig.extraFeeBps, feeConfig.maxFeeBps);
        }
        if (feeConfig.ttl != 0) {
            uint64 expiry = feeConfig.quoteTimestamp + feeConfig.ttl;
            if (block.timestamp > expiry) revert QuoteExpired(expiry, uint64(block.timestamp));
        }
        if (feeConfig.nativeFee != 0 && feeConfig.nativeFee != providedNativeFee) {
            revert NativeFeeMismatch(feeConfig.nativeFee, providedNativeFee);
        }
    }

    function _applyPermitIfNeeded(RouteTypes.RouteInput calldata route) private {
        if (!route.permit.usePermit) return;
        IERC20Permit(route.tokenIn).permit(
            route.user,
            address(this),
            route.permit.value,
            route.permit.deadline,
            route.permit.v,
            route.permit.r,
            route.permit.s
        );
        if (route.permit.value < route.amountIn) revert PermitValueMismatch();
    }

    modifier onlySmartAccount() {
        if (msg.sender != smartAccount) revert NotSmartAccount();
        _;
    }
}
