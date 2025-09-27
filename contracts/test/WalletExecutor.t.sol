// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Test} from "forge-std/Test.sol";

import {WalletExecutor} from "../src/core/WalletExecutor.sol";
import {BridgeSender} from "../src/bridge/BridgeSender.sol";
import {BridgeMessages} from "../src/bridge/BridgeMessages.sol";
import {RouteTypes} from "../src/core/RouteTypes.sol";
import {IUSDXOFT} from "../src/interfaces/IUSDXOFT.sol";
import {ILayerZeroEndpointV2} from "../src/interfaces/ILayerZeroEndpointV2.sol";
import {ERC20Base} from "../src/tokens/ERC20Base.sol";
import {SafeTransferLib} from "../src/utils/SafeTransferLib.sol";
import {IPoolManager} from "../src/uniswap/IPoolManager.sol";
import {PoolTypes} from "../src/uniswap/PoolTypes.sol";
import {UniswapSourceSwapAdapter} from "../src/adapters/UniswapSourceSwapAdapter.sol";

contract MockUSDX is ERC20Base, IUSDXOFT {
    uint64 public nonce;
    mapping(uint32 => bytes32) public peers;

    constructor() ERC20Base("USDX", "USDX", 18) {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function send(SendParam calldata param, address payable)
        external
        payable
        override
        returns (SendResult memory result)
    {
        _burn(msg.sender, param.amount);
        bytes32 messageId = keccak256(abi.encode(++nonce, param.dstEid, param.to, param.amount, param.payload));
        result = SendResult({messageId: messageId, amountSent: param.amount});
    }

    function setPeer(uint32 eid, bytes32 peerAddr) external override {
        peers[eid] = peerAddr;
    }

    function peer(uint32 eid) external view override returns (bytes32) {
        return peers[eid];
    }
}

contract MockBridgeSender is BridgeSender {
    using SafeTransferLib for address;

    uint256 public lastAmount;
    address public lastDestExecutor;
    bytes public lastPayload;
    bytes32 public lastMessageId;

    constructor(address owner_, IUSDXOFT usdX_) BridgeSender(owner_, usdX_) {}

    function bridge(BridgeRequest calldata request) public payable override returns (bytes32 messageId) {
        lastAmount = request.amount;
        lastDestExecutor = request.destExecutor;
        lastPayload = abi.encode(request.destPayload);

        address token = address(usdX);
        token.safeTransferFrom(msg.sender, address(this), request.amount);

        IUSDXOFT.SendParam memory param = IUSDXOFT.SendParam({
            dstEid: request.dstEid,
            to: bytes32(uint256(uint160(request.destExecutor))),
            amount: request.amount,
            payload: abi.encode(request.destPayload),
            options: request.options,
            fee: request.fee
        });

        IUSDXOFT.SendResult memory result = usdX.send{value: msg.value}(param, request.refundAddress);
        lastMessageId = result.messageId;
        emit BridgeInitiated(
            result.messageId, request.dstEid, request.destExecutor, request.amount, request.destPayload.recipient
        );
        return result.messageId;
    }
}

contract MockERC20 is ERC20Base {
    constructor(string memory name_, string memory symbol_, uint8 decimals_) ERC20Base(name_, symbol_, decimals_) {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract MockPoolManager is IPoolManager {
    using SafeTransferLib for address;

    address public immutable token0;
    address public immutable token1;

    uint256 public expectedInput;
    uint256 public expectedOutput;
    uint256 public swapCount;
    bytes public lastHookData;

    constructor(address token0_, address token1_) {
        token0 = token0_;
        token1 = token1_;
    }

    function configure(uint256 expectedInput_, uint256 expectedOutput_) external {
        expectedInput = expectedInput_;
        expectedOutput = expectedOutput_;
    }

    function swap(PoolTypes.PoolKey calldata key, PoolTypes.SwapParams calldata params, bytes calldata hookData)
        external
        override
        returns (PoolTypes.BalanceDelta memory delta)
    {
        swapCount += 1;
        lastHookData = hookData;

        address inputToken = params.zeroForOne ? key.currency0 : key.currency1;
        address outputToken = params.zeroForOne ? key.currency1 : key.currency0;

        uint256 amountSpecified = params.amountSpecified >= 0
            ? uint256(params.amountSpecified)
            : expectedInput;

        if (expectedInput != 0) {
            amountSpecified = expectedInput;
        }

        inputToken.safeTransferFrom(msg.sender, address(this), amountSpecified);
        outputToken.safeTransfer(msg.sender, expectedOutput);

        if (params.zeroForOne) {
            delta.amount0 = -int128(int256(amountSpecified));
            delta.amount1 = int128(int256(expectedOutput));
        } else {
            delta.amount0 = int128(int256(expectedOutput));
            delta.amount1 = -int128(int256(amountSpecified));
        }

        return delta;
    }
}

contract WalletExecutorTest is Test {
    MockUSDX usdX;
    MockBridgeSender bridgeSender;
    WalletExecutor executor;

    address user = address(0xBEEF);
    address gasVault = address(0xCAFE);
    address destExecutor = address(0x1234);

    function setUp() public {
        usdX = new MockUSDX();
        bridgeSender = new MockBridgeSender(address(this), usdX);
        executor = new WalletExecutor(address(this), address(usdX), bridgeSender);

        bridgeSender.setWalletExecutor(address(executor));
        executor.setSmartAccount(address(this));
    }

    function testExecuteRouteSkimsGasAndBridges() public {
        uint256 amountIn = 1_000 ether;
        usdX.mint(user, amountIn);

        vm.prank(user);
        usdX.approve(address(executor), amountIn);

        RouteTypes.RouteInput memory route;
        route.user = user;
        route.tokenIn = address(usdX);
        route.amountIn = amountIn;

        route.sourceSwap.execute = false;
        route.sourceSwap.minAmountOut = amountIn;
        route.sourceSwap.bridgeFee = RouteTypes.BridgeFeeConfig({
            extraFeeBps: 50,
            maxFeeBps: 100,
            quoteTimestamp: uint64(block.timestamp),
            ttl: 120,
            nativeFee: uint128(0.01 ether)
        });
        route.sourceSwap.gasFee = RouteTypes.GasFeeConfig({vault: gasVault, skimBps: 200, maxSkimBps: 500});

        BridgeMessages.DestPayload memory destPayload;
        destPayload.recipient = address(0xB0B);
        destPayload.destSwap.execute = false;
        destPayload.quoteTimestamp = uint64(block.timestamp);
        destPayload.ttl = 0;

        route.bridge = RouteTypes.BridgeParams({
            dstEid: 30109,
            destExecutor: destExecutor,
            options: bytes(""),
            fee: ILayerZeroEndpointV2.MessagingFee({nativeFee: uint128(0.01 ether), lzTokenFee: 0}),
            refundAddress: payable(address(0)),
            destPayload: destPayload
        });

        bytes32 messageId = executor.executeRoute{value: 0.01 ether}(route);
        assertTrue(messageId != bytes32(0), "message id should be set");

        uint256 expectedSkim = (amountIn * route.sourceSwap.gasFee.skimBps) / 10_000;
        assertEq(usdX.balanceOf(gasVault), expectedSkim, "gas vault skim incorrect");

        uint256 expectedBridgeAmount = amountIn - expectedSkim;
        assertEq(bridgeSender.lastAmount(), expectedBridgeAmount, "bridge amount incorrect");
        assertEq(bridgeSender.lastDestExecutor(), destExecutor, "dest executor mismatch");
        assertEq(usdX.balanceOf(address(bridgeSender)), 0, "bridge sender balance should be zero after burn");
        assertEq(usdX.balanceOf(address(executor)), 0, "executor should not retain funds");
        assertEq(usdX.balanceOf(user), 0, "user balance should be spent");
    }

    function testExecuteRouteWithSourceSwap() public {
        uint256 amountIn = 1_000 ether;
        uint256 expectedOutput = 950 ether;

        MockERC20 weth = new MockERC20("Wrapped ETH", "WETH", 18);
        weth.mint(user, amountIn);

        MockPoolManager poolManager = new MockPoolManager(address(weth), address(usdX));
        poolManager.configure(amountIn, expectedOutput);

        UniswapSourceSwapAdapter adapter = new UniswapSourceSwapAdapter(IPoolManager(address(poolManager)));
        executor.setSwapAdapter(adapter);

        // Seed the pool manager with USDX so it can pay out the swap.
        usdX.mint(address(poolManager), expectedOutput);

        vm.prank(user);
        weth.approve(address(executor), amountIn);

        RouteTypes.RouteInput memory route;
        route.user = user;
        route.tokenIn = address(weth);
        route.amountIn = amountIn;

        route.sourceSwap.execute = true;
        route.sourceSwap.poolKey = PoolTypes.PoolKey({
            currency0: address(weth),
            currency1: address(usdX),
            fee: 3_000,
            tickSpacing: 60,
            hooks: address(0)
        });
        route.sourceSwap.swapParams = PoolTypes.SwapParams({
            zeroForOne: true,
            amountSpecified: int256(amountIn),
            sqrtPriceLimitX96: 0
        });
        route.sourceSwap.bridgeFee = RouteTypes.BridgeFeeConfig({
            extraFeeBps: 75,
            maxFeeBps: 150,
            quoteTimestamp: uint64(block.timestamp),
            ttl: 180,
            nativeFee: uint128(0.01 ether)
        });
        route.sourceSwap.gasFee = RouteTypes.GasFeeConfig({vault: gasVault, skimBps: 150, maxSkimBps: 500});
        route.sourceSwap.minAmountOut = expectedOutput;

        BridgeMessages.DestPayload memory destPayload;
        destPayload.recipient = address(0xB0B);
        destPayload.destSwap.execute = false;
        destPayload.quoteTimestamp = uint64(block.timestamp);
        destPayload.ttl = 0;

        route.bridge = RouteTypes.BridgeParams({
            dstEid: 30109,
            destExecutor: destExecutor,
            options: bytes(""),
            fee: ILayerZeroEndpointV2.MessagingFee({nativeFee: uint128(0.01 ether), lzTokenFee: 0}),
            refundAddress: payable(address(0)),
            destPayload: destPayload
        });

        bytes32 messageId = executor.executeRoute{value: 0.01 ether}(route);
        assertTrue(messageId != bytes32(0), "message id should be set");

        assertEq(poolManager.swapCount(), 1, "swap not executed");

        RouteTypes.HookData memory hookData = abi.decode(poolManager.lastHookData(), (RouteTypes.HookData));
        assertEq(hookData.bridgeFee.extraFeeBps, route.sourceSwap.bridgeFee.extraFeeBps, "bridge hook data mismatch");
        assertEq(hookData.gasFee.skimBps, route.sourceSwap.gasFee.skimBps, "gas hook data mismatch");

        uint256 expectedSkim = (expectedOutput * route.sourceSwap.gasFee.skimBps) / 10_000;
        assertEq(usdX.balanceOf(gasVault), expectedSkim, "gas vault skim incorrect");

        uint256 expectedBridgeAmount = expectedOutput - expectedSkim;
        assertEq(bridgeSender.lastAmount(), expectedBridgeAmount, "bridge amount incorrect");
        assertEq(usdX.balanceOf(address(executor)), 0, "executor should not retain USDX");
        assertEq(weth.balanceOf(address(poolManager)), amountIn, "pool manager did not receive input token");
    }
}
