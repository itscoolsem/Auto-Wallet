// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

/// @title Ownable
/// @notice Minimal ownable helper used across AutoBridge contracts.
abstract contract Ownable {
    address public owner;

    event OwnerUpdated(address indexed newOwner);

    error NotOwner();
    error InvalidOwner();

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    constructor(address _owner) {
        if (_owner == address(0)) revert InvalidOwner();
        owner = _owner;
        emit OwnerUpdated(_owner);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert InvalidOwner();
        owner = newOwner;
        emit OwnerUpdated(newOwner);
    }
}
