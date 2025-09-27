import type { Abi } from 'viem';

export const autoBridgeAccountAbi = [
  {
    type: 'function',
    name: 'execute',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'target', type: 'address' },
      { name: 'value', type: 'uint256' },
      { name: 'data', type: 'bytes' },
    ],
    outputs: [{ name: 'result', type: 'bytes' }],
  },
  {
    type: 'function',
    name: 'executeBatch',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'targets', type: 'address[]' },
      { name: 'values', type: 'uint256[]' },
      { name: 'data', type: 'bytes[]' },
    ],
    outputs: [],
  },
] as const satisfies Abi;

export const autoBridgeAccountFactoryAbi = [
  {
    type: 'function',
    name: 'computeAddress',
    stateMutability: 'view',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'salt', type: 'bytes32' },
    ],
    outputs: [{ name: '', type: 'address' }],
  },
  {
    type: 'function',
    name: 'createAccount',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'salt', type: 'bytes32' },
    ],
    outputs: [{ name: 'account', type: 'address' }],
  },
] as const satisfies Abi;

export const walletExecutorAbi = [
  {
    type: 'function',
    name: 'executeRoute',
    stateMutability: 'payable',
    inputs: [
      {
        name: 'route',
        type: 'tuple',
        components: [
          { name: 'user', type: 'address' },
          { name: 'tokenIn', type: 'address' },
          { name: 'amountIn', type: 'uint256' },
          {
            name: 'permit',
            type: 'tuple',
            components: [
              { name: 'usePermit', type: 'bool' },
              { name: 'value', type: 'uint256' },
              { name: 'deadline', type: 'uint256' },
              { name: 'v', type: 'uint8' },
              { name: 'r', type: 'bytes32' },
              { name: 's', type: 'bytes32' },
            ],
          },
          {
            name: 'sourceSwap',
            type: 'tuple',
            components: [
              { name: 'execute', type: 'bool' },
              {
                name: 'poolKey',
                type: 'tuple',
                components: [
                  { name: 'currency0', type: 'address' },
                  { name: 'currency1', type: 'address' },
                  { name: 'fee', type: 'uint24' },
                  { name: 'tickSpacing', type: 'int24' },
                  { name: 'hooks', type: 'address' },
                ],
              },
              {
                name: 'swapParams',
                type: 'tuple',
                components: [
                  { name: 'zeroForOne', type: 'bool' },
                  { name: 'amountSpecified', type: 'int256' },
                  { name: 'sqrtPriceLimitX96', type: 'uint160' },
                ],
              },
              {
                name: 'bridgeFee',
                type: 'tuple',
                components: [
                  { name: 'extraFeeBps', type: 'uint16' },
                  { name: 'maxFeeBps', type: 'uint16' },
                  { name: 'quoteTimestamp', type: 'uint64' },
                  { name: 'ttl', type: 'uint64' },
                  { name: 'nativeFee', type: 'uint128' },
                ],
              },
              {
                name: 'gasFee',
                type: 'tuple',
                components: [
                  { name: 'vault', type: 'address' },
                  { name: 'skimBps', type: 'uint16' },
                  { name: 'maxSkimBps', type: 'uint16' },
                ],
              },
              { name: 'minAmountOut', type: 'uint256' },
            ],
          },
          {
            name: 'bridge',
            type: 'tuple',
            components: [
              { name: 'dstEid', type: 'uint32' },
              { name: 'destExecutor', type: 'address' },
              { name: 'options', type: 'bytes' },
              {
                name: 'fee',
                type: 'tuple',
                components: [
                  { name: 'nativeFee', type: 'uint128' },
                  { name: 'lzTokenFee', type: 'uint128' },
                ],
              },
              { name: 'refundAddress', type: 'address' },
              {
                name: 'destPayload',
                type: 'tuple',
                components: [
                  { name: 'recipient', type: 'address' },
                  {
                    name: 'destSwap',
                    type: 'tuple',
                    components: [
                      { name: 'execute', type: 'bool' },
                      { name: 'tokenOut', type: 'address' },
                      {
                        name: 'poolKey',
                        type: 'tuple',
                        components: [
                          { name: 'currency0', type: 'address' },
                          { name: 'currency1', type: 'address' },
                          { name: 'fee', type: 'uint24' },
                          { name: 'tickSpacing', type: 'int24' },
                          { name: 'hooks', type: 'address' },
                        ],
                      },
                      {
                        name: 'swapParams',
                        type: 'tuple',
                        components: [
                          { name: 'zeroForOne', type: 'bool' },
                          { name: 'amountSpecified', type: 'int256' },
                          { name: 'sqrtPriceLimitX96', type: 'uint160' },
                        ],
                      },
                      { name: 'hookData', type: 'bytes' },
                      { name: 'minAmountOut', type: 'uint256' },
                    ],
                  },
                  { name: 'quoteTimestamp', type: 'uint64' },
                  { name: 'ttl', type: 'uint64' },
                  { name: 'pricePayload', type: 'bytes' },
                ],
              },
            ],
          },
        ],
      },
    ],
    outputs: [{ name: 'messageId', type: 'bytes32' }],
  },
] as const satisfies Abi;

export const entryPointAbi = [
  {
    type: 'function',
    name: 'getNonce',
    stateMutability: 'view',
    inputs: [
      { name: 'sender', type: 'address' },
      { name: 'key', type: 'uint192' },
    ],
    outputs: [{ name: 'nonce', type: 'uint256' }],
  },
] as const satisfies Abi;
