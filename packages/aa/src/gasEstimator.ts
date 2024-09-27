import type { UserOperation } from './types.js';

/**
 * Gas estimation utilities for user operations
 */

export interface GasEstimate {
  callGasLimit: bigint;
  verificationGasLimit: bigint;
  preVerificationGas: bigint;
  maxFeePerGas: bigint;
  maxPriorityFeePerGas: bigint;
}

export interface GasMultipliers {
  callGas?: number;
  verification?: number;
  preVerification?: number;
}

const DEFAULT_MULTIPLIERS: Required<GasMultipliers> = {
  callGas: 1.1, // 10% buffer
  verification: 1.2, // 20% buffer for verification
  preVerification: 1.0, // No buffer for pre-verification
};

/**
 * Apply safety multipliers to gas estimates
 */
export function applySafetyMultipliers(
  estimate: GasEstimate,
  multipliers: GasMultipliers = {}
): GasEstimate {
  const m = { ...DEFAULT_MULTIPLIERS, ...multipliers };

  return {
    ...estimate,
    callGasLimit: BigInt(Math.ceil(Number(estimate.callGasLimit) * m.callGas)),
    verificationGasLimit: BigInt(Math.ceil(Number(estimate.verificationGasLimit) * m.verification)),
    preVerificationGas: BigInt(Math.ceil(Number(estimate.preVerificationGas) * m.preVerification)),
  };
}

/**
 * Calculate total gas cost for a user operation
 */
export function calculateTotalGasCost(userOp: UserOperation): bigint {
  const totalGas = userOp.callGasLimit + userOp.verificationGasLimit + userOp.preVerificationGas;
  return totalGas * userOp.maxFeePerGas;
}

/**
 * Validate gas limits are within reasonable bounds
 */
export function validateGasLimits(estimate: GasEstimate): boolean {
  const MIN_CALL_GAS = 21000n;
  const MAX_CALL_GAS = 10_000_000n;
  const MIN_VERIFICATION_GAS = 10000n;
  const MAX_VERIFICATION_GAS = 2_000_000n;

  return (
    estimate.callGasLimit >= MIN_CALL_GAS &&
    estimate.callGasLimit <= MAX_CALL_GAS &&
    estimate.verificationGasLimit >= MIN_VERIFICATION_GAS &&
    estimate.verificationGasLimit <= MAX_VERIFICATION_GAS &&
    estimate.preVerificationGas >= 0n
  );
}