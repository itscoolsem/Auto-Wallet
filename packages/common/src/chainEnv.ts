import { registry, type ChainConfig, type ChainTokenMap, type Registry } from '@autobridge/chains';

import { optionalEnv } from './env.js';

export interface MissingEnvReport {
  envVar: string;
  context: string;
}

function collectChainEnvVars(chain: ChainConfig): MissingEnvReport[] {
  return [
    { envVar: chain.rpcEnv, context: `${chain.name} RPC` },
    { envVar: chain.erc4337.bundlerEnv, context: `${chain.name} ERC-4337 bundler` },
    { envVar: chain.erc4337.paymasterEnv, context: `${chain.name} paymaster` },
    { envVar: chain.layerZero.endpointEnv, context: `${chain.name} LayerZero endpoint` },
  ];
}

function collectTokenEnvVars(chainName: string, tokens: ChainTokenMap): MissingEnvReport[] {
  const results: MissingEnvReport[] = [];
  for (const [symbol, token] of Object.entries(tokens)) {
    results.push({ envVar: token.pythPriceEnv, context: `${chainName} ${symbol} Pyth price id` });
  }
  return results;
}

export function collectRequiredEnvVars(source: Registry = registry): MissingEnvReport[] {
  const results: MissingEnvReport[] = [];

  for (const chain of Object.values(source.chains)) {
    results.push(...collectChainEnvVars(chain));
  }

  for (const [slug, tokens] of Object.entries(source.tokens)) {
    const chainName = source.chains[slug]?.name ?? slug;
    results.push(...collectTokenEnvVars(chainName, tokens));
  }

  return results;
}

export function findMissingEnvVars(
  env: Record<string, string | undefined> = process.env,
  source: Registry = registry,
): MissingEnvReport[] {
  const required = collectRequiredEnvVars(source);
  return required.filter((item) => optionalEnv(item.envVar, env) == null);
}
