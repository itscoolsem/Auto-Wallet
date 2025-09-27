import Fastify, { type FastifyInstance } from 'fastify';
import fastifyCors from '@fastify/cors';
import { routePlanSchema } from '@autobridge/routing-schema';
import { buildMockRoutePlan } from '@autobridge/routing-engine';
import { getToken } from '@autobridge/chains';
import { AutoBridgeWalletSDK } from '@autobridge/sdk';

export function buildServer(): FastifyInstance {
  const fastify = Fastify({ logger: false });
  const sdk = new AutoBridgeWalletSDK();

  fastify.register(fastifyCors, {
    origin: '*',
    methods: ['GET', 'POST', 'OPTIONS'],
  });

  fastify.get('/health', async () => ({ status: 'ok', time: Date.now() }));

  fastify.get('/env/check', async () => {
    try {
      sdk.ensureEnvironmentReady();
      return { status: 'ok' };
    } catch (error) {
      return {
        status: 'error',
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  });

  fastify.post('/route/validate', async (request, reply) => {
    const body = request.body as { plan?: unknown } | undefined;
    const parsed = routePlanSchema.safeParse(body?.plan);
    if (!parsed.success) {
      reply.status(400);
      return {
        ok: false,
        errors: parsed.error.errors.map((err) => ({ path: err.path.join('.'), message: err.message })),
      };
    }

    return {
      ok: true,
      plan: parsed.data,
    };
  });

  fastify.post('/route/quote', async (request, reply) => {
    const body = request.body as {
      srcChain?: string;
      dstChain?: string;
      tokenIn?: string;
      tokenOut?: string;
      amountIn?: string;
      recipient?: string;
    } | undefined;

    if (!body) {
      reply.status(400);
      return { ok: false, error: 'Missing body' };
    }

    try {
      const plan = buildMockRoutePlan({
        srcChain: body.srcChain ?? 'base-sepolia',
        dstChain: body.dstChain ?? body.srcChain ?? 'optimism-sepolia',
        tokenIn: body.tokenIn ?? 'WETH',
        tokenOut: body.tokenOut ?? 'USDCx',
        amountIn: body.amountIn ?? '1',
        recipient: body.recipient ?? '0x000000000000000000000000000000000000dead',
      });

      const normalizedPlan = tweakPlanForKnownTokens(plan);

      return { ok: true, plan: normalizedPlan };
    } catch (error) {
      reply.status(400);
      return {
        ok: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  });

  return fastify;
}

export async function startServer(port = Number(process.env.PORT ?? 4000)) {
  const server = buildServer();
  await server.listen({ port, host: '0.0.0.0' });
  return server;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  startServer().catch((error) => {
    // eslint-disable-next-line no-console
    console.error('Failed to start routing-service', error);
    process.exitCode = 1;
  });
}

function tweakPlanForKnownTokens(plan) {
  const clone = structuredClone(plan);

  if (clone.srcChain === 'base-sepolia' && clone.dstChain === 'base-sepolia') {
    const gasVault =
      process.env.GAS_VAULT_ADDRESS ??
      process.env.NEXT_PUBLIC_GAS_VAULT_ADDRESS ??
      process.env.PAYMASTER_ADDRESS ??
      process.env.NEXT_PUBLIC_PAYMASTER_ADDRESS;

    if (clone.tokenIn === 'WETH' && clone.tokenOut === 'USDX') {
      const usdx = getToken('base-sepolia', 'USDX');
      const weth = getToken('base-sepolia', 'WETH');

      clone.sourceSwap.poolId = 'weth-usdx';
      clone.sourceSwap.execute = true;

      // Enable gas vault skim for paymaster reimbursement
      clone.sourceSwap.hooks.gasShield.skimBps = 50; // 0.5% to gas vault
      clone.sourceSwap.hooks.gasShield.gasVault = gasVault || '0x175B2dB964a1b978d5678eA50988dfF694604040';

      // Set bridge aware fee for USDX bridging
      clone.sourceSwap.hooks.bridgeAwareFee.extraFeeBps = 25; // 0.25% bridge fee
      clone.sourceSwap.hooks.bridgeAwareFee.maxFeeBps = 100; // 1% max fee
      clone.sourceSwap.hooks.bridgeAwareFee.priceTimestamp = Math.floor(Date.now() / 1000);
      clone.sourceSwap.hooks.bridgeAwareFee.ttlSeconds = 300; // 5 minutes TTL

      clone.bridge.protocol = 'local-demo';
      clone.bridge.dstChain = clone.srcChain;
      clone.bridge.token = 'USDX';
      clone.bridge.destToken = 'USDX';

      // Calculate amounts after fees
      const amountInUnits = parseFloat(clone.amountIn);
      const gasSkimAmount = amountInUnits * 0.005; // 0.5%
      const bridgeFeeAmount = amountInUnits * 0.0025; // 0.25%
      const finalAmount = amountInUnits - gasSkimAmount - bridgeFeeAmount;

      clone.bridge.amount = finalAmount.toString();
      clone.bridge.minAmountOut = (finalAmount * 0.995).toString(); // 0.5% slippage
      clone.bridge.metadata = {
        nativeFeeWei: '0',
        lzTokenFeeWei: '0',
        options: '0x',
        pricePayload: '0x',
        dstEid: 0,
        destExecutor: process.env.LOCAL_BRIDGE_SENDER_ADDRESS ?? '0xa6043B4f718A7965fdaCBe45CA227AbbA556728e',
      };

      clone.quote.amountOut = finalAmount.toString();
      clone.quote.minAmountOut = (finalAmount * 0.995).toString();
      clone.quote.extraFeeBps = 25;
      clone.quote.gasVaultBps = 50;
    } else {
      // For unsupported pairs, disable the swap to avoid reverts.
      clone.sourceSwap.execute = false;
      clone.sourceSwap.minAmountOut = '0';
      clone.bridge.amount = clone.amountIn;
      clone.bridge.minAmountOut = clone.amountIn;
      clone.quote.amountOut = clone.amountIn;
      clone.quote.minAmountOut = clone.amountIn;
    }
  }

  return clone;
}
