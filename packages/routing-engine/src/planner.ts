import { getChain, getToken } from '@autobridge/chains';
import { routePlanSchema, type RoutePlan, type SwapLeg } from '@autobridge/routing-schema';

import { DEFAULT_EXTRA_FEE_BPS, DEFAULT_GAS_VAULT_BPS, DEFAULT_SLIPPAGE_BPS, DEFAULT_TTL_SECONDS } from './constants.js';
import type { QuoteContext, RouteRequest } from './types.js';

const BPS_DENOMINATOR = 10_000n;

function assertAmountString(amount: string): void {
  if (!/^[0-9]+(\.[0-9]+)?$/.test(amount)) {
    throw new Error(`Invalid amount: ${amount}`);
  }
  const numericValue = parseFloat(amount);
  if (numericValue <= 0) {
    throw new Error(`Amount must be positive: ${amount}`);
  }
}

function pow10(decimals: number): bigint {
  return 10n ** BigInt(decimals);
}

function parseUnits(amount: string, decimals: number): bigint {
  assertAmountString(amount);
  const [integerPart, fractionPart = ''] = amount.split('.');
  if (fractionPart.length > decimals) {
    throw new Error(`Invalid amount: ${amount} (more than ${decimals} decimal places)`);
  }
  const integer = BigInt(integerPart);
  const scale = pow10(decimals);
  const fraction = fractionPart.length > 0 ? BigInt(fractionPart.padEnd(decimals, '0')) : 0n;
  return integer * scale + fraction;
}

function formatUnits(value: bigint, decimals: number): string {
  const scale = pow10(decimals);
  const integer = value / scale;
  const fraction = value % scale;
  if (fraction === 0n) {
    return integer.toString();
  }
  const fractionStr = fraction.toString().padStart(decimals, '0').replace(/0+$/, '');
  return `${integer.toString()}.${fractionStr}`;
}

function scaleDecimals(value: bigint, fromDecimals: number, toDecimals: number): bigint {
  if (fromDecimals === toDecimals) {
    return value;
  }
  if (fromDecimals < toDecimals) {
    const factor = pow10(toDecimals - fromDecimals);
    return value * factor;
  }
  const divisor = pow10(fromDecimals - toDecimals);
  return value / divisor;
}

function applyBpsUnits(value: bigint, bps: number): bigint {
  const numerator = BigInt(10_000 - bps);
  return (value * numerator) / BPS_DENOMINATOR;
}

function buildSwapLeg(params: {
  chainSlug: string;
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
  minAmountOut: string;
  notes?: string[];
}): SwapLeg {
  return {
    chainSlug: params.chainSlug,
    dex: 'uniswap-v4',
    poolId: `${params.tokenIn}-${params.tokenOut}`.toLowerCase(),
    tokenIn: params.tokenIn,
    tokenOut: params.tokenOut,
    amountIn: params.amountIn,
    minAmountOut: params.minAmountOut,
    hooks: {
      bridgeAwareFee: {
        extraFeeBps: DEFAULT_EXTRA_FEE_BPS,
        maxFeeBps: DEFAULT_EXTRA_FEE_BPS * 2,
        priceTimestamp: Math.floor(Date.now() / 1000),
        ttlSeconds: DEFAULT_TTL_SECONDS,
      },
      gasShield: {
        skimBps: DEFAULT_GAS_VAULT_BPS,
        gasVault: '0x0000000000000000000000000000000000000000',
      },
    },
    notes: params.notes,
  };
}

