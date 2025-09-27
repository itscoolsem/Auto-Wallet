export const autoBridgeAccountFactoryAbi = [
  {
    type: 'function',
    name: 'computeAddress',
    inputs: [
      { name: 'owner', type: 'address', internalType: 'address' },
      { name: 'salt', type: 'bytes32', internalType: 'bytes32' },
    ],
    outputs: [{ name: '', type: 'address', internalType: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'createAccount',
    inputs: [
      { name: 'owner', type: 'address', internalType: 'address' },
      { name: 'salt', type: 'bytes32', internalType: 'bytes32' },
    ],
    outputs: [{ name: 'account', type: 'address', internalType: 'address' }],
    stateMutability: 'nonpayable',
  },
] as const;
