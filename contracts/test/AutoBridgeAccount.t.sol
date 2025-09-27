// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Test} from "forge-std/Test.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

import {AutoBridgeAccount} from "../src/core/AutoBridgeAccount.sol";
import {MockEntryPoint} from "./utils/MockEntryPoint.sol";

contract AutoBridgeAccountTest is Test {
    using ECDSA for bytes32;

    AutoBridgeAccount private account;
    MockEntryPoint private entryPoint;
    uint256 private ownerKey = 0xA11CE;
    address private ownerAddr;

    function setUp() public {
        ownerAddr = vm.addr(ownerKey);
        entryPoint = new MockEntryPoint();
        account = new AutoBridgeAccount(ownerAddr, address(entryPoint));
    }

    function testValidateUserOpAcceptsOwnerSignature() public {
        AutoBridgeAccount.UserOperation memory userOp;
        userOp.sender = address(account);
        bytes32 userOpHash = keccak256("userOpHash");
        bytes32 digest = MessageHashUtils.toEthSignedMessageHash(userOpHash);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(ownerKey, digest);
        userOp.signature = abi.encodePacked(r, s, v);

        vm.prank(address(entryPoint));
        account.validateUserOp(userOp, userOpHash, 0);
    }

    function testValidateUserOpDepositsMissingFunds() public {
        AutoBridgeAccount.UserOperation memory userOp;
        userOp.sender = address(account);
        bytes32 userOpHash = keccak256("depositOp");
        bytes32 digest = MessageHashUtils.toEthSignedMessageHash(userOpHash);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(ownerKey, digest);
        userOp.signature = abi.encodePacked(r, s, v);

        vm.deal(address(account), 1 ether);

        vm.prank(address(entryPoint));
        account.validateUserOp(userOp, userOpHash, 0.25 ether);

        assertEq(entryPoint.deposits(address(account)), 0.25 ether, "deposit mismatch");
    }

    function testValidateUserOpRejectsInvalidSigner() public {
        AutoBridgeAccount.UserOperation memory userOp;
        userOp.sender = address(account);
        bytes32 userOpHash = keccak256("badHash");
        bytes32 digest = MessageHashUtils.toEthSignedMessageHash(userOpHash);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(0xB0B, digest);
        userOp.signature = abi.encodePacked(r, s, v);

        vm.prank(address(entryPoint));
        vm.expectRevert(AutoBridgeAccount.InvalidSignature.selector);
        account.validateUserOp(userOp, userOpHash, 0);
    }
}
