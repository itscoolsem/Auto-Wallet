import { describe, expect, it } from 'vitest';

import { collectRequiredEnvVars, findMissingEnvVars } from '../chainEnv.js';

const sampleEnv = {
  BASE_SEPOLIA_RPC: 'https://rpc.base.example',
  OPTIMISM_SEPOLIA_RPC: 'https://rpc.op.example',
  ARBITRUM_SEPOLIA_RPC: 'https://rpc.arb.example',
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

describe('chain env helpers', () => {
  it('collects required env vars from the registry', () => {
    const required = collectRequiredEnvVars();
    expect(required.length).toBeGreaterThan(0);
    expect(required).toContainEqual(
      expect.objectContaining({ envVar: 'BASE_SEPOLIA_RPC' }),
    );
  });

  it('findMissingEnvVars returns empty when env is populated', () => {
    expect(findMissingEnvVars(sampleEnv)).toEqual([]);
  });

  it('findMissingEnvVars reports missing entries', () => {
    const missing = findMissingEnvVars({});
    expect(missing.length).toBeGreaterThan(0);
    expect(missing[0]).toHaveProperty('envVar');
  });
});
