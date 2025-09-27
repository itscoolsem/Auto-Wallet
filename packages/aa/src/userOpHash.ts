import type { UserOperation } from './types.js';
import { encodeAbiParameters, keccak256, concatHex } from 'viem';
import type { Address, Hex } from 'viem';

function packUserOp(userOp: UserOperation): Hex {
  return encodeAbiParameters(
    [
      { type: 'address' },
      { type: 'uint256' },
      { type: 'bytes32' },
      { type: 'bytes32' },
      { type: 'uint256' },
      { type: 'uint256' },
      { type: 'uint256' },
      { type: 'uint256' },
      { type: 'uint256' },
      { type: 'bytes32' },
    ],
    [
      userOp.sender,
      userOp.nonce,
      keccak256(userOp.initCode),
      keccak256(userOp.callData),
      userOp.callGasLimit,
      userOp.verificationGasLimit,
      userOp.preVerificationGas,
      userOp.maxFeePerGas,
      userOp.maxPriorityFeePerGas,
      keccak256(userOp.paymasterAndData),
    ],
  ) as Hex;
}

export function getUserOperationHash(userOp: UserOperation, entryPoint: Address, chainId: number): Hex {
  const userOpHash = keccak256(packUserOp(userOp));
  const encoded = encodeAbiParameters(
    [
      { type: 'address' },
      { type: 'uint256' },
      { type: 'bytes32' },
    ],
    [entryPoint, BigInt(chainId), userOpHash],
  );

  return keccak256(concatHex(['0x1901', encoded])) as Hex;
}
