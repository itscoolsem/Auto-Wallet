import { describe, expect, it } from 'vitest';

import { routePlanSchema } from '@autobridge/routing-schema';

import { buildMockRoutePlan } from '../planner.js';

const request = {
  srcChain: 'base-sepolia',
  dstChain: 'optimism-sepolia',
  tokenIn: 'WETH',
  tokenOut: 'USDCx',
  amountIn: '1.0',
  recipient: '0x000000000000000000000000000000000000dead',
};

describe('buildMockRoutePlan', () => {
  it('produces a schema-compliant plan', () => {
    const plan = buildMockRoutePlan(request);
    const parsed = routePlanSchema.safeParse(plan);
    expect(parsed.success).toBe(true);
    expect(plan.bridge.srcChain).toBe(request.srcChain);
    expect(plan.destinationSwap?.chainSlug).toBe(request.dstChain);
    expect(plan.sourceSwap.minAmountOut).toBe('0.995');
    expect(plan.destinationSwap?.amountIn).toBe('0.995');
    expect(plan.destinationSwap?.minAmountOut).toBe('0.990025');
    expect(plan.bridge.fee?.amount).toBe('0.005');
  });

  it('throws when amount invalid', () => {
    expect(() => buildMockRoutePlan({ ...request, amountIn: 'abc' })).toThrowError(/Invalid amount/);
  });

  it('handles zero amount gracefully', () => {
    expect(() => buildMockRoutePlan({ ...request, amountIn: '0' })).toThrowError(/Amount must be positive/);
  });

  it('handles negative amount gracefully', () => {
    expect(() => buildMockRoutePlan({ ...request, amountIn: '-1' })).toThrowError(/Invalid amount/);
  });

  it('converts between different token decimals', () => {
    const usdcRequest = {
      ...request,
      tokenIn: 'USDCx',
      tokenOut: 'PLAY',
      amountIn: '123.456789',
    } as const;

    const plan = buildMockRoutePlan(usdcRequest);
    expect(plan.sourceSwap.amountIn).toBe(usdcRequest.amountIn);
    expect(plan.sourceSwap.minAmountOut).toBe('122.839505055');
    expect(plan.destinationSwap?.amountIn).toBe('122.839505055');
    expect(plan.destinationSwap?.minAmountOut).toBe('122.225307529725');
    expect(plan.bridge.fee?.amount).toBe('0.617284');
  });
});
