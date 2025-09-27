import { listChains } from '@autobridge/chains';
import { findMissingEnvVars } from '@autobridge/common';
import { routePlanSchema } from '@autobridge/routing-schema';
import type { RoutePlan } from '@autobridge/routing-schema';
import { BundlerClient, buildRouteUserOperation, getUserOperationHash, type HttpClient } from '@autobridge/aa';

import type {
  WalletSDKConfig,
  AccountProvider,
  BalanceSnapshot,
  RouteEstimate,
  SendParams,
  ExecuteRouteOptions,
  ExecuteRouteResult,
} from './types.js';

export class AutoBridgeWalletSDK {
  private readonly config: WalletSDKConfig;

  constructor(config: WalletSDKConfig = {}) {
    this.config = config;
  }

  private get routingServiceUrl(): string {
    return this.config.routingServiceUrl ?? process.env.ROUTING_SERVICE_URL ?? 'http://localhost:4000';
  }

  listSupportedChains() {
    const chains = listChains();
    if (this.config.chains && this.config.chains.length > 0) {
      return chains.filter((chain) => this.config.chains?.includes(chain.name) || this.config.chains?.includes(chain.chainId.toString()));
    }
    return chains;
  }

  ensureEnvironmentReady(env = process.env) {
    const missing = findMissingEnvVars(env);
    if (missing.length > 0) {
      const details = missing.map((entry) => `${entry.context} (${entry.envVar})`).join(', ');
      throw new Error(`Missing environment variables: ${details}`);
    }
  }

  async connect(): Promise<AccountProvider> {
    throw new Error('connect() not implemented yet');
  }

  async getBalances(): Promise<BalanceSnapshot[]> {
    throw new Error('getBalances() not implemented yet');
  }

