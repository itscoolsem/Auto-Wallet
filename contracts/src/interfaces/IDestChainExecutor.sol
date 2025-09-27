// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

interface IDestChainExecutor {
    function onOFTReceived(uint32 srcEid, bytes32 from, address token, uint256 amount, bytes calldata payload)
        external;
}
