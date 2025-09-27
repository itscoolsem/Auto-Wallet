// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import {IEntryPoint} from "../interfaces/IEntryPoint.sol";

/// @title AutoBridgeAccount
/// @notice Minimal ERC-4337 compatible smart account with owner signature validation.
contract AutoBridgeAccount {
    using ECDSA for bytes32;

    struct UserOperation {
        address sender;
        uint256 nonce;
        bytes initCode;
        bytes callData;
        uint256 callGasLimit;
        uint256 verificationGasLimit;
        uint256 preVerificationGas;
        uint256 maxFeePerGas;
        uint256 maxPriorityFeePerGas;
        bytes paymasterAndData;
        bytes signature;
    }

    address public owner;
    address public immutable entryPoint;

    event OwnerUpdated(address indexed newOwner);
    event Executed(address indexed target, uint256 value, bytes data, bytes result);
    event BatchExecuted(address[] targets, uint256[] values, bytes[] data);

    error NotOwner();
    error InvalidEntryPoint();
    error InvalidSignature();

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    constructor(address _owner, address _entryPoint) {
        owner = _owner;
        entryPoint = _entryPoint;
    }

    function execute(address target, uint256 value, bytes calldata data) external returns (bytes memory result) {
        if (msg.sender != entryPoint && msg.sender != owner) revert InvalidEntryPoint();
        (bool success, bytes memory response) = target.call{value: value}(data);
        require(success, "AutoBridgeAccount: call failed");
        emit Executed(target, value, data, response);
        return response;
    }

    function executeBatch(address[] calldata targets, uint256[] calldata values, bytes[] calldata data) external {
        if (msg.sender != entryPoint && msg.sender != owner) revert InvalidEntryPoint();
        require(targets.length == values.length && targets.length == data.length, "AutoBridgeAccount: length mismatch");
        for (uint256 i = 0; i < targets.length; i++) {
            (bool success,) = targets[i].call{value: values[i]}(data[i]);
            require(success, "AutoBridgeAccount: batch call failed");
        }
        emit BatchExecuted(targets, values, data);
    }

    function validateUserOp(UserOperation calldata userOp, bytes32 userOpHash, uint256 missingAccountFunds)
        external
        returns (uint256 validationData)
    {
        if (msg.sender != entryPoint) revert InvalidEntryPoint();
        _validateSignature(userOpHash, userOp.signature);

        if (missingAccountFunds != 0) {
            IEntryPoint(entryPoint).depositTo{value: missingAccountFunds}(address(this));
        }

        return 0;
    }

    function setOwner(address newOwner) external onlyOwner {
        owner = newOwner;
        emit OwnerUpdated(newOwner);
    }

    receive() external payable {}

    function _validateSignature(bytes32 userOpHash, bytes calldata signature) internal view {
        bytes32 digest = MessageHashUtils.toEthSignedMessageHash(userOpHash);
        address recovered = ECDSA.recover(digest, signature);
        if (recovered != owner) revert InvalidSignature();
    }
}
