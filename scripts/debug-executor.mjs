#!/usr/bin/env node
import { AutoBridgeWalletSDK } from '@autobridge/sdk';
import { buildRouteUserOperation } from '@autobridge/aa';
import { createPublicClient, http, encodeFunctionData } from 'viem';
import { baseSepolia } from 'viem/chains';
import { walletExecutorAbi } from '@autobridge/aa/dist/abis.js';

const smartAccount = process.env.SMART_ACCOUNT ?? '0xF87C38feb34961dc0A2e16299D688495a8B979dd';
const owner = process.env.SMART_OWNER ?? '0xf90e10d967EE2Dd4cdA59cCA6F0586ffAbF965dF';

const sdk = new AutoBridgeWalletSDK();
const publicClient = createPublicClient({ chain: baseSepolia, transport: http(process.env.BASE_SEPOLIA_RPC ?? 'https://sepolia.base.org') });

function simplifyPlan(plan, env = {}) {
  const clone = structuredClone(plan);
  if (clone.sourceSwap) {
    clone.sourceSwap.minAmountOut = clone.sourceSwap.amountIn;
    clone.sourceSwap.hooks = {
      bridgeAwareFee: {
        extraFeeBps: 0,
        maxFeeBps: clone.sourceSwap.hooks?.bridgeAwareFee?.maxFeeBps ?? 0,
        priceTimestamp: Math.floor(Date.now() / 1000),
        ttlSeconds: clone.sourceSwap.hooks?.bridgeAwareFee?.ttlSeconds ?? 600,
      },
      gasShield: {
        skimBps: 0,
        gasVault: env.GAS_VAULT_ADDRESS ?? '0x0000000000000000000000000000000000000000',
      },
    };
  }
  clone.destinationSwap = undefined;
  if (clone.quote) {
    clone.quote.minAmountOut = clone.bridge?.minAmountOut ?? clone.quote.minAmountOut;
    clone.quote.extraFeeBps = 0;
    clone.quote.gasVaultBps = 0;
  }
  return clone;
}

async function main() {
  const params = {
    amount: process.env.AMOUNT ?? '0.001',
    token: process.env.TOKEN ?? 'WETH',
    tokenOut: process.env.TOKEN_OUT ?? 'USDX',
    sourceChain: process.env.SOURCE_CHAIN ?? 'base-sepolia',
    destinationChain: process.env.DEST_CHAIN ?? 'base-sepolia',
    recipient: smartAccount,
  };

  const estimate = await sdk.estimateRoute(params);
  const simplifiedPlan = simplifyPlan(estimate.plan, process.env);

  const routeContext = await buildRouteUserOperation({
    chainSlug: params.sourceChain,
    smartAccount,
    owner,
    routePlan: simplifiedPlan,
    publicClient,
    env: process.env,
  });

  const calldata = encodeFunctionData({
    abi: walletExecutorAbi,
    functionName: 'executeRoute',
    args: [routeContext.route],
  });

  try {
    const result = await publicClient.call({
      to: routeContext.walletExecutor,
      account: smartAccount,
      data: calldata,
    });
    console.log('Call succeeded', result);
  } catch (error) {
    console.error('Call failed', error.shortMessage ?? error);
    if (error.cause) console.error('Cause', error.cause);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
