import { resolveBundlerConfig } from './bundlerConfig.js';
import { buildUserOperation } from './userOpBuilder.js';
import { buildWalletExecutorRoute, type RouteEncoderEnv, type WalletExecutorRouteInput } from './routeEncoder.js';
import { entryPointAbi, autoBridgeAccountAbi, autoBridgeAccountFactoryAbi, walletExecutorAbi } from './abis.js';
import type { RoutePlan } from '@autobridge/routing-schema';
import type { UserOperation, UserOperationOverrides } from './types.js';
import type { PublicClient, Hex, Address } from 'viem';
import {
  encodeFunctionData,
  getAddress,
  concatHex,
  erc20Abi,
  maxUint256,
} from 'viem';

const DEFAULT_PRIORITY_FEE = 1_500_000_000n; // 1.5 gwei
const DEFAULT_CALL_GAS_LIMIT = 900_000n;
const DEFAULT_VERIFICATION_GAS_LIMIT = 550_000n;
const DEFAULT_PREVERIFICATION_GAS = 120_000n;

export interface BuildRouteUserOpParams {
  chainSlug: string;
  smartAccount: Address;
  owner: Address;
  routePlan: RoutePlan;
  publicClient: PublicClient;
  env?: Record<string, string | undefined>;
  overrides?: UserOperationOverrides;
  factory?: {
    address: Address;
    salt: Hex;
    owner?: Address;
    initCode?: Hex;
  };
}

export interface RouteUserOpResult {
  userOp: UserOperation;
  route: WalletExecutorRouteInput;
  executorCalldata: Hex;
  accountCallData: Hex;
  callValue: bigint;
  entryPoint: Address;
  walletExecutor: Address;
  paymaster: Address;
}

async function resolveNonce(
  client: PublicClient,
  entryPoint: Address,
  smartAccount: Address,
  override?: bigint,
): Promise<bigint> {
  if (override != null) return override;
  const nonce = await client.readContract({
    address: entryPoint,
    abi: entryPointAbi,
    functionName: 'getNonce',
    args: [smartAccount, 0n],
  } as never);
  return nonce as bigint;
}

async function resolveFeeData(
  client: PublicClient,
  overrides?: Pick<UserOperationOverrides, 'maxFeePerGas' | 'maxPriorityFeePerGas'>,
): Promise<{ maxFeePerGas: bigint; maxPriorityFeePerGas: bigint }> {
  if (overrides?.maxFeePerGas != null && overrides.maxPriorityFeePerGas != null) {
    return {
      maxFeePerGas: overrides.maxFeePerGas,
      maxPriorityFeePerGas: overrides.maxPriorityFeePerGas,
    };
  }

  const block = await client.getBlock({ blockTag: 'latest' });
  const baseFee = block.baseFeePerGas ?? 0n;
  const priority = overrides?.maxPriorityFeePerGas ?? DEFAULT_PRIORITY_FEE;
  const maxFee = overrides?.maxFeePerGas ?? (baseFee * 2n + priority);

  return {
    maxFeePerGas: maxFee,
    maxPriorityFeePerGas: priority,
  };
}

function resolveGasLimits(overrides?: UserOperationOverrides) {
  return {
    callGasLimit: overrides?.callGasLimit ?? DEFAULT_CALL_GAS_LIMIT,
    verificationGasLimit: overrides?.verificationGasLimit ?? DEFAULT_VERIFICATION_GAS_LIMIT,
    preVerificationGas: overrides?.preVerificationGas ?? DEFAULT_PREVERIFICATION_GAS,
  };
}

export async function buildRouteUserOperation(params: BuildRouteUserOpParams): Promise<RouteUserOpResult> {
  const { chainSlug, smartAccount, owner, routePlan, publicClient, env, overrides, factory } = params;

  const bundlerConfig = resolveBundlerConfig(chainSlug, env);
  const paymaster = getAddress(bundlerConfig.paymasterAddress);
  const entryPoint = getAddress(bundlerConfig.entryPoint);
  const walletExecutor = getAddress(bundlerConfig.walletExecutorAddress);

  const routeInput = buildWalletExecutorRoute({
    chainSlug,
    owner,
    paymaster,
    plan: routePlan,
    env: env as RouteEncoderEnv,
    smartAccount,
  });

  const executorCalldata = encodeFunctionData({
    abi: walletExecutorAbi,
    functionName: 'executeRoute',
    args: [routeInput],
  });

  const callValue = routeInput.bridge.fee.nativeFee;

  const approveResetCalldata = encodeFunctionData({
    abi: erc20Abi,
    functionName: 'approve',
    args: [walletExecutor, 0n],
  });

  const approveMaxCalldata = encodeFunctionData({
    abi: erc20Abi,
    functionName: 'approve',
    args: [walletExecutor, maxUint256],
  });

  const transferCalldata = encodeFunctionData({
    abi: erc20Abi,
    functionName: 'transfer',
    args: [walletExecutor, routeInput.amountIn],
  });

  const batchTargets = [routeInput.tokenIn, routeInput.tokenIn, routeInput.tokenIn, walletExecutor];
  const batchValues = [0n, 0n, 0n, callValue];
  const batchData = [approveResetCalldata, approveMaxCalldata, transferCalldata, executorCalldata];

  const accountCallData = encodeFunctionData({
    abi: autoBridgeAccountAbi,
    functionName: 'executeBatch',
    args: [batchTargets, batchValues, batchData],
  });

  const [nonce, fees, gasLimits] = await Promise.all([
    resolveNonce(publicClient, entryPoint, smartAccount, overrides?.nonce),
    resolveFeeData(publicClient, overrides),
    Promise.resolve(resolveGasLimits(overrides)),
  ]);

  const paymasterAndData = overrides?.paymasterAndData ?? paymaster;

  const initCode = (() => {
    if (overrides?.initCode && overrides.initCode !== '0x') {
      return overrides.initCode;
    }
    if (!factory) {
      return overrides?.initCode ?? '0x';
    }
    const factoryAddress = getAddress(factory.address);
    const encodedCreate = factory.initCode
      ? (factory.initCode as Hex)
      : encodeFunctionData({
          abi: autoBridgeAccountFactoryAbi,
          functionName: 'createAccount',
          args: [factory.owner ?? owner, factory.salt],
        });
    return concatHex([factoryAddress, encodedCreate]);
  })();

  const baseUserOp = buildUserOperation({
    sender: smartAccount,
    callData: accountCallData,
    overrides: {
      ...overrides,
      initCode,
      nonce,
      maxFeePerGas: fees.maxFeePerGas,
      maxPriorityFeePerGas: fees.maxPriorityFeePerGas,
      callGasLimit: gasLimits.callGasLimit,
      verificationGasLimit: gasLimits.verificationGasLimit,
      preVerificationGas: gasLimits.preVerificationGas,
      paymasterAndData: paymasterAndData as Hex,
      signature: overrides?.signature ?? '0x',
    },
  });

  return {
    userOp: baseUserOp,
    route: routeInput,
    executorCalldata,
    accountCallData,
    callValue,
    entryPoint,
    walletExecutor,
    paymaster,
  };
}
