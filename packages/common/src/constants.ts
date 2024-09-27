// Common constants used across the AutoBridge platform

export const PLATFORM_NAME = 'AutoBridge';
export const VERSION = '1.0.0';

// Time constants
export const DEFAULT_TIMEOUT_MS = 30000;
export const REQUEST_TIMEOUT_MS = 10000;
export const RETRY_DELAY_MS = 1000;

// Gas constants
export const DEFAULT_GAS_LIMIT = 300000n;
export const MINIMUM_GAS_LIMIT = 21000n;
export const GAS_BUFFER_MULTIPLIER = 1.2;

// Fee constants
export const DEFAULT_SLIPPAGE_BPS = 50; // 0.5%
export const MAX_SLIPPAGE_BPS = 1000; // 10%
export const MINIMUM_AMOUNT_WEI = 1000n;

// Network constants
export const SUPPORTED_CHAINS = [
  'base-sepolia',
  'optimism-sepolia',
  'ethereum-sepolia',
] as const;

export type SupportedChain = typeof SUPPORTED_CHAINS[number];

// Error codes
export enum ErrorCode {
  INVALID_INPUT = 'INVALID_INPUT',
  NETWORK_ERROR = 'NETWORK_ERROR',
  INSUFFICIENT_BALANCE = 'INSUFFICIENT_BALANCE',
  TRANSACTION_FAILED = 'TRANSACTION_FAILED',
  TIMEOUT = 'TIMEOUT',
}