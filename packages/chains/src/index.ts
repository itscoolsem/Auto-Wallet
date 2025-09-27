import chainsJson from '../../../config/chains.json' with { type: 'json' };
import tokensJson from '../../../config/tokens.json' with { type: 'json' };

import type { ChainConfig, ChainSlug, ChainTokenMap, Registry, TokenConfig } from './types.js';
export { validateRegistry } from './validation.js';
export type { ValidationResult } from './validation.js';
export type { ChainConfig, ChainSlug, ChainTokenMap, Registry, TokenConfig } from './types.js';

const chains = chainsJson as Record<string, ChainConfig>;
const tokens = tokensJson as Record<string, ChainTokenMap>;

export const registry: Registry = {
  chains,
  tokens,
};

export function getChain(slug: ChainSlug): ChainConfig {
  const chain = registry.chains[slug];
  if (!chain) {
    throw new Error(`Chain config not found for slug: ${slug}`);
  }
  return chain;
}

export function getToken(slug: ChainSlug, symbol: string): TokenConfig {
  const token = registry.tokens[slug]?.[symbol];
  if (!token) {
    throw new Error(`Token ${symbol} not defined for chain ${slug}`);
  }
  return token;
}

export function listChains(): ChainConfig[] {
  return Object.values(registry.chains);
}

export function listTokens(slug: ChainSlug): ChainTokenMap {
  const chainTokens = registry.tokens[slug];
  if (!chainTokens) {
    throw new Error(`Tokens not defined for chain ${slug}`);
  }
  return chainTokens;
}
