import { describe, expect, it, vi } from 'vitest';

import { AutoBridgeWalletSDK } from '../index.js';
import type { RoutePlan } from '@autobridge/routing-schema';
import { concatHex, encodeFunctionData, type PublicClient, type Hex } from 'viem';

const env = {
  BASE_SEPOLIA_RPC: 'https://rpc.base',
  OPTIMISM_SEPOLIA_RPC: 'https://rpc.opt',
  ARBITRUM_SEPOLIA_RPC: 'https://rpc.arb',
  BASE_BUNDLER_URL: 'https://bundler.base',
  OPTIMISM_BUNDLER_URL: 'https://bundler.opt',
  ARBITRUM_BUNDLER_URL: 'https://bundler.arb',
  PAYMASTER_ADDRESS: '0xpaymaster',
  LZ_BASE_SEPOLIA_ENDPOINT: '20000',
  LZ_OPTIMISM_SEPOLIA_ENDPOINT: '20001',
  LZ_ARBITRUM_SEPOLIA_ENDPOINT: '20002',
  PYTH_WETH_PRICE_ID: '0xweth',
  PYTH_USDC_PRICE_ID: '0xusdc',
  PYTH_PLAY_PRICE_ID: '0xplay',
  PYTH_USDX_PRICE_ID: '0xusdx',
};

const factoryAbi = [
  {
    type: 'function',
    name: 'createAccount',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'salt', type: 'bytes32' },
    ],
    outputs: [{ name: 'account', type: 'address' }],
  },
] as const;

