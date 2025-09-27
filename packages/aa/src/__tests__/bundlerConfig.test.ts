import { describe, expect, it } from 'vitest';

import { resolveBundlerConfig } from '../bundlerConfig.js';

describe('resolveBundlerConfig', () => {
  const env = {
    BASE_BUNDLER_URL: 'https://bundler.base.testnet',
    PAYMASTER_ADDRESS: '0x0000000000000000000000000000000000000001',
    WALLET_EXECUTOR_ADDRESS: '0x0000000000000000000000000000000000000002',
  } as Record<string, string | undefined>;

  it('extracts bundler url and paymaster from env', () => {
    const cfg = resolveBundlerConfig('base-sepolia', env);
    expect(cfg.bundlerUrl).toBe(env.BASE_BUNDLER_URL);
    expect(cfg.paymasterAddress).toBe(env.PAYMASTER_ADDRESS);
    expect(cfg.walletExecutorAddress).toBe(env.WALLET_EXECUTOR_ADDRESS);
  });

  it('supports NEXT_PUBLIC alias fallbacks', () => {
    const aliasEnv = {
      NEXT_PUBLIC_BASE_BUNDLER_URL: 'https://alias.bundler',
      NEXT_PUBLIC_PAYMASTER_ADDRESS: '0x00000000000000000000000000000000000000aa',
      NEXT_PUBLIC_WALLET_EXECUTOR_ADDRESS: '0x00000000000000000000000000000000000000bb',
    } as Record<string, string | undefined>;

    const cfg = resolveBundlerConfig('base-sepolia', aliasEnv);
    expect(cfg.bundlerUrl).toBe(aliasEnv.NEXT_PUBLIC_BASE_BUNDLER_URL);
    expect(cfg.paymasterAddress).toBe(aliasEnv.NEXT_PUBLIC_PAYMASTER_ADDRESS);
    expect(cfg.walletExecutorAddress).toBe(aliasEnv.NEXT_PUBLIC_WALLET_EXECUTOR_ADDRESS);
  });

  it('throws when env missing', () => {
    expect(() => resolveBundlerConfig('base-sepolia', {})).toThrowError(/BASE_BUNDLER_URL/);
  });
});
