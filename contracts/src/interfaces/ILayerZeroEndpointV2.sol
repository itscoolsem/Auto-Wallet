// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

/// @notice Minimal subset of the LayerZero v2 Endpoint interface required for USDX flows.
interface ILayerZeroEndpointV2 {
    struct MessagingFee {
        uint128 nativeFee;
        uint128 lzTokenFee;
    }

    function quote(uint32 dstEid, bytes32 to, bytes calldata payload, bytes calldata options)
        external
        view
        returns (MessagingFee memory fee);

    function send(
        uint32 dstEid,
        bytes32 to,
        bytes calldata payload,
        bytes calldata options,
        MessagingFee calldata fee,
        address payable refundAddress
    ) external payable returns (bytes32 messageId);
}
