import { describe, expect, it } from 'vitest';
import type { RoutePlan } from '@autobridge/routing-schema';
import { buildRouteUserOperation } from '../routeUserOpBuilder.js';
import { getUserOperationHash } from '../userOpHash.js';
import { autoBridgeAccountFactoryAbi } from '../abis.js';
import { encodeFunctionData, concatHex, type PublicClient } from 'viem';

const env = {
  BASE_BUNDLER_URL: 'https://bundler.test',
  PAYMASTER_ADDRESS: '0xc5026854aeaC69673a8D91fcC54DA9c1779FaC9d',
  WALLET_EXECUTOR_ADDRESS: '0xBd21C35a1bD2DdD3647ad76aAF89163B9AAE7F3c',
  POOL_HOOK_ADDRESS: '0x597022fA4246904C8B794a18bE644faEc2fc0080',
  GAS_VAULT_ADDRESS: '0x175B2dB964a1b978d5678eA50988dfF694604040',
};

const owner = '0x00000000000000000000000000000000000000fe';
const smartAccount = '0x00000000000000000000000000000000000000aa';
const recipient = '0x00000000000000000000000000000000000000bb';

const plan: RoutePlan = {
  id: 'plan-1',
  createdAt: Date.now(),
  expiresAt: Date.now() + 60_000,
  srcChain: 'base-sepolia',
  dstChain: 'base-sepolia',
  tokenIn: 'WETH',
  tokenOut: 'USDX',
  amountIn: '1',
  recipient,
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
        priceTimestamp: Math.floor(Date.now() / 1000),
        ttlSeconds: 60,
      },
      gasShield: {
        skimBps: 20,
        gasVault: env.GAS_VAULT_ADDRESS,
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
    recipient,
    destToken: 'USDX',
    slippageBps: 50,
  },
  quote: {
    amountOut: '0.94',
    minAmountOut: '0.94',
    extraFeeBps: 40,
    gasVaultBps: 20,
    priceTimestamp: Math.floor(Date.now() / 1000),
  },
};

describe('buildRouteUserOperation', () => {
  it('constructs user operation and calldata', async () => {
    const publicClient = {
      readContract: async () => 5n,
      getBlock: async () => ({ baseFeePerGas: 1_000_000_000n }),
      chain: { id: 84532 },
    } as unknown as PublicClient;

    const result = await buildRouteUserOperation({
      chainSlug: 'base-sepolia',
      smartAccount,
      owner,
      routePlan: plan,
      publicClient,
      env,
    });

    expect(result.userOp.sender).toBe(smartAccount);
    expect(result.userOp.nonce).toBe(5n);
    expect(result.userOp.paymasterAndData.toLowerCase()).toBe(env.PAYMASTER_ADDRESS.toLowerCase());
    expect(result.route.sourceSwap.execute).toBe(true);
    expect(result.executorCalldata.startsWith('0x')).toBe(true);
    expect(result.accountCallData.startsWith('0x')).toBe(true);
    expect(result.callValue).toBe(0n);

    const hash = getUserOperationHash(result.userOp, result.entryPoint, 84532);
    expect(hash.startsWith('0x')).toBe(true);
  });

  it('includes initCode when factory config provided', async () => {
    const publicClient = {
      readContract: async () => 0n,
      getBlock: async () => ({ baseFeePerGas: 1_000_000_000n }),
      chain: { id: 84532 },
    } as unknown as PublicClient;

    const factoryAddress = '0x00000000000000000000000000000000000000f1';
    const salt = '0x1111111111111111111111111111111111111111111111111111111111111111';

    const result = await buildRouteUserOperation({
      chainSlug: 'base-sepolia',
      smartAccount,
      owner,
      routePlan: plan,
      publicClient,
      env,
      factory: {
        address: factoryAddress,
        salt: salt as `0x${string}`,
      },
    });

    const expectedInitCode = concatHex([
      factoryAddress,
      encodeFunctionData({
        abi: autoBridgeAccountFactoryAbi,
        functionName: 'createAccount',
        args: [owner, salt as `0x${string}`],
      }),
    ]);

    expect(result.userOp.initCode).toBe(expectedInitCode);
  });
});
