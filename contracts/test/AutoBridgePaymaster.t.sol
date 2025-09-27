// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Test} from "forge-std/Test.sol";

import {AutoBridgePaymaster} from "../src/core/AutoBridgePaymaster.sol";
import {RouteTypes} from "../src/core/RouteTypes.sol";
import {PoolTypes} from "../src/uniswap/PoolTypes.sol";
import {WalletExecutor} from "../src/core/WalletExecutor.sol";
import {AutoBridgeAccount} from "../src/core/AutoBridgeAccount.sol";
import {MockEntryPoint} from "./utils/MockEntryPoint.sol";

contract AutoBridgePaymasterTest is Test {
    AutoBridgePaymaster private paymaster;
    MockEntryPoint private entryPoint;

    address private owner = address(0xABCD);
    address private walletExecutor = address(uint160(0x000000000000000000000000000000000000dEf1));
    address private smartAccount = address(uint160(0x000000000000000000000000000000000000AcC7));
    address private expectedUser = address(uint160(0x000000000000000000000000000000000000bEEF));

    function setUp() public {
        entryPoint = new MockEntryPoint();
        paymaster = new AutoBridgePaymaster(owner, address(entryPoint), address(0xCAFE));

        vm.prank(owner);
        paymaster.setWalletExecutor(walletExecutor);
    }

    function testValidatePaymasterUserOpAllowsApprovedSender() public {
        vm.prank(owner);
        paymaster.setSenderPermission(smartAccount, expectedUser, true);

        AutoBridgePaymaster.UserOperation memory userOp = _buildUserOp(expectedUser);

        vm.prank(address(entryPoint));
        (bytes memory context, uint256 validationData) = paymaster.validatePaymasterUserOp(userOp, bytes32(0), 100_000);
        assertEq(context.length, 0);
        assertEq(validationData, 0);
    }

    function testValidatePaymasterUserOpAllowsAnySenderByDefault() public {
        AutoBridgePaymaster.UserOperation memory userOp = _buildUserOp(expectedUser);

        vm.prank(address(entryPoint));
        (bytes memory context, uint256 validationData) = paymaster.validatePaymasterUserOp(userOp, bytes32(0), 100_000);
        assertEq(context.length, 0);
        assertEq(validationData, 0);
    }

    function testValidatePaymasterUserOpRevertsOnUserMismatch() public {
        vm.prank(owner);
        paymaster.setSenderPermission(smartAccount, expectedUser, true);

        AutoBridgePaymaster.UserOperation memory userOp =
            _buildUserOp(address(uint160(0x0000000000000000000000000000000000001234)));

        vm.prank(owner);
        paymaster.setAllowAnySender(false);

        vm.prank(address(entryPoint));
        vm.expectRevert(
            abi.encodeWithSelector(
                AutoBridgePaymaster.InvalidRouteUser.selector,
                address(uint160(0x0000000000000000000000000000000000001234)),
                expectedUser
            )
        );
        paymaster.validatePaymasterUserOp(userOp, bytes32(0), 100_000);
    }

    function testValidatePaymasterUserOpRevertsOnTargetMismatch() public {
        vm.prank(owner);
        paymaster.setSenderPermission(smartAccount, expectedUser, true);

        AutoBridgePaymaster.UserOperation memory userOp = _buildUserOp(expectedUser);
        userOp.callData = abi.encodeWithSelector(AutoBridgeAccount.execute.selector, address(0xBAD), 0, bytes(""));

        vm.prank(address(entryPoint));
        vm.expectRevert(abi.encodeWithSelector(AutoBridgePaymaster.InvalidTarget.selector, address(0xBAD)));
        paymaster.validatePaymasterUserOp(userOp, bytes32(0), 100_000);
    }

    function testValidatePaymasterUserOpHonoursMaxCostLimit() public {
        vm.prank(owner);
        paymaster.setSenderPermission(smartAccount, expectedUser, true);

        vm.prank(owner);
        paymaster.setMaxSponsoredCost(50_000);

        AutoBridgePaymaster.UserOperation memory userOp = _buildUserOp(expectedUser);

        vm.prank(address(entryPoint));
        vm.expectRevert(abi.encodeWithSelector(AutoBridgePaymaster.GasLimitTooHigh.selector, 60_000, 50_000));
        paymaster.validatePaymasterUserOp(userOp, bytes32(0), 60_000);
    }

    function testValidatePaymasterUserOpRequiresAllowWhenGlobalDisabled() public {
        vm.prank(owner);
        paymaster.setAllowAnySender(false);

        AutoBridgePaymaster.UserOperation memory userOp = _buildUserOp(expectedUser);

        vm.prank(address(entryPoint));
        vm.expectRevert(abi.encodeWithSelector(AutoBridgePaymaster.SenderNotAllowed.selector, smartAccount));
        paymaster.validatePaymasterUserOp(userOp, bytes32(0), 100_000);
    }

    function _buildUserOp(address routeUser) private view returns (AutoBridgePaymaster.UserOperation memory userOp) {
        RouteTypes.RouteInput memory route = _buildRoute(routeUser);
        bytes memory executorData = abi.encodeWithSelector(WalletExecutor.executeRoute.selector, route);
        bytes memory callData = abi.encodeCall(AutoBridgeAccount.execute, (walletExecutor, 0, executorData));

        RouteTypes.RouteInput memory decoded = _decodeRoute(executorData);
        assertEq(decoded.user, route.user, "route user");
        assertEq(decoded.tokenIn, route.tokenIn, "token in");
        assertEq(decoded.amountIn, route.amountIn, "amount in");

        userOp.sender = smartAccount;
        userOp.callData = callData;
    }

    function _buildRoute(address routeUser) private pure returns (RouteTypes.RouteInput memory route) {
        route.user = routeUser;
        route.tokenIn = address(0xAAA1);
        route.amountIn = 1 ether;

        route.sourceSwap.execute = false;
        route.sourceSwap.poolKey = PoolTypes.PoolKey({
            currency0: address(0xAAA1),
            currency1: address(0xAAA2),
            fee: 3000,
            tickSpacing: 60,
            hooks: address(0)
        });
        route.sourceSwap.swapParams = PoolTypes.SwapParams({zeroForOne: true, amountSpecified: int256(1), sqrtPriceLimitX96: 0});
        route.sourceSwap.bridgeFee = RouteTypes.BridgeFeeConfig({extraFeeBps: 0, maxFeeBps: 0, quoteTimestamp: 0, ttl: 0, nativeFee: 0});
        route.sourceSwap.gasFee = RouteTypes.GasFeeConfig({vault: address(0), skimBps: 0, maxSkimBps: 0});
    }

    function _decodeRoute(bytes memory executorData)
        private
        pure
        returns (RouteTypes.RouteInput memory route)
    {
        require(executorData.length >= 4, "executorData too short");
        bytes memory payload = new bytes(executorData.length - 4);
        for (uint256 i = 4; i < executorData.length; i++) {
            payload[i - 4] = executorData[i];
        }
        route = abi.decode(payload, (RouteTypes.RouteInput));
    }
}
