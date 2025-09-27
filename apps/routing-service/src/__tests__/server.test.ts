import { describe, expect, it } from 'vitest';

import { buildServer } from '../server.js';

const plan = {
  id: 'test-route',
  createdAt: Date.now(),
  expiresAt: Date.now() + 60_000,
  srcChain: 'base-sepolia',
  dstChain: 'optimism-sepolia',
  tokenIn: 'WETH',
  tokenOut: 'USDCx',
  amountIn: '1.0',
  recipient: '0xrecipient',
  sourceSwap: {
    chainSlug: 'base-sepolia',
    dex: 'uniswap-v4' as const,
    poolId: 'weth-usdcx',
    tokenIn: 'WETH',
    tokenOut: 'USDX',
    amountIn: '1.0',
    minAmountOut: '1999',
  },
  bridge: {
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
  },
  quote: {
    amountOut: '2000',
    minAmountOut: '1980',
    extraFeeBps: 40,
    gasVaultBps: 10,
    priceTimestamp: Date.now(),
  },
};

describe('routing-service server', () => {
  const server = buildServer();

  it('responds to health check', async () => {
    const res = await server.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    const json = res.json();
    expect(json.status).toBe('ok');
  });

  it('validates route plans', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/route/validate',
      payload: { plan },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ ok: true });
  });

  it('rejects invalid plans', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/route/validate',
      payload: { plan: { foo: 'bar' } },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json()).toMatchObject({ ok: false });
  });

  it('creates a mock quote', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/route/quote',
      payload: {
        srcChain: 'base-sepolia',
        dstChain: 'optimism-sepolia',
        tokenIn: 'WETH',
        tokenOut: 'USDCx',
        amountIn: '1',
        recipient: '0x000000000000000000000000000000000000dead',
      },
    });

    expect(res.statusCode).toBe(200);
    const json = res.json();
    expect(json.ok).toBe(true);
    expect(json.plan.srcChain).toBe('base-sepolia');
  });
});
