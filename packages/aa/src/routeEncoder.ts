import { getToken } from '@autobridge/chains';
import type { RoutePlan, SwapLeg } from '@autobridge/routing-schema';
import {
  getAddress,
  isAddress,
  parseUnits,
  zeroAddress,
  type Address,
  type Hex,
} from 'viem';

const ZERO_BYTES = '0x';
const ZERO_BYTES32 = '0x0000000000000000000000000000000000000000000000000000000000000000';
const DEFAULT_POOL_FEE = 3_000;
const DEFAULT_TICK_SPACING = 60;
const DEFAULT_EXTRA_FEE_BPS = 0;
const DEFAULT_MAX_FEE_BPS = 0;
const DEFAULT_GAS_BPS = 0;
const UINT16_MAX = 65_535;

export interface BridgeMetadata {
  nativeFeeWei?: string;
  lzTokenFeeWei?: string;
  dstEid?: number;
  destExecutor?: string;
  options?: Hex;
  pricePayload?: Hex;
}

export interface RouteEncoderEnv {
  POOL_HOOK_ADDRESS?: string;
  NEXT_PUBLIC_POOL_HOOK_ADDRESS?: string;
  POOL_FEE?: string;
  NEXT_PUBLIC_POOL_FEE?: string;
  POOL_TICK_SPACING?: string;
  NEXT_PUBLIC_POOL_TICK_SPACING?: string;
  GAS_VAULT_ADDRESS?: string;
  NEXT_PUBLIC_GAS_VAULT_ADDRESS?: string;
}

export interface WalletExecutorRouteInput {
  user: Address;
  tokenIn: Address;
  amountIn: bigint;
  permit: {
    usePermit: boolean;
    value: bigint;
    deadline: bigint;
    v: number;
    r: Hex;
    s: Hex;
  };
  sourceSwap: {
    execute: boolean;
    poolKey: PoolKeyStruct;
    swapParams: SwapParamsStruct;
    bridgeFee: BridgeFeeConfig;
    gasFee: GasFeeConfig;
    minAmountOut: bigint;
  };
  bridge: {
    dstEid: number;
    destExecutor: Address;
    options: Hex;
    fee: {
      nativeFee: bigint;
      lzTokenFee: bigint;
    };
    refundAddress: Address;
    destPayload: {
      recipient: Address;
      destSwap: DestSwapStruct;
      quoteTimestamp: bigint;
      ttl: bigint;
      pricePayload: Hex;
    };
  };
}

export interface PoolKeyStruct {
  currency0: Address;
  currency1: Address;
  fee: number;
  tickSpacing: number;
  hooks: Address;
}

export interface SwapParamsStruct {
  zeroForOne: boolean;
  amountSpecified: bigint;
  sqrtPriceLimitX96: bigint;
}

export interface BridgeFeeConfig {
  extraFeeBps: number;
  maxFeeBps: number;
  quoteTimestamp: bigint;
  ttl: bigint;
  nativeFee: bigint;
}

export interface GasFeeConfig {
  vault: Address;
  skimBps: number;
  maxSkimBps: number;
}

export interface DestSwapStruct {
  execute: boolean;
  tokenOut: Address;
  poolKey: PoolKeyStruct;
  swapParams: SwapParamsStruct;
  hookData: Hex;
  minAmountOut: bigint;
}

interface PoolConfig {
  fee: number;
  tickSpacing: number;
  hookAddress: Address;
}

function parsePoolConfig(env?: RouteEncoderEnv): PoolConfig {
  const hookEnv = env?.POOL_HOOK_ADDRESS ?? env?.NEXT_PUBLIC_POOL_HOOK_ADDRESS;
  if (!hookEnv || !isAddress(hookEnv)) {
    throw new Error('POOL_HOOK_ADDRESS (or NEXT_PUBLIC_POOL_HOOK_ADDRESS) is required to build route calldata');
  }

  const feeEnv = env?.POOL_FEE ?? env?.NEXT_PUBLIC_POOL_FEE;
  const tickEnv = env?.POOL_TICK_SPACING ?? env?.NEXT_PUBLIC_POOL_TICK_SPACING;

  const fee = feeEnv != null ? Number(feeEnv) : DEFAULT_POOL_FEE;
  const tickSpacing = tickEnv != null ? Number(tickEnv) : DEFAULT_TICK_SPACING;

  if (!Number.isInteger(fee) || fee < 0 || fee > UINT16_MAX) {
    throw new Error(`Invalid pool fee: ${feeEnv}`);
  }
  if (!Number.isInteger(tickSpacing)) {
    throw new Error(`Invalid pool tick spacing: ${tickEnv}`);
  }

  return {
    fee,
    tickSpacing,
    hookAddress: getAddress(hookEnv),
  };
}

