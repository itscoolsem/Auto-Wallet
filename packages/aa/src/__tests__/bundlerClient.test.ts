import { describe, expect, it } from 'vitest';

import { BundlerClient } from '../bundlerClient.js';
import type { UserOperation } from '../types.js';

const entryPoint = '0x0000000000000000000000000000000000000000';
const env = {
  BASE_BUNDLER_URL: 'https://bundler.base.test',
  PAYMASTER_ADDRESS: '0x0000000000000000000000000000000000000001',
  WALLET_EXECUTOR_ADDRESS: '0x0000000000000000000000000000000000000002',
};

const sampleUserOp: UserOperation = {
  sender: '0x000000000000000000000000000000000000dead',
  nonce: 0n,
  initCode: '0x',
  callData: '0x',
  callGasLimit: 0n,
  verificationGasLimit: 0n,
  preVerificationGas: 0n,
  maxFeePerGas: 0n,
  maxPriorityFeePerGas: 0n,
  paymasterAndData: '0x',
  signature: '0x',
};

describe('BundlerClient', () => {
  it('sends user operation via provided http client', async () => {
    let capturedUrl = '';
    let capturedBody = '';

    const http = async (url: string, init: RequestInit): Promise<Response> => {
      capturedUrl = url;
      capturedBody = String(init.body);
      return new Response(JSON.stringify({ jsonrpc: '2.0', id: 1, result: '0xhash' }));
    };

    const client = new BundlerClient('base-sepolia', http, env);
    const res = await client.sendUserOperation(sampleUserOp, entryPoint);

    expect(capturedUrl).toBe(env.BASE_BUNDLER_URL);
    expect(capturedBody).toContain('eth_sendUserOperation');
    expect(res.result).toBe('0xhash');
  });

  it('supports dry run mode', async () => {
    const http = async (_url: string, init: RequestInit): Promise<Response> => {
      return new Response(JSON.stringify({ jsonrpc: '2.0', id: 1, result: null, echo: init.body }));
    };

    const client = new BundlerClient('base-sepolia', http, env);
    const res = await client.sendUserOperation(sampleUserOp, entryPoint, { dryRun: true });

    expect(res.result).toBeNull();
  });

  it('deserializes gas estimate responses', async () => {
    const http = async (_url: string, init: RequestInit): Promise<Response> => {
      expect(String(init.body)).toContain('eth_estimateUserOperationGas');
      return new Response(
        JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          result: {
            callGasLimit: '0x186a0',
            verificationGasLimit: '0x2710',
            preVerificationGas: '0x1f40',
          },
        }),
      );
    };

    const client = new BundlerClient('base-sepolia', http, env);
    const res = await client.estimateUserOperationGas(sampleUserOp, entryPoint);

    expect(res.result?.callGasLimit).toBe(100000n);
    expect(res.result?.verificationGasLimit).toBe(10000n);
    expect(res.result?.preVerificationGas).toBe(8000n);
  });
});
