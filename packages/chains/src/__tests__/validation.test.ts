import { describe, expect, it } from 'vitest';

import { registry } from '../index.js';
import { validateRegistry } from '../validation.js';

const makeInvalidRegistry = () => ({
  chains: {
    invalid: {
      chainId: -1,
      name: 'Invalid',
      rpcEnv: '',
      nativeCurrency: { symbol: 'ETH', decimals: 0 },
      erc4337: {
        bundlerEnv: '',
        paymasterEnv: '',
        walletExecutorEnv: '',
        entryPoint: ''
      },
      layerZero: { endpointEnv: '' },
    },
  },
  tokens: {
    invalid: {
      BAD: {
        address: '',
        decimals: 99,
        pythPriceEnv: '',
      },
    },
  },
});

describe('validateRegistry', () => {
  it('returns ok for the current registry', () => {
    const result = validateRegistry(registry);
    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('collects errors for invalid configs', () => {
    const result = validateRegistry(makeInvalidRegistry());
    expect(result.ok).toBe(false);
    expect(result.errors).toMatchInlineSnapshot(`
      [
        "invalid: chainId must be a positive integer",
        "invalid: rpcEnv must be a non-empty string",
        "invalid: erc4337.bundlerEnv must be set",
        "invalid: erc4337.paymasterEnv must be set",
        "invalid: erc4337.walletExecutorEnv must be set",
        "invalid: erc4337.entryPoint must be set",
        "invalid: layerZero.endpointEnv must be set",
        "invalid: nativeCurrency.decimals must be between 1 and 36",
        "invalid.BAD: decimals must be between 0 and 36",
        "invalid.BAD: pythPriceEnv must be set",
      ]
    `);
  });
});
