// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Ownable} from "../utils/Ownable.sol";
import {SafeTransferLib} from "../utils/SafeTransferLib.sol";
import {IUSDXOFT} from "../interfaces/IUSDXOFT.sol";
import {ILayerZeroEndpointV2} from "../interfaces/ILayerZeroEndpointV2.sol";
import {BridgeMessages} from "./BridgeMessages.sol";

/// @title BridgeSender
/// @notice Wraps USDX OFT send calls with routing metadata and controls permissions for wallet executors.
contract BridgeSender is Ownable {
    using SafeTransferLib for address;

    IUSDXOFT public immutable usdX;

    address public walletExecutor;

    event WalletExecutorUpdated(address indexed executor);
    event BridgeInitiated(
        bytes32 indexed messageId,
        uint32 indexed dstEid,
        address indexed destExecutor,
        uint256 amount,
        address recipient
    );

    error NotExecutor();
    error InvalidExecutor();

    struct BridgeRequest {
        uint32 dstEid;
        address destExecutor;
        uint256 amount;
        BridgeMessages.DestPayload destPayload;
        bytes options;
        ILayerZeroEndpointV2.MessagingFee fee;
        address payable refundAddress;
    }

    constructor(address owner_, IUSDXOFT usdX_) Ownable(owner_) {
        usdX = usdX_;
    }

    function setWalletExecutor(address executor) external onlyOwner {
        if (executor == address(0)) revert InvalidExecutor();
        walletExecutor = executor;
        emit WalletExecutorUpdated(executor);
    }

    function bridge(BridgeRequest calldata request)
        public
        payable
        virtual
        onlyWalletExecutor
        returns (bytes32 messageId)
    {
        address token = address(usdX);
        token.safeTransferFrom(msg.sender, address(this), request.amount);

        IUSDXOFT.SendParam memory param = IUSDXOFT.SendParam({
            dstEid: request.dstEid,
            to: bytes32(uint256(uint160(request.destExecutor))),
            amount: request.amount,
            payload: abi.encode(request.destPayload),
            options: request.options,
            fee: request.fee
        });

        IUSDXOFT.SendResult memory result = usdX.send{value: msg.value}(param, request.refundAddress);

        emit BridgeInitiated(
            result.messageId, request.dstEid, request.destExecutor, request.amount, request.destPayload.recipient
        );
        return result.messageId;
    }

    modifier onlyWalletExecutor() {
        if (msg.sender != walletExecutor) revert NotExecutor();
        _;
    }

    receive() external payable {}
}