export function buildMockRoutePlan(request: RouteRequest, context: QuoteContext = {}): RoutePlan {
  const now = context.now ?? Date.now();
  const expiresAt = now + DEFAULT_TTL_SECONDS * 1000;

  // Ensure chains exist
  const srcChain = getChain(request.srcChain as never);
  const dstChain = getChain(request.dstChain as never);
  const bridgeTokenSymbol = context.bridgeToken ?? 'USDX';

  const srcToken = getToken(request.srcChain as never, request.tokenIn);
  const dstToken = getToken(request.dstChain as never, request.tokenOut);
  const srcBridgeToken = getToken(request.srcChain as never, bridgeTokenSymbol);
  const dstBridgeToken = getToken(request.dstChain as never, bridgeTokenSymbol);

  const amountInSourceUnits = parseUnits(request.amountIn, srcToken.decimals);
  const totalFeeBps = DEFAULT_EXTRA_FEE_BPS + DEFAULT_GAS_VAULT_BPS;
  const amountInBridgeUnits = scaleDecimals(amountInSourceUnits, srcToken.decimals, srcBridgeToken.decimals);
  const bridgeAmountAfterFees = applyBpsUnits(amountInBridgeUnits, totalFeeBps);
  const bridgeAmountSourceUnits = scaleDecimals(bridgeAmountAfterFees, srcBridgeToken.decimals, srcToken.decimals);
  const feeAmountSourceUnits = amountInSourceUnits - bridgeAmountSourceUnits;

  const destBridgeAmountUnits = scaleDecimals(bridgeAmountAfterFees, srcBridgeToken.decimals, dstBridgeToken.decimals);
  const bridgeMinAmountUnits = applyBpsUnits(destBridgeAmountUnits, DEFAULT_SLIPPAGE_BPS);

  const destSwapIdealUnits = scaleDecimals(destBridgeAmountUnits, dstBridgeToken.decimals, dstToken.decimals);
  const destSwapMinUnits = applyBpsUnits(destSwapIdealUnits, DEFAULT_SLIPPAGE_BPS);

  const sourceSwap = buildSwapLeg({
    chainSlug: request.srcChain,
    tokenIn: request.tokenIn,
    tokenOut: bridgeTokenSymbol,
    amountIn: request.amountIn,
    minAmountOut: formatUnits(bridgeAmountAfterFees, srcBridgeToken.decimals),
    notes: [`Swap on ${srcChain.name}`],
  });

  const destinationSwap = buildSwapLeg({
    chainSlug: request.dstChain,
    tokenIn: bridgeTokenSymbol,
    tokenOut: request.tokenOut,
    amountIn: formatUnits(destBridgeAmountUnits, dstBridgeToken.decimals),
    minAmountOut: formatUnits(destSwapMinUnits, dstToken.decimals),
    notes: [`Swap on ${dstChain.name}`],
  });

  const bridge = {
    protocol: 'layerzero-v2' as const,
    oft: bridgeTokenSymbol === 'USDX',
    srcChain: request.srcChain,
    dstChain: request.dstChain,
    token: bridgeTokenSymbol,
    amount: formatUnits(bridgeAmountAfterFees, srcBridgeToken.decimals),
    minAmountOut: formatUnits(bridgeMinAmountUnits, dstBridgeToken.decimals),
    recipient: request.recipient,
    destToken: bridgeTokenSymbol,
    slippageBps: DEFAULT_SLIPPAGE_BPS,
    fee: {
      token: request.tokenIn,
      amount: formatUnits(feeAmountSourceUnits, srcToken.decimals),
      source: 'embedded' as const,
    },
  };

  const plan: RoutePlan = {
    id: `mock-${now}`,
    createdAt: now,
    expiresAt,
    srcChain: request.srcChain,
    dstChain: request.dstChain,
    tokenIn: request.tokenIn,
    tokenOut: request.tokenOut,
    amountIn: request.amountIn,
    recipient: request.recipient,
    sourceSwap,
    bridge,
    destinationSwap,
    quote: {
      amountOut: destinationSwap.minAmountOut,
      minAmountOut: destinationSwap.minAmountOut,
      extraFeeBps: DEFAULT_EXTRA_FEE_BPS,
      gasVaultBps: DEFAULT_GAS_VAULT_BPS,
      priceTimestamp: Math.floor(now / 1000),
    },
  };

  const parsed = routePlanSchema.parse(plan);
  return parsed;
}