describe('AutoBridgeWalletSDK', () => {
  it('filters supported chains when configured', () => {
    const sdk = new AutoBridgeWalletSDK({ chains: ['Base Sepolia'] });
    const chains = sdk.listSupportedChains();
    expect(chains.every((chain) => chain.name === 'Base Sepolia')).toBe(true);
  });

  it('validates environment', () => {
    const sdk = new AutoBridgeWalletSDK();
    expect(() => sdk.ensureEnvironmentReady(env)).not.toThrow();
    expect(() => sdk.ensureEnvironmentReady({})).toThrowError(/Missing environment variables/);
  });

  it('fetches a mock route from routing service', async () => {
    const sdk = new AutoBridgeWalletSDK({ routingServiceUrl: 'http://mock' });

    const plan = {
      id: 'mock',
      createdAt: Date.now(),
      expiresAt: Date.now() + 1000,
      srcChain: 'base-sepolia',
      dstChain: 'optimism-sepolia',
      tokenIn: 'WETH',
      tokenOut: 'USDCx',
      amountIn: '1',
      recipient: '0xrecipient',
      sourceSwap: {
        chainSlug: 'base-sepolia',
        dex: 'uniswap-v4',
        poolId: 'weth-usdcx',
        tokenIn: 'WETH',
        tokenOut: 'USDX',
        amountIn: '1',
        minAmountOut: '0.95',
      },
      bridge: {
        protocol: 'layerzero-v2',
        oft: true,
        srcChain: 'base-sepolia',
        dstChain: 'optimism-sepolia',
        token: 'USDX',
        amount: '0.95',
        minAmountOut: '0.9',
        recipient: '0xrecipient',
        destToken: 'USDX',
        slippageBps: 50,
      },
      quote: {
        amountOut: '0.9',
        minAmountOut: '0.9',
        extraFeeBps: 40,
        gasVaultBps: 10,
        priceTimestamp: 1,
      },
    };

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, plan }),
    });

    vi.stubGlobal('fetch', fetchMock);

    const result = await sdk.estimateRoute({
      amount: '1',
      token: 'WETH',
      sourceChain: 'base-sepolia',
      destinationChain: 'optimism-sepolia',
      recipient: '0xrecipient',
    });

    expect(result.plan.dstChain).toBe('optimism-sepolia');
    expect(fetchMock).toHaveBeenCalled();

    vi.unstubAllGlobals();
  });

  it('throws for unimplemented flows', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 500, text: async () => 'err' });
    vi.stubGlobal('fetch', fetchMock);

    const sdk = new AutoBridgeWalletSDK();
    await expect(sdk.connect()).rejects.toThrow(/not implemented/);
    await expect(sdk.getBalances()).rejects.toThrow(/not implemented/);
    await expect(sdk.send({
      amount: '1',
      token: 'WETH',
      sourceChain: 'base-sepolia',
      destinationChain: 'optimism-sepolia',
      recipient: '0xrecipient',
    })).rejects.toThrow(/not implemented/);
    await expect(sdk.sendCrossChain({
      amount: '1',
      token: 'WETH',
      sourceChain: 'base-sepolia',
      destinationChain: 'optimism-sepolia',
      recipient: '0xrecipient',
    })).rejects.toThrow(/not implemented/);
    await expect(sdk.estimateRoute({
      amount: '1',
      token: 'WETH',
      sourceChain: 'base-sepolia',
      destinationChain: 'optimism-sepolia',
      recipient: '0xrecipient',
    })).rejects.toThrow(/Routing service error/);

    vi.unstubAllGlobals();
  });

  it('builds, signs, and submits a route user operation', async () => {
    const sdk = new AutoBridgeWalletSDK();

    const plan: RoutePlan = {
      id: 'plan-1',
      createdAt: Date.now(),
      expiresAt: Date.now() + 60_000,
      srcChain: 'base-sepolia',
      dstChain: 'base-sepolia',
      tokenIn: 'WETH',
      tokenOut: 'USDX',
      amountIn: '1',
      recipient: '0x00000000000000000000000000000000000000bb',
      sourceSwap: {
        chainSlug: 'base-sepolia',
        dex: 'uniswap-v4',
        poolId: 'weth-usdx',
        tokenIn: 'WETH',
        tokenOut: 'USDX',
        amountIn: '1',
        minAmountOut: '0.95',
        hooks: {
          bridgeAwareFee: {
            extraFeeBps: 40,
            maxFeeBps: 80,
            ttlSeconds: 60,
            priceTimestamp: Math.floor(Date.now() / 1000),
          },
          gasShield: {
            skimBps: 20,
            gasVault: '0x175B2dB964a1b978d5678eA50988dfF694604040',
          },
        },
      },
      bridge: {
        protocol: 'layerzero-v2',
        oft: true,
        srcChain: 'base-sepolia',
        dstChain: 'base-sepolia',
        token: 'USDX',
        amount: '0.95',
        minAmountOut: '0.94',
        recipient: '0x00000000000000000000000000000000000000bb',
        destToken: 'USDX',
        slippageBps: 50,
        metadata: {
          nativeFeeWei: '0',
          lzTokenFeeWei: '0',
          dstEid: 30110,
          destExecutor: '0xa6043B4f718A7965fdaCBe45CA227AbbA556728e',
        },
      },
      quote: {
        amountOut: '0.94',
        minAmountOut: '0.94',
        extraFeeBps: 40,
        gasVaultBps: 20,
        priceTimestamp: Math.floor(Date.now() / 1000),
      },
    };

    const publicClient = {
      readContract: async () => 5n,
      getBlock: async () => ({ baseFeePerGas: 1_000_000_000n }),
      chain: { id: 84532 },
    } as unknown as PublicClient;

    const http = vi.fn(async (_url: string, init: RequestInit): Promise<Response> => {
      const body = JSON.parse(String(init.body));
      if (body.method === 'eth_estimateUserOperationGas') {
        return new Response(
          JSON.stringify({
            jsonrpc: '2.0',
            id: body.id,
            result: {
              callGasLimit: '0x186a0',
              verificationGasLimit: '0x2710',
              preVerificationGas: '0x1f40',
            },
          }),
        );
      }
      return new Response(JSON.stringify({ jsonrpc: '2.0', id: body.id, result: '0xuserophash' }));
    });

    const signature: Hex = `0x${'11'.repeat(65)}` as Hex;

    const factoryAddress = '0x00000000000000000000000000000000000000f1';
    const salt = '0x1111111111111111111111111111111111111111111111111111111111111111';

    const options = {
      plan,
      chainSlug: 'base-sepolia',
      smartAccount: '0x00000000000000000000000000000000000000aa',
      owner: '0x00000000000000000000000000000000000000fe',
      publicClient,
      signUserOpHash: async () => signature,
      httpClient: http,
      env: {
        BASE_BUNDLER_URL: 'https://bundler.test',
        PAYMASTER_ADDRESS: '0xc5026854aeaC69673a8D91fcC54DA9c1779FaC9d',
        WALLET_EXECUTOR_ADDRESS: '0xBd21C35a1bD2DdD3647ad76aAF89163B9AAE7F3c',
        POOL_HOOK_ADDRESS: '0x597022fA4246904C8B794a18bE644faEc2fc0080',
        GAS_VAULT_ADDRESS: '0x175B2dB964a1b978d5678eA50988dfF694604040',
      },
      factory: {
        address: factoryAddress,
        salt: salt as `0x${string}`,
      },
    } as const;

    const result = await sdk.executeRoute(options);

    expect(http).toHaveBeenCalledTimes(2);
    expect(result.userOp.signature).toBe(signature);
    expect(result.bundlerResponse.result).toBe('0xuserophash');
    expect(result.gasEstimates?.callGasLimit).toBe(100000n);
    expect(result.routeContext.paymaster.toLowerCase()).toBe('0xc5026854aeac69673a8d91fcc54da9c1779fac9d');
    const expectedInitCode = concatHex([
      factoryAddress,
      encodeFunctionData({
        abi: factoryAbi,
        functionName: 'createAccount',
        args: ['0x00000000000000000000000000000000000000fe', salt as `0x${string}`],
      }),
    ]);
    expect(result.userOp.initCode).toBe(expectedInitCode);
  });
});
