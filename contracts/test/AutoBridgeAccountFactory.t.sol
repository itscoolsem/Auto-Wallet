// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Test} from "forge-std/Test.sol";

import {AutoBridgeAccount} from "../src/core/AutoBridgeAccount.sol";
import {AutoBridgeAccountFactory} from "../src/core/AutoBridgeAccountFactory.sol";

contract AutoBridgeAccountFactoryTest is Test {
    AutoBridgeAccount template;
    AutoBridgeAccountFactory factory;

    address owner = address(0xA11CE);
    address entryPoint = address(0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789);

    function setUp() public {
        template = new AutoBridgeAccount(address(this), entryPoint);
        factory = new AutoBridgeAccountFactory(address(template));
    }

    function testCreatesAccount() public {
        bytes32 salt = keccak256("alice#1");
        address predicted = factory.computeAddress(owner, salt);
        address deployed = factory.createAccount(owner, salt);

        assertEq(deployed, predicted, "deployed address mismatch");
        assertEq(AutoBridgeAccount(payable(deployed)).owner(), owner, "owner mismatch");
        assertEq(AutoBridgeAccount(payable(deployed)).entryPoint(), entryPoint, "entry point mismatch");
        vm.expectRevert(abi.encodeWithSelector(AutoBridgeAccountFactory.AccountExists.selector, salt));
        factory.createAccount(owner, salt);
    }
}