function normalizeAddress(value: string | undefined, fallback: Address): Address {
  if (!value) return fallback;
  if (!isAddress(value)) return fallback;
  return getAddress(value);
}

function derivePoolKey(
  inputToken: Address,
  outputToken: Address,
  config: PoolConfig,
): PoolKeyStruct {
  const currency0 = inputToken.toLowerCase() < outputToken.toLowerCase() ? inputToken : outputToken;
  const currency1 = currency0 === inputToken ? outputToken : inputToken;
  return {
    currency0: getAddress(currency0),
    currency1: getAddress(currency1),
    fee: config.fee,
    tickSpacing: config.tickSpacing,
    hooks: config.hookAddress,
  };
}

function deriveSwapParams(
  poolKey: PoolKeyStruct,
  inputToken: Address,
  amountIn: bigint,
  sqrtPriceLimit?: string,
): SwapParamsStruct {
  const zeroForOne = inputToken.toLowerCase() === poolKey.currency0.toLowerCase();
  const limit = sqrtPriceLimit ? BigInt(sqrtPriceLimit) : 0n;
  return {
    zeroForOne,
    amountSpecified: amountIn,
    sqrtPriceLimitX96: limit,
  };
}

function parseBridgeMetadata(metadata?: Record<string, unknown>): BridgeMetadata {
  if (!metadata) return {};
  return {
    nativeFeeWei: typeof metadata.nativeFeeWei === 'string' ? metadata.nativeFeeWei : undefined,
    lzTokenFeeWei: typeof metadata.lzTokenFeeWei === 'string' ? metadata.lzTokenFeeWei : undefined,
    dstEid: typeof metadata.dstEid === 'number' ? metadata.dstEid : undefined,
    destExecutor: typeof metadata.destExecutor === 'string' ? metadata.destExecutor : undefined,
    options: typeof metadata.options === 'string' ? (metadata.options as Hex) : undefined,
    pricePayload: typeof metadata.pricePayload === 'string' ? (metadata.pricePayload as Hex) : undefined,
  };
}

function parseAmount(amount: string, decimals: number): bigint {
  return parseUnits(amount, decimals);
}

function selectTokenAddress(chainSlug: string, symbol: string): Address {
  const token = getToken(chainSlug as never, symbol);
  if (!token?.address || !isAddress(token.address)) {
    throw new Error(`Token ${symbol} has no configured address for ${chainSlug}`);
  }
  return getAddress(token.address);
}

function buildDestSwap(
  chainSlug: string,
  leg: SwapLeg | undefined,
  poolConfig: PoolConfig,
): DestSwapStruct {
  if (!leg) {
    return {
      execute: false,
      tokenOut: zeroAddress,
      poolKey: {
        currency0: zeroAddress,
        currency1: zeroAddress,
        fee: poolConfig.fee,
        tickSpacing: poolConfig.tickSpacing,
        hooks: poolConfig.hookAddress,
      },
      swapParams: {
        zeroForOne: true,
        amountSpecified: 0n,
        sqrtPriceLimitX96: 0n,
      },
      hookData: ZERO_BYTES,
      minAmountOut: 0n,
    };
  }

  const tokenIn = selectTokenAddress(chainSlug, leg.tokenIn);
  const tokenOut = selectTokenAddress(chainSlug, leg.tokenOut);
  const poolKey = derivePoolKey(tokenIn, tokenOut, poolConfig);
  const amountIn = parseAmount(leg.amountIn, getToken(chainSlug as never, leg.tokenIn).decimals);
  const swapParams = deriveSwapParams(poolKey, tokenIn, amountIn, leg.sqrtPriceLimitX96);
  const minAmountOut = parseAmount(leg.minAmountOut, getToken(chainSlug as never, leg.tokenOut).decimals);

  return {
    execute: true,
    tokenOut,
    poolKey,
    swapParams,
    hookData: ZERO_BYTES,
    minAmountOut,
  };
}

export interface BuildRouteInputParams {
  chainSlug: string;
  owner: Address;
  paymaster: Address;
  plan: RoutePlan;
  env?: RouteEncoderEnv;
  smartAccount: Address;
}