  async estimateRoute(params: SendParams): Promise<RouteEstimate> {
    const fetchFn = globalThis.fetch;
    if (typeof fetchFn !== 'function') {
      throw new Error('fetch is not available in this environment');
    }

    const response = await fetchFn(`${this.routingServiceUrl}/route/quote`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        srcChain: params.routeOverride?.srcChain ?? params.sourceChain,
        dstChain: params.destinationChain,
        tokenIn: params.token,
        tokenOut: params.routeOverride?.tokenOut ?? params.tokenOut ?? params.token,
        amountIn: params.amount,
        recipient: params.recipient,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Routing service error (${response.status}): ${text}`);
    }

    const payload = await response.json();
    if (!payload?.plan) {
      throw new Error('Routing service returned empty plan');
    }

    const plan = routePlanSchema.parse(payload.plan);
    return {
      plan,
      slippageBps: plan.bridge.slippageBps,
    };
  }

  async send(_params: SendParams): Promise<string> {
    throw new Error('send() not implemented yet');
  }

  async sendCrossChain(_params: SendParams): Promise<string> {
    throw new Error('sendCrossChain() not implemented yet');
  }

  async executeRoute(options: ExecuteRouteOptions): Promise<ExecuteRouteResult> {
    const {
      plan,
      chainSlug,
      smartAccount,
      owner,
      publicClient,
      signUserOpHash,
      env,
      overrides,
      httpClient,
      dryRun,
      factory,
    } = options;

    const planForExecution = sanitizePlanForExecution(plan, env);

    const routeContext = await buildRouteUserOperation({
      chainSlug,
      smartAccount,
      owner,
      routePlan: planForExecution,
      publicClient,
      env,
      overrides,
      factory,
    });

    if (typeof console !== 'undefined') {
      console.log('[AutoBridge SDK] Route context prepared', {
        planId: planForExecution.id,
        chainSlug,
        entryPoint: routeContext.entryPoint,
        walletExecutor: routeContext.walletExecutor,
        paymaster: routeContext.paymaster,
        callValue: routeContext.callValue.toString(),
      });
    }

    const nativeFetch = typeof fetch === 'function' ? fetch.bind(globalThis) : undefined;

    const http = httpClient ?? nativeFetch;
    if (typeof http !== 'function') {
      throw new Error('fetch is not available in this environment');
    }

    const client = new BundlerClient(chainSlug, http as HttpClient, env);

    let userOp = { ...routeContext.userOp };
    let gasEstimates: ExecuteRouteResult['gasEstimates'];

    if (typeof console !== 'undefined') {
      console.log('[AutoBridge SDK] Requesting bundler gas estimation', {
        bundlerUrl: client.bundlerUrl,
        entryPoint: routeContext.entryPoint,
        sender: userOp.sender,
      });
    }

    const gasResponse = await client.estimateUserOperationGas(userOp, routeContext.entryPoint);
    if (gasResponse.error) {
      if (typeof console !== 'undefined') {
        console.error('[AutoBridge SDK] Bundler gas estimation failed', {
          error: gasResponse.error,
          userOperation: {
            sender: userOp.sender,
            nonce: userOp.nonce.toString(),
            callGasLimit: userOp.callGasLimit.toString(),
            verificationGasLimit: userOp.verificationGasLimit.toString(),
            preVerificationGas: userOp.preVerificationGas.toString(),
          },
        });
        if ((gasResponse.error as { data?: unknown })?.data) {
          console.error('[AutoBridge SDK] Bundler error.data payload:', JSON.stringify((gasResponse.error as { data?: unknown }).data, null, 2));
        }
      }
      throw new Error(`Bundler gas estimation failed: ${gasResponse.error.message}`);
    }
    if (gasResponse.result) {
      gasEstimates = gasResponse.result;
      userOp = {
        ...userOp,
        callGasLimit: overrides?.callGasLimit ?? gasEstimates.callGasLimit,
        verificationGasLimit: overrides?.verificationGasLimit ?? gasEstimates.verificationGasLimit,
        preVerificationGas: overrides?.preVerificationGas ?? gasEstimates.preVerificationGas,
      };
      if (typeof console !== 'undefined') {
        console.log('[AutoBridge SDK] Bundler gas estimates applied', {
          callGasLimit: userOp.callGasLimit.toString(),
          verificationGasLimit: userOp.verificationGasLimit.toString(),
          preVerificationGas: userOp.preVerificationGas.toString(),
        });
      }
    }

    let chainId = publicClient.chain?.id;
    if (chainId == null) {
      chainId = await publicClient.getChainId();
    }

    const userOpHash = getUserOperationHash(userOp, routeContext.entryPoint, chainId);
    const signature = await signUserOpHash(userOpHash);
    userOp = {
      ...userOp,
      signature,
    };

    if (typeof console !== 'undefined') {
      console.log('[AutoBridge SDK] Sending user operation to bundler', {
        bundlerUrl: client.bundlerUrl,
        entryPoint: routeContext.entryPoint,
        userOpHash,
        dryRun,
      });
    }

    const bundlerResponse = await client.sendUserOperation(userOp, routeContext.entryPoint, { dryRun });
    if (bundlerResponse.error) {
      if (typeof console !== 'undefined') {
        console.error('[AutoBridge SDK] Bundler submission failed', {
          error: bundlerResponse.error,
          userOpHash,
        });
      }
      throw new Error(`Bundler submission failed: ${bundlerResponse.error.message}`);
    }

    if (typeof console !== 'undefined') {
      console.log('[AutoBridge SDK] User operation submitted', {
        userOpHash,
        requestId: bundlerResponse.result,
      });
    }

    return {
      userOp,
      userOpHash,
      routeContext,
      bundlerResponse: bundlerResponse as ExecuteRouteResult['bundlerResponse'],
      gasEstimates,
    };
  }
}

export * from './types.js';

function sanitizePlanForExecution(plan: RoutePlan, env?: Record<string, string | undefined>): RoutePlan {
  const simplifyFlag = (env?.SIMPLIFY_SWAP_FLOW ?? process.env.SIMPLIFY_SWAP_FLOW) === 'true';
  if (!simplifyFlag) return plan;

  const cloned: RoutePlan = typeof structuredClone === 'function'
    ? structuredClone(plan)
    : JSON.parse(JSON.stringify(plan));

  if (cloned.sourceSwap) {
    cloned.sourceSwap = {
      ...cloned.sourceSwap,
      minAmountOut: cloned.sourceSwap.amountIn,
      hooks: {
        bridgeAwareFee: {
          extraFeeBps: 0,
          maxFeeBps: cloned.sourceSwap.hooks?.bridgeAwareFee?.maxFeeBps ?? 0,
          priceTimestamp:
            cloned.sourceSwap.hooks?.bridgeAwareFee?.priceTimestamp ?? Math.floor(Date.now() / 1000),
          ttlSeconds: cloned.sourceSwap.hooks?.bridgeAwareFee?.ttlSeconds ?? 600,
        },
        gasShield: {
          skimBps: 0,
          gasVault:
            cloned.sourceSwap.hooks?.gasShield?.gasVault ??
            env?.GAS_VAULT_ADDRESS ??
            '0x0000000000000000000000000000000000000000',
        },
      },
    };
  }

  if (cloned.destinationSwap) {
    cloned.destinationSwap = undefined;
  }

  if (cloned.quote) {
    cloned.quote = {
      ...cloned.quote,
      minAmountOut: cloned.bridge?.minAmountOut ?? cloned.quote.minAmountOut,
      extraFeeBps: 0,
      gasVaultBps: 0,
    };
  }

  return cloned;
}
