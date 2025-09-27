import { z } from 'zod';

export const basisPointsSchema = z
  .number()
  .int({ message: 'value must be an integer' })
  .min(0, { message: 'value must be >= 0' })
  .max(10_000, { message: 'value must be <= 10000 (100%)' });

export const amountSchema = z
  .string()
  .regex(/^[0-9]+(\.[0-9]+)?$/, { message: 'amount must be a decimal string' });

export const hookConfigSchema = z.object({
  bridgeAwareFee: z
    .object({
      extraFeeBps: basisPointsSchema,
      maxFeeBps: basisPointsSchema,
      priceTimestamp: z.number().int().nonnegative(),
      ttlSeconds: z.number().int().positive(),
    })
    .optional(),
  gasShield: z
    .object({
      skimBps: basisPointsSchema.max(500),
      gasVault: z.string().min(1),
    })
    .optional(),
});

export const swapLegSchema = z.object({
  chainSlug: z.string().min(1),
  dex: z.literal('uniswap-v4'),
  poolId: z.string().min(1),
  tokenIn: z.string().min(1),
  tokenOut: z.string().min(1),
  amountIn: amountSchema,
  minAmountOut: amountSchema,
  sqrtPriceLimitX96: z.string().optional(),
  hooks: hookConfigSchema.optional(),
  notes: z.array(z.string()).optional(),
});

export const bridgeFeeSchema = z.object({
  token: z.string().min(1),
  amount: amountSchema,
  source: z.enum(['embedded', 'sponsor', 'user']).default('embedded'),
});

export const bridgePayloadSchema = z.object({
  protocol: z.enum(['layerzero-v2', 'local-demo']),
  oft: z.boolean().default(false),
  srcChain: z.string().min(1),
  dstChain: z.string().min(1),
  token: z.string().min(1),
  amount: amountSchema,
  minAmountOut: amountSchema,
  recipient: z.string().min(1),
  destToken: z.string().min(1),
  slippageBps: basisPointsSchema,
  metadata: z.record(z.unknown()).optional(),
  fee: bridgeFeeSchema.optional(),
});

export const quoteBreakdownSchema = z.object({
  amountOut: amountSchema,
  minAmountOut: amountSchema,
  extraFeeBps: basisPointsSchema,
  gasVaultBps: basisPointsSchema,
  bridgeFeeUsd: z.number().nonnegative().optional(),
  priceTimestamp: z.number().int().nonnegative(),
});

export const routePlanSchema = z.object({
  id: z.string().optional(),
  createdAt: z.number().int().nonnegative(),
  expiresAt: z.number().int().positive(),
  srcChain: z.string().min(1),
  dstChain: z.string().min(1),
  tokenIn: z.string().min(1),
  tokenOut: z.string().min(1),
  amountIn: amountSchema,
  recipient: z.string().min(1),
  sourceSwap: swapLegSchema,
  bridge: bridgePayloadSchema,
  destinationSwap: swapLegSchema.optional(),
  quote: quoteBreakdownSchema,
  warnings: z.array(z.string()).optional(),
});

export type RoutePlan = z.infer<typeof routePlanSchema>;
export type SwapLeg = z.infer<typeof swapLegSchema>;
export type BridgePayload = z.infer<typeof bridgePayloadSchema>;
