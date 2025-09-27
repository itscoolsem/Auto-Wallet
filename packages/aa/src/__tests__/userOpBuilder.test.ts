import { describe, expect, it } from 'vitest';

import { buildUserOperation } from '../userOpBuilder.js';

const sender = '0x000000000000000000000000000000000000dead';
const callData = '0x1234' as const;

describe('buildUserOperation', () => {
  it('fills defaults for missing fields', () => {
    const op = buildUserOperation({ sender, callData });
    expect(op.sender).toBe(sender);
    expect(op.callData).toBe(callData);
    expect(op.maxFeePerGas).toBe(1_000_000_000n);
    expect(op.signature).toBe('0x');
  });

  it('respects overrides', () => {
    const op = buildUserOperation({
      sender,
      callData,
      overrides: {
        nonce: 5n,
        signature: '0xdeadbeef',
      },
    });
    expect(op.nonce).toBe(5n);
    expect(op.signature).toBe('0xdeadbeef');
  });

  it('throws for invalid hex callData', () => {
    expect(() => buildUserOperation({ sender, callData: '1234' as never })).toThrowError(/hex/);
  });
});
