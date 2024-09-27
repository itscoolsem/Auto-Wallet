import type { RoutePlan } from '@autobridge/routing-schema';

export interface TokenBalance {
  symbol: string;
  name: string;
  chainSlug: string;
  amount: string;
  fiatValueUsd: number;
  icon?: string;
}

export interface ActivityItem {
  id: string;
  type: 'send' | 'receive' | 'swap' | 'bridge';
  status: 'pending' | 'confirmed' | 'failed';
  description: string;
  timestamp: number;
  valueUsd: number;
  txHash?: string;
  fromChain?: string;
  toChain?: string;
}

export interface SmartAccountState {
  address?: string;
  predictedAddress?: string;
  deployed?: boolean;
  owner?: string;
  salt?: `0x${string}`;
  deploying?: boolean;
  bundlerUrl?: string;
  locked?: boolean;
  mnemonic?: string;
  needsBackup?: boolean;
  error?: string;
  feedback?: {
    tone: 'success' | 'error' | 'info';
    message: string;
    timestamp: number;
  };
}

export interface PlannedRoute {
  label: string;
  plan: RoutePlan;
}

export interface ChainStatusRow {
  slug: string;
  name: string;
  chainId: number;
  status: 'Healthy' | 'Degraded' | 'Unknown';
  lzEndpointEnv: string;
  rpcEnv: string;
  rpcFallback: string;
  explorer: string;
  bundlerEnv: string;
  bundlerNote?: string;
}

export const mockBalances: TokenBalance[] = [
  {
    symbol: 'USDCx',
    name: 'Super USDC',
    chainSlug: 'base-sepolia',
    amount: '1,250.42',
    fiatValueUsd: 1250.42,
  },
  {
    symbol: 'WETH',
    name: 'Wrapped Ether',
    chainSlug: 'optimism-sepolia',
    amount: '2.13',
    fiatValueUsd: 6358.47,
  },
  {
    symbol: 'PLAY',
    name: 'Play Token',
    chainSlug: 'arbitrum-sepolia',
    amount: '12,500',
    fiatValueUsd: 2150.0,
  },
];

export const mockActivity: ActivityItem[] = [
  {
    id: 'tx-1',
    type: 'bridge',
    status: 'confirmed',
    description: 'Bridged 250 USDCx from Base to Optimism via AutoBridge',
    timestamp: Date.now() - 1000 * 60 * 60,
    valueUsd: 250,
  },
  {
    id: 'tx-2',
    type: 'send',
    status: 'pending',
    description: 'Sent 0.25 WETH to vitalik.base.eth',
    timestamp: Date.now() - 1000 * 60 * 15,
    valueUsd: 745,
  },
  {
    id: 'tx-3',
    type: 'swap',
    status: 'confirmed',
    description: 'Swapped 300 PLAY to USDCx on Base Sepolia',
    timestamp: Date.now() - 1000 * 60 * 4,
    valueUsd: 300,
  },
];

export const mockChains: ChainStatusRow[] = [
  {
    slug: 'base-sepolia',
    name: 'Base Sepolia',
    chainId: 84532,
    status: 'Healthy',
    lzEndpointEnv: 'LZ_BASE_SEPOLIA_ENDPOINT',
    rpcEnv: 'BASE_SEPOLIA_RPC',
    rpcFallback: 'https://sepolia.base.org',
    explorer: 'https://sepolia.basescan.org',
    bundlerEnv: 'NEXT_PUBLIC_BASE_BUNDLER_URL',
    bundlerNote: 'Configured via Pimlico testnet endpoint.',
  },
  {
    slug: 'optimism-sepolia',
    name: 'Optimism Sepolia',
    chainId: 11155420,
    status: 'Degraded',
    lzEndpointEnv: 'LZ_OPTIMISM_SEPOLIA_ENDPOINT',
    rpcEnv: 'OPTIMISM_SEPOLIA_RPC',
    rpcFallback: 'https://sepolia.optimism.io',
    explorer: 'https://sepolia-optimism.etherscan.io',
    bundlerEnv: 'NEXT_PUBLIC_OPTIMISM_BUNDLER_URL',
    bundlerNote: 'StackUp project ID required (pending).',
  },
  {
    slug: 'arbitrum-sepolia',
    name: 'Arbitrum Sepolia',
    chainId: 421614,
    status: 'Healthy',
    lzEndpointEnv: 'LZ_ARBITRUM_SEPOLIA_ENDPOINT',
    rpcEnv: 'ARBITRUM_SEPOLIA_RPC',
    rpcFallback: 'https://sepolia-rollup.arbitrum.io/rpc',
    explorer: 'https://sepolia.arbiscan.io',
    bundlerEnv: 'NEXT_PUBLIC_ARBITRUM_BUNDLER_URL',
    bundlerNote: 'Configured via Pimlico testnet endpoint.',
  },
];
