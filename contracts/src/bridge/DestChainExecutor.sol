// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Ownable} from "../utils/Ownable.sol";
import {SafeTransferLib} from "../utils/SafeTransferLib.sol";
import {BridgeMessages} from "./BridgeMessages.sol";
import {IDestChainExecutor} from "../interfaces/IDestChainExecutor.sol";
import {IDestSwapAdapter} from "../interfaces/IDestSwapAdapter.sol";

/// @title DestChainExecutor
/// @notice Handles USDX arrivals on the destination chain, optionally swapping into the requested token
///         before final delivery to the recipient.
contract DestChainExecutor is Ownable, IDestChainExecutor {
    using SafeTransferLib for address;

    address public immutable usdx;
    IDestSwapAdapter public swapAdapter;

    event SwapAdapterUpdated(address indexed adapter);
    event Delivered(
        uint32 indexed srcEid, bytes32 indexed from, address indexed recipient, address tokenOut, uint256 amountOut
    );

    error NotUSDX(address caller);
    error UnexpectedToken(address token);
    error SwapAdapterNotSet();
    error QuoteExpired(uint64 expiry, uint64 current);

    constructor(address owner_, address usdx_) Ownable(owner_) {
        usdx = usdx_;
    }

    function setSwapAdapter(IDestSwapAdapter adapter) external onlyOwner {
        swapAdapter = adapter;
        emit SwapAdapterUpdated(address(adapter));
    }

    function onOFTReceived(uint32 srcEid, bytes32 from, address token, uint256 amount, bytes calldata payload)
        external
        override
    {
        if (msg.sender != usdx) revert NotUSDX(msg.sender);
        if (token != usdx) revert UnexpectedToken(token);

        BridgeMessages.DestPayload memory destPayload = abi.decode(payload, (BridgeMessages.DestPayload));

        uint64 expiry = destPayload.ttl == 0 ? type(uint64).max : destPayload.quoteTimestamp + destPayload.ttl;
        if (destPayload.ttl != 0 && block.timestamp > expiry) {
            revert QuoteExpired(expiry, uint64(block.timestamp));
        }

        uint256 amountOut = amount;
        address tokenOut = usdx;

        if (destPayload.destSwap.execute) {
            IDestSwapAdapter adapter = swapAdapter;
            if (address(adapter) == address(0)) revert SwapAdapterNotSet();

            address(usdx).safeApprove(address(adapter), 0);
            address(usdx).safeApprove(address(adapter), amount);
            amountOut = adapter.executeSwap(destPayload.destSwap, amount, destPayload.recipient);
            tokenOut = destPayload.destSwap.tokenOut;
        } else {
            address(usdx).safeTransfer(destPayload.recipient, amount);
        }

        emit Delivered(srcEid, from, destPayload.recipient, tokenOut, amountOut);
    }
}
