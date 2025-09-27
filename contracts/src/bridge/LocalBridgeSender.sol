// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {BridgeSender} from "./BridgeSender.sol";
import {BridgeMessages} from "./BridgeMessages.sol";
import {SafeTransferLib} from "../utils/SafeTransferLib.sol";
import {IUSDXOFT} from "../interfaces/IUSDXOFT.sol";

/// @title LocalBridgeSender
/// @notice Lightweight bridge sender for single-chain demos. Simply forwards USDX to the recipient on the source chain.
contract LocalBridgeSender is BridgeSender {
    using SafeTransferLib for address;

    constructor(address owner_, IUSDXOFT usdX_) BridgeSender(owner_, usdX_) {}

    function bridge(BridgeRequest calldata request)
        public
        payable
        override
        onlyWalletExecutor
        returns (bytes32 messageId)
    {
        address token = address(usdX);
        token.safeTransferFrom(msg.sender, request.destPayload.recipient, request.amount);

        messageId = keccak256(abi.encode(block.timestamp, request.destPayload.recipient, request.amount));

        emit BridgeInitiated(
            messageId, request.dstEid, request.destExecutor, request.amount, request.destPayload.recipient
        );
    }
}
