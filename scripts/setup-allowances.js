#!/usr/bin/env node

/**
 * One-time helper to grant ERC20 allowances from the smart account to the wallet executor.
 *
 * Usage:
 *   node scripts/setup-allowances.js <owner_private_key> <smart_account_address> [executor_address]
 *
 * If executor_address is omitted we fall back to WALLET_EXECUTOR_ADDRESS from the environment.
 */

const {
  createPublicClient,
  createWalletClient,
  encodeFunctionData,
  http,
} = require('viem');
const { baseSepolia } = require('viem/chains');
const { privateKeyToAccount } = require('viem/accounts');

const BASE_SEPOLIA_RPC = process.env.BASE_SEPOLIA_RPC ?? 'https://sepolia.base.org';
const WETH_ADDRESS = process.env.WETH_ADDRESS ?? '0x4200000000000000000000000000000000000006';
const USDX_ADDRESS = process.env.USDX_ADDRESS ?? '0x9316D429a2B91007aD72955C8197D494e7213179';

const autoBridgeAccountAbi = [
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
];

const erc20Abi = [
  {
    type: 'function',
    name: 'approve',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'value', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
];

async function ensureAllowance({ walletClient, token, smartAccount, executor }) {
  const approveData = encodeFunctionData({
    abi: erc20Abi,
    functionName: 'approve',
    args: [executor, (2n ** 256n) - 1n],
  });

  console.log(`➡️  Approving ${token} allowance for executor ${executor}...`);
  const txHash = await walletClient.writeContract({
    address: smartAccount,
    abi: autoBridgeAccountAbi,
    functionName: 'execute',
    args: [token, 0n, approveData],
  });
  console.log(`   ↳ tx: ${txHash}`);
  return txHash;
}

async function main() {
  const [ownerKey, smartAccountAddress, executorAddressArg] = process.argv.slice(2);

  if (!ownerKey || !smartAccountAddress) {
    console.error('Usage: node scripts/setup-allowances.js <owner_private_key> <smart_account_address> [executor_address]');
    process.exit(1);
  }

  const executorAddress = executorAddressArg ?? process.env.WALLET_EXECUTOR_ADDRESS;
  if (!executorAddress) {
    console.error('Executor address missing. Pass it as the third argument or set WALLET_EXECUTOR_ADDRESS in the environment.');
    process.exit(1);
  }

  const ownerAccount = privateKeyToAccount(ownerKey);
  const walletClient = createWalletClient({
    account: ownerAccount,
    chain: baseSepolia,
    transport: http(BASE_SEPOLIA_RPC),
  });

  const publicClient = createPublicClient({
    chain: baseSepolia,
    transport: http(BASE_SEPOLIA_RPC),
  });

  const tokens = [
    { symbol: 'WETH', address: WETH_ADDRESS },
    { symbol: 'USDX', address: USDX_ADDRESS },
  ];

  const txHashes = [];
  for (const token of tokens) {
    const txHash = await ensureAllowance({
      walletClient,
      token: token.address,
      smartAccount: smartAccountAddress,
      executor: executorAddress,
    });
    txHashes.push({ token: token.symbol, txHash });
    await publicClient.waitForTransactionReceipt({ hash: txHash });
    console.log(`   ✅ ${token.symbol} allowance set`);
  }

  console.log('\n✅ Allowances configured');
  for (const entry of txHashes) {
    console.log(`   ${entry.token}: ${entry.txHash}`);
  }
}

main().catch((error) => {
  console.error('❌ Failed to configure allowances:', error.message ?? error);
  process.exit(1);
});

