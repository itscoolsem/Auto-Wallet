// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

interface IEntryPoint {
    function depositTo(address account) external payable;
    function getNonce(address sender, uint192 key) external view returns (uint256);
    function withdrawTo(address payable withdrawAddress, uint256 amount) external;
}
