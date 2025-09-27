import type { ChainConfig } from '@autobridge/chains';
import type { RoutePlan } from '@autobridge/routing-schema';
import type {
  BundlerGasEstimates,
  BundlerResponse,
  HttpClient,
  RouteUserOpResult,
  UserOperation,
  UserOperationOverrides,
} from '@autobridge/aa';
import type { Address, Hex, PublicClient } from 'viem';

export interface AccountProvider {
  address: string;
  chain: ChainConfig;
}

export interface BalanceSnapshot {
  chain: string;
  token: string;
  amount: string;
  formatted?: string;
}

export interface RouteEstimate {
  plan: RoutePlan;
  slippageBps: number;
}

export interface SendParams {
  amount: string;
  token: string;
  tokenOut?: string;
  sourceChain: string;
  destinationChain: string;
  recipient: string;
  routeOverride?: RoutePlan;
}

export interface WalletSDKConfig {
  chains?: string[];
  routingServiceUrl?: string;
}

export interface AccountFactoryConfig {
  address: Address;
  salt: Hex;
  owner?: Address;
  initCode?: Hex;
}

export interface ExecuteRouteOptions {
  plan: RoutePlan;
  chainSlug: string;
  smartAccount: Address;
  owner: Address;
  publicClient: PublicClient;
  signUserOpHash: (hash: Hex) => Promise<Hex>;
  env?: Record<string, string | undefined>;
  overrides?: UserOperationOverrides;
  httpClient?: HttpClient;
  dryRun?: boolean;
  factory?: AccountFactoryConfig;
}

export interface ExecuteRouteResult {
  userOp: UserOperation;
  userOpHash: Hex;
  routeContext: RouteUserOpResult;
  bundlerResponse: BundlerResponse<string>;
  gasEstimates?: BundlerGasEstimates;
}
