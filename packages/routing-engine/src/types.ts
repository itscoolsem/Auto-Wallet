export interface RouteRequest {
  srcChain: string;
  dstChain: string;
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
  recipient: string;
}

export interface QuoteContext {
  now?: number;
  preferOFT?: boolean;
  bridgeToken?: string;
}
