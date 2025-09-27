// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {AutoBridgeAccount} from "./AutoBridgeAccount.sol";

/// @title AutoBridgeAccountFactory
/// @notice Deterministically deploys AutoBridgeAccount instances and keeps lightweight registry metadata.
contract AutoBridgeAccountFactory {
    address public immutable entryPoint;
    address public immutable implementation;

    event AccountCreated(address indexed owner, address indexed account, bytes32 salt);

    error EntryPointMismatch(address provided);
    error AccountExists(bytes32 salt);

    constructor(address implementation_) {
        AutoBridgeAccount template = AutoBridgeAccount(payable(implementation_));
        entryPoint = template.entryPoint();
        implementation = implementation_;
    }

    function createAccount(address owner, bytes32 salt) external returns (address account) {
        bytes32 derivedSalt = _deriveSalt(owner, salt);
        account = computeAddress(owner, salt);
        if (account.code.length != 0) revert AccountExists(salt);

        bytes memory initcode = abi.encodePacked(type(AutoBridgeAccount).creationCode, abi.encode(owner, entryPoint));
        address deployed;
        assembly {
            deployed := create2(0, add(initcode, 0x20), mload(initcode), derivedSalt)
        }
        require(deployed != address(0), "ACCOUNT_DEPLOY_FAIL");
        emit AccountCreated(owner, deployed, salt);
        return deployed;
    }

    function computeAddress(address owner, bytes32 salt) public view returns (address) {
        bytes32 derivedSalt = _deriveSalt(owner, salt);
        bytes memory initcode = abi.encodePacked(type(AutoBridgeAccount).creationCode, abi.encode(owner, entryPoint));
        bytes32 hash = keccak256(abi.encodePacked(bytes1(0xff), address(this), derivedSalt, keccak256(initcode)));
        return address(uint160(uint256(hash)));
    }

    function _deriveSalt(address owner, bytes32 salt) private pure returns (bytes32) {
        return keccak256(abi.encode(owner, salt));
    }
}
