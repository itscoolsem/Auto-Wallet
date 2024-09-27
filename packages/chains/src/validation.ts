import type { ChainConfig, Registry, TokenConfig } from './types.js';

export interface ValidationResult {
  ok: boolean;
  errors: string[];
}

function validateChain(slug: string, chain: ChainConfig): string[] {
  const errors: string[] = [];

  if (!Number.isInteger(chain.chainId) || chain.chainId <= 0) {
    errors.push(`${slug}: chainId must be a positive integer`);
  }

  if (!chain.rpcEnv || typeof chain.rpcEnv !== 'string' || chain.rpcEnv.trim() === '') {
    errors.push(`${slug}: rpcEnv must be a non-empty string`);
  }

  if (!chain.erc4337.bundlerEnv || chain.erc4337.bundlerEnv.trim() === '') {
    errors.push(`${slug}: erc4337.bundlerEnv must be set`);
  }

  if (!chain.erc4337.paymasterEnv || chain.erc4337.paymasterEnv.trim() === '') {
    errors.push(`${slug}: erc4337.paymasterEnv must be set`);
  }

  if (!chain.layerZero.endpointEnv || chain.layerZero.endpointEnv.trim() === '') {
    errors.push(`${slug}: layerZero.endpointEnv must be set`);
  }

  if (chain.nativeCurrency.decimals <= 0 || chain.nativeCurrency.decimals > 36) {
    errors.push(`${slug}: nativeCurrency.decimals must be between 1 and 36`);
  }

  // Validate slug format
  if (!/^[a-z0-9-]+$/.test(slug)) {
    errors.push(`${slug}: chain slug must contain only lowercase letters, numbers, and hyphens`);
  }

  return errors;
}

function validateToken(chainSlug: string, symbol: string, token: TokenConfig): string[] {
  const errors: string[] = [];

  if (token.decimals < 0 || token.decimals > 36) {
    errors.push(`${chainSlug}.${symbol}: decimals must be between 0 and 36`);
  }

  if (!token.pythPriceEnv) {
    errors.push(`${chainSlug}.${symbol}: pythPriceEnv must be set`);
  }

  return errors;
}

export function validateRegistry(registry: Registry): ValidationResult {
  const errors: string[] = [];

  for (const [slug, chain] of Object.entries(registry.chains)) {
    errors.push(...validateChain(slug, chain));
  }

  for (const [chainSlug, tokens] of Object.entries(registry.tokens)) {
    for (const [symbol, token] of Object.entries(tokens)) {
      errors.push(...validateToken(chainSlug, symbol, token));
    }
  }

  return {
    ok: errors.length === 0,
    errors,
  };
}
