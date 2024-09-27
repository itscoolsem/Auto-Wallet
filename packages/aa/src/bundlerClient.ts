import { resolveBundlerConfig, type BundlerConfig } from './bundlerConfig.js';
import type { BundlerGasEstimates, BundlerRequest, BundlerResponse, UserOperation } from './types.js';

export interface HttpClient {
  (input: string, init: RequestInit): Promise<Response>;
}

export interface SubmitOptions {
  dryRun?: boolean;
  signal?: AbortSignal;
  timeout?: number;
}

export class BundlerClient {
  private readonly config: BundlerConfig;
  private readonly http: HttpClient;

  constructor(chainSlug: string, http?: HttpClient, env = process.env) {
    this.config = resolveBundlerConfig(chainSlug, env);
    const nativeFetch = typeof fetch === 'function' ? fetch.bind(globalThis) : undefined;
    this.http = http ?? (nativeFetch as HttpClient);
    if (typeof this.http !== 'function') {
      throw new Error('fetch is not available in this environment');
    }
  }

  get bundlerUrl(): string {
    return this.config.bundlerUrl;
  }

  async sendUserOperation(userOp: UserOperation, entryPoint: string, options: SubmitOptions = {}): Promise<BundlerResponse<string>> {
    const serialized = serializeUserOperation(userOp);
    const body: BundlerRequest = {
      jsonrpc: '2.0',
      id: Date.now(),
      method: options.dryRun ? 'eth_callUserOperation' : 'eth_sendUserOperation',
      params: [serialized, entryPoint],
    };

    const timeoutMs = options.timeout ?? 30000; // 30 second default
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await this.http(this.config.bundlerUrl, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: options.signal ?? controller.signal,
      });

      const json = (await response.json()) as BundlerResponse<string>;
      return json;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async estimateUserOperationGas(userOp: UserOperation, entryPoint: string): Promise<BundlerResponse<BundlerGasEstimates>> {
    const serialized = serializeUserOperation(userOp);
    const body: BundlerRequest = {
      jsonrpc: '2.0',
      id: Date.now(),
      method: 'eth_estimateUserOperationGas',
      params: [serialized, entryPoint],
    };

    const response = await this.http(this.config.bundlerUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const json = (await response.json()) as BundlerResponse<RawGasEstimate>;
    if (!json.result) {
      return json as unknown as BundlerResponse<BundlerGasEstimates>;
    }

    const parsed: BundlerGasEstimates = {
      callGasLimit: hexToBigInt(json.result.callGasLimit),
      verificationGasLimit: hexToBigInt(json.result.verificationGasLimit ?? json.result.verificationGas ?? '0x0'),
      preVerificationGas: hexToBigInt(json.result.preVerificationGas),
    };

    const typed: BundlerResponse<BundlerGasEstimates> = {
      ...json,
      result: parsed,
    };

    return typed;
  }
}

function toHex(value: bigint): string {
  return `0x${value.toString(16)}`;
}

function serializeUserOperation(userOp: UserOperation) {
  return {
    sender: userOp.sender,
    nonce: toHex(userOp.nonce),
    initCode: userOp.initCode,
    callData: userOp.callData,
    callGasLimit: toHex(userOp.callGasLimit),
    verificationGasLimit: toHex(userOp.verificationGasLimit),
    preVerificationGas: toHex(userOp.preVerificationGas),
    maxFeePerGas: toHex(userOp.maxFeePerGas),
    maxPriorityFeePerGas: toHex(userOp.maxPriorityFeePerGas),
    paymasterAndData: userOp.paymasterAndData,
    signature: userOp.signature,
  };
}

interface RawGasEstimate {
  callGasLimit: string;
  verificationGasLimit?: string;
  verificationGas?: string;
  preVerificationGas: string;
}

function hexToBigInt(value: string | undefined): bigint {
  if (!value) return 0n;
  const normalized = value === '0x' ? '0x0' : value;
  return BigInt(normalized);
}
