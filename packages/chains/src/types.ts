export interface NativeCurrency {
  symbol: string;
  decimals: number;
}

export interface Erc4337Config {
  bundlerEnv: string;
  paymasterEnv: string;
  walletExecutorEnv: string;
  entryPoint: string;
}

export interface LayerZeroConfig {
  endpointEnv: string;
}

export interface ChainConfig {
  chainId: number;
  name: string;
  rpcEnv: string;
  nativeCurrency: NativeCurrency;
  erc4337: Erc4337Config;
  layerZero: LayerZeroConfig;
}

export interface TokenConfig {
  address: string;
  decimals: number;
  pythPriceEnv: string;
}

export type ChainTokenMap = Record<string, TokenConfig>;

export interface Registry {
  chains: Record<string, ChainConfig>;
  tokens: Record<string, ChainTokenMap>;
}

export type ChainSlug = keyof Registry['chains'];