export function buildWalletExecutorRoute({
  chainSlug,
  owner,
  paymaster,
  plan,
  env,
  smartAccount,
}: BuildRouteInputParams): WalletExecutorRouteInput {
  const poolConfig = parsePoolConfig(env);
  const tokenInAddress = selectTokenAddress(chainSlug, plan.tokenIn);
  const tokenOutAddress = selectTokenAddress(chainSlug, plan.sourceSwap.tokenOut);
  const amountIn = parseAmount(plan.amountIn, getToken(chainSlug as never, plan.tokenIn).decimals);
  const swapAmountIn = parseAmount(
    plan.sourceSwap.amountIn,
    getToken(chainSlug as never, plan.sourceSwap.tokenIn).decimals,
  );

  const poolKey = derivePoolKey(tokenInAddress, tokenOutAddress, poolConfig);
  const swapParams = deriveSwapParams(poolKey, tokenInAddress, swapAmountIn, plan.sourceSwap.sqrtPriceLimitX96);
  const minAmountOut = parseAmount(
    plan.sourceSwap.minAmountOut,
    getToken(chainSlug as never, plan.sourceSwap.tokenOut).decimals,
  );

  const hookConfig = plan.sourceSwap.hooks;
  const bridgeAware = hookConfig?.bridgeAwareFee;
  const gasShield = hookConfig?.gasShield;

  const metadata = parseBridgeMetadata(plan.bridge.metadata as Record<string, unknown> | undefined);

  const nativeFee = metadata.nativeFeeWei ? BigInt(metadata.nativeFeeWei) : 0n;
  const lzTokenFee = metadata.lzTokenFeeWei ? BigInt(metadata.lzTokenFeeWei) : 0n;

  const gasVaultEnv = env?.GAS_VAULT_ADDRESS ?? env?.NEXT_PUBLIC_GAS_VAULT_ADDRESS;
  const gasVault = normalizeAddress(gasShield?.gasVault, gasVaultEnv ? getAddress(gasVaultEnv) : paymaster);

  const destExecutor = normalizeAddress(metadata.destExecutor, zeroAddress);

  const destinationSwap = buildDestSwap(plan.dstChain, plan.destinationSwap, poolConfig);

  const quoteTimestamp = BigInt(Math.floor((plan.quote?.priceTimestamp ?? plan.createdAt) ?? Date.now() / 1000));
  const ttlSeconds = Math.max(0, Math.floor((plan.expiresAt - plan.createdAt) / 1000));

  const routeUser = smartAccount ?? owner;

  return {
    user: routeUser,
    tokenIn: tokenInAddress,
    amountIn,
    permit: {
      usePermit: false,
      value: 0n,
      deadline: 0n,
      v: 0,
      r: ZERO_BYTES32,
      s: ZERO_BYTES32,
    },
    sourceSwap: {
      execute: plan.sourceSwap.tokenIn !== plan.sourceSwap.tokenOut,
      poolKey,
      swapParams,
      bridgeFee: {
        extraFeeBps: bridgeAware?.extraFeeBps ?? DEFAULT_EXTRA_FEE_BPS,
        maxFeeBps: bridgeAware?.maxFeeBps ?? DEFAULT_MAX_FEE_BPS,
        quoteTimestamp: BigInt(bridgeAware?.priceTimestamp ?? quoteTimestamp),
        ttl: BigInt(bridgeAware?.ttlSeconds ?? ttlSeconds),
        nativeFee,
      },
      gasFee: {
        vault: gasVault,
        skimBps: gasShield?.skimBps ?? DEFAULT_GAS_BPS,
        maxSkimBps: Math.max(gasShield?.skimBps ?? DEFAULT_GAS_BPS, 100), // Allow up to 1% max skim
      },
      minAmountOut,
    },
    bridge: {
      dstEid: metadata.dstEid ?? 0,
      destExecutor,
      options: metadata.options ?? ZERO_BYTES,
      fee: {
        nativeFee,
        lzTokenFee,
      },
      refundAddress: routeUser,
      destPayload: {
        recipient: getAddress(plan.recipient),
        destSwap: destinationSwap,
        quoteTimestamp,
        ttl: BigInt(ttlSeconds),
        pricePayload: metadata.pricePayload ?? ZERO_BYTES,
      },
    },
  };
}
