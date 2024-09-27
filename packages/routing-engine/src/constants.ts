export const DEFAULT_TTL_SECONDS = 60;
export const DEFAULT_EXTRA_FEE_BPS = 40;
export const DEFAULT_GAS_VAULT_BPS = 10;
export const DEFAULT_SLIPPAGE_BPS = 50;

// Maximum allowed values for safety
export const MAX_SLIPPAGE_BPS = 1000; // 10%
export const MAX_EXTRA_FEE_BPS = 500; // 5%
export const MAX_TTL_SECONDS = 300; // 5 minutes

// Minimum values
export const MIN_SLIPPAGE_BPS = 1; // 0.01%
export const MIN_EXTRA_FEE_BPS = 0;
export const MIN_TTL_SECONDS = 30; // 30 seconds

// Route optimization
export const ROUTE_CACHE_TTL_MS = 30000; // 30 seconds
export const MAX_ROUTE_HOPS = 3;
