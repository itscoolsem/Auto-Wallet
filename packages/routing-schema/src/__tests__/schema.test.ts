import { describe, expect, it } from 'vitest';

import { bridgePayloadSchema, routePlanSchema, swapLegSchema } from '../schema.js';

const sampleSwap = {
  chainSlug: 'base-sepolia',
  dex: 'uniswap-v4' as const,
  poolId: 'weth-usdcx',
  tokenIn: 'WETH',
  tokenOut: 'USDX',
  amountIn: '1.0',
  minAmountOut: '1999',
  hooks: {
    bridgeAwareFee: {
      extraFeeBps: 40,
      maxFeeBps: 80,
      priceTimestamp: 1_700_000_000,
      ttlSeconds: 60,
    },
    gasShield: {
      skimBps: 15,
      gasVault: '0xvault',
    },
  },
};

const sampleBridge = {
  protocol: 'layerzero-v2' as const,
  oft: true,
  srcChain: 'base-sepolia',
  dstChain: 'optimism-sepolia',
  token: 'USDX',
  amount: '1999',
  minAmountOut: '1980',
  recipient: '0xrecipient',
  destToken: 'USDCx',
  slippageBps: 50,
  fee: {
    token: 'USDX',
    amount: '0.5',
    source: 'embedded' as const,
  },
};

describe('routing schema', () => {
  it('validates swap leg', () => {
    expect(() => swapLegSchema.parse(sampleSwap)).not.toThrow();
  });

  it('validates bridge payload', () => {
    expect(() => bridgePayloadSchema.parse(sampleBridge)).not.toThrow();
  });

  it('validates route plan', () => {
    const plan = {
      id: 'route-123',
      createdAt: Date.now(),
      expiresAt: Date.now() + 60_000,
      srcChain: 'base-sepolia',
      dstChain: 'optimism-sepolia',
      tokenIn: 'WETH',
      tokenOut: 'USDCx',
      amountIn: '1.0',
      recipient: '0xrecipient',
      sourceSwap: sampleSwap,
      bridge: sampleBridge,
      destinationSwap: {
        ...sampleSwap,
        chainSlug: 'optimism-sepolia',
        tokenIn: 'USDX',
        tokenOut: 'USDCx',
      },
      quote: {
        amountOut: '2000',
        minAmountOut: '1980',
        extraFeeBps: 40,
        gasVaultBps: 10,
        priceTimestamp: 1_700_000_000,
      },
    };

    const result = routePlanSchema.safeParse(plan);
    expect(result.success).toBe(true);
  });

  it('fails for invalid bps', () => {
    const invalid = {
      ...sampleSwap,
      hooks: {
        bridgeAwareFee: {
          extraFeeBps: 20_000,
          maxFeeBps: 20_000,
          priceTimestamp: 0,
          ttlSeconds: 60,
        },
      },
    };

    const result = swapLegSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });
});
