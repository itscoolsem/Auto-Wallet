// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {ILayerZeroEndpointV2} from "./ILayerZeroEndpointV2.sol";

interface IUSDXOFT {
    struct SendParam {
        uint32 dstEid;
        bytes32 to;
        uint256 amount;
        bytes payload;
        bytes options;
        ILayerZeroEndpointV2.MessagingFee fee;
    }

    struct SendResult {
        bytes32 messageId;
        uint256 amountSent;
    }

    function send(SendParam calldata param, address payable refundAddress)
        external
        payable
        returns (SendResult memory result);

    function setPeer(uint32 eid, bytes32 peer) external;
    function peer(uint32 eid) external view returns (bytes32);
}
