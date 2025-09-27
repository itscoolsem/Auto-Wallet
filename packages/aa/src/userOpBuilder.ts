import { z } from 'zod';

import type { Address } from 'viem';
import type { Hex, UserOperation, UserOperationOverrides, UserOperationRequest } from './types.js';

const hexString = z
  .string()
  .regex(/^0x[0-9a-fA-F]*$/, { message: 'must be a hex string' });

const userOpRequestSchema = z.object({
  sender: z.string().min(1),
  callData: hexString,
  overrides: z
    .object({})
    .passthrough()
    .optional(),
});

const DEFAULT_BIGINT = 0n;
const DEFAULT_CALL_GAS = 250000n;
const DEFAULT_VERIFICATION_GAS = 150000n;
const DEFAULT_MAX_FEE = 1_000_000_000n; // 1 gwei placeholder
const EMPTY_HEX: Hex = '0x';

export function buildUserOperation(request: UserOperationRequest): UserOperation {
  const parsed = userOpRequestSchema.parse(request);
  const overrides = (parsed.overrides ?? {}) as UserOperationOverrides;

  return {
    sender: parsed.sender as Address,
    nonce: overrides.nonce ?? DEFAULT_BIGINT,
    initCode: overrides.initCode ?? EMPTY_HEX,
    callData: parsed.callData as Hex,
    callGasLimit: overrides.callGasLimit ?? DEFAULT_CALL_GAS,
    verificationGasLimit: overrides.verificationGasLimit ?? DEFAULT_VERIFICATION_GAS,
    preVerificationGas: overrides.preVerificationGas ?? DEFAULT_BIGINT,
    maxFeePerGas: overrides.maxFeePerGas ?? DEFAULT_MAX_FEE,
    maxPriorityFeePerGas: overrides.maxPriorityFeePerGas ?? DEFAULT_MAX_FEE,
    paymasterAndData: (overrides.paymasterAndData ?? EMPTY_HEX) as Hex,
    signature: (overrides.signature ?? EMPTY_HEX) as Hex,
  };
}
