// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";

import {IERC20} from "../src/interfaces/IERC20.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {PoolId} from "@uniswap/v4-core/src/types/PoolId.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {StateLibrary} from "@uniswap/v4-core/src/libraries/StateLibrary.sol";
import {TickMath} from "@uniswap/v4-core/src/libraries/TickMath.sol";
import {LiquidityAmounts} from "@uniswap/v4-periphery/src/libraries/LiquidityAmounts.sol";
import {ModifyLiquidityParams} from "@uniswap/v4-core/src/types/PoolOperation.sol";
import {PoolModifyLiquidityTest} from "@uniswap/v4-core/src/test/PoolModifyLiquidityTest.sol";

contract SeedUsdXWethPool is Script {
    using StateLibrary for IPoolManager;

    struct SortedTokens {
        address token0;
        address token1;
        uint256 amount0;
        uint256 amount1;
    }

    function run() external {
        uint256 deployerPk = vm.envUint("PRIVATE_KEY");
        address poolManagerAddr = vm.envAddress("POOL_MANAGER");
        address usdX = vm.envAddress("USDX_ADDRESS");
        address weth = vm.envAddress("WETH_ADDRESS");
        address hookAddress = vm.envOr("POOL_HOOK_ADDRESS", address(0));
        uint24 fee = uint24(vm.envOr("POOL_FEE", uint256(3000)));
        int24 tickSpacing = int24(int256(vm.envOr("POOL_TICK_SPACING", uint256(60))));
        uint160 sqrtPriceX96 = uint160(vm.envUint("INITIAL_SQRT_PRICE_X96"));
        uint256 amountToken0Input = vm.envUint("AMOUNT_TOKEN0");
        uint256 amountToken1Input = vm.envUint("AMOUNT_TOKEN1");

        SortedTokens memory sorted = _sortTokens(usdX, weth, amountToken0Input, amountToken1Input);

        Currency currency0 = Currency.wrap(sorted.token0);
        Currency currency1 = Currency.wrap(sorted.token1);

        PoolKey memory key = PoolKey({
            currency0: currency0,
            currency1: currency1,
            fee: fee,
            tickSpacing: tickSpacing,
            hooks: IHooks(hookAddress)
        });

        int24 tickLower = _defaultLower(tickSpacing);
        int24 tickUpper = _defaultUpper(tickSpacing);

        if (vm.envExists("TICK_LOWER")) {
            tickLower = int24(vm.envInt("TICK_LOWER"));
        }
        if (vm.envExists("TICK_UPPER")) {
            tickUpper = int24(vm.envInt("TICK_UPPER"));
        }

        _validateTick(tickLower, tickSpacing);
        _validateTick(tickUpper, tickSpacing);
        require(tickLower < tickUpper, "Invalid tick range");

        vm.startBroadcast(deployerPk);
        IPoolManager poolManager = IPoolManager(poolManagerAddr);

        PoolId id = key.toId();
        uint160 currentPrice = _getSqrtPrice(poolManager, id);
        if (currentPrice == 0) {
            poolManager.initialize(key, sqrtPriceX96);
            console2.log("Initialized pool with sqrtPriceX96", sqrtPriceX96);
        } else {
            console2.log("Pool already initialized with sqrtPriceX96", currentPrice);
        }

        PoolModifyLiquidityTest router = new PoolModifyLiquidityTest(poolManager);
        console2.log("PoolModifyLiquidityTest", address(router));
        console2.log("currency0", sorted.token0);
        console2.log("currency1", sorted.token1);

        IERC20(sorted.token0).approve(address(router), sorted.amount0);
        IERC20(sorted.token1).approve(address(router), sorted.amount1);

        uint160 sqrtPriceLowerX96 = TickMath.getSqrtPriceAtTick(tickLower);
        uint160 sqrtPriceUpperX96 = TickMath.getSqrtPriceAtTick(tickUpper);
        uint128 liquidity = LiquidityAmounts.getLiquidityForAmounts(
            sqrtPriceX96,
            sqrtPriceLowerX96,
            sqrtPriceUpperX96,
            sorted.amount0,
            sorted.amount1
        );
        require(liquidity > 0, "Liquidity zero");

        ModifyLiquidityParams memory params = ModifyLiquidityParams({
            tickLower: tickLower,
            tickUpper: tickUpper,
            liquidityDelta: int128(int256(uint256(liquidity))),
            salt: 0
        });

        router.modifyLiquidity(key, params, new bytes(0));

        vm.stopBroadcast();

        console2.log("Seeded pool", Currency.unwrap(currency0), Currency.unwrap(currency1));
        console2.log("Liquidity provided", liquidity);
    }

    function _getSqrtPrice(IPoolManager poolManager, PoolId id) private view returns (uint160) {
        (uint160 sqrtPrice,,,) = poolManager.getSlot0(id);
        return sqrtPrice;
    }

    function _sortTokens(address a, address b, uint256 amountA, uint256 amountB)
        private
        pure
        returns (SortedTokens memory result)
    {
        if (a < b) {
            result = SortedTokens({token0: a, token1: b, amount0: amountA, amount1: amountB});
        } else {
            result = SortedTokens({token0: b, token1: a, amount0: amountB, amount1: amountA});
        }
    }

    function _validateTick(int24 tick, int24 spacing) private pure {
        require(spacing > 0, "Invalid spacing");
        int24 remainder = tick % spacing;
        if (remainder < 0) remainder += spacing;
        require(remainder == 0, "Tick not aligned");
    }

    function _defaultLower(int24 spacing) private pure returns (int24) {
        return -spacing * 500;
    }

    function _defaultUpper(int24 spacing) private pure returns (int24) {
        return spacing * 500;
    }
}
