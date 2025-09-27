#!/usr/bin/env node

/**
 * Quick funding script for Base Sepolia testing
 * Usage:
 *   node scripts/fund-account.js wrap <private_key>          # Wrap 0.01 ETH to WETH
 *   node scripts/fund-account.js mint <smart_account_address> # Mint 1000 USDX
 *   node scripts/fund-account.js transfer <private_key> <smart_account_address> # Transfer 0.005 WETH
 */

const { createPublicClient, createWalletClient, http, parseEther } = require('viem');
const { baseSepolia } = require('viem/chains');
const { privateKeyToAccount } = require('viem/accounts');

const BASE_SEPOLIA_RPC = 'https://sepolia.base.org';
const DEPLOYER_PRIVATE_KEY = '0x58430a917ca89dfe8a91d897a3223b13c76a74e0d17e387723d7437021cac80a';
const WETH_ADDRESS = '0x4200000000000000000000000000000000000006';
const USDX_ADDRESS = '0x9316D429a2B91007aD72955C8197D494e7213179';

const publicClient = createPublicClient({
  chain: baseSepolia,
  transport: http(BASE_SEPOLIA_RPC),
});

const deployerAccount = privateKeyToAccount(DEPLOYER_PRIVATE_KEY);
const deployerClient = createWalletClient({
  account: deployerAccount,
  chain: baseSepolia,
  transport: http(BASE_SEPOLIA_RPC),
});

async function wrapEth(userPrivateKey) {
  console.log('🔄 Wrapping 0.01 ETH to WETH...');

  const account = privateKeyToAccount(userPrivateKey);
  const walletClient = createWalletClient({
    account,
    chain: baseSepolia,
    transport: http(BASE_SEPOLIA_RPC),
  });

  const txHash = await walletClient.sendTransaction({
    to: WETH_ADDRESS,
    data: '0xd0e30db0', // deposit() function selector
    value: parseEther('0.01'),
  });

  console.log(`📥 Transaction sent: ${txHash}`);
  await publicClient.waitForTransactionReceipt({ hash: txHash });
  console.log('✅ 0.01 ETH wrapped to WETH successfully!');
}

async function mintUsdx(recipientAddress) {
  console.log(`🪙 Minting 1000 USDX to ${recipientAddress}...`);

  const amount = parseEther('1000');

  const txHash = await deployerClient.writeContract({
    address: USDX_ADDRESS,
    abi: [
      {
        name: 'mint',
        type: 'function',
        stateMutability: 'nonpayable',
        inputs: [
          { name: 'to', type: 'address' },
          { name: 'amount', type: 'uint256' }
        ],
        outputs: []
      }
    ],
    functionName: 'mint',
    args: [recipientAddress, amount],
  });

  console.log(`📥 Transaction sent: ${txHash}`);
  await publicClient.waitForTransactionReceipt({ hash: txHash });
  console.log('✅ 1000 USDX minted successfully!');
}

async function transferWeth(userPrivateKey, smartAccountAddress) {
  console.log(`📤 Transferring 0.005 WETH to ${smartAccountAddress}...`);

  const account = privateKeyToAccount(userPrivateKey);
  const walletClient = createWalletClient({
    account,
    chain: baseSepolia,
    transport: http(BASE_SEPOLIA_RPC),
  });

  const amount = parseEther('0.005');

  const txHash = await walletClient.writeContract({
    address: WETH_ADDRESS,
    abi: [
      {
        name: 'transfer',
        type: 'function',
        stateMutability: 'nonpayable',
        inputs: [
          { name: 'to', type: 'address' },
          { name: 'amount', type: 'uint256' }
        ],
        outputs: [{ name: '', type: 'bool' }]
      }
    ],
    functionName: 'transfer',
    args: [smartAccountAddress, amount],
  });

  console.log(`📥 Transaction sent: ${txHash}`);
  await publicClient.waitForTransactionReceipt({ hash: txHash });
  console.log('✅ 0.005 WETH transferred successfully!');
}

async function main() {
  const [command, ...args] = process.argv.slice(2);

  try {
    switch (command) {
      case 'wrap':
        if (!args[0]) {
          console.error('❌ Usage: node scripts/fund-account.js wrap <private_key>');
          process.exit(1);
        }
        await wrapEth(args[0]);
        break;

      case 'mint':
        if (!args[0]) {
          console.error('❌ Usage: node scripts/fund-account.js mint <smart_account_address>');
          process.exit(1);
        }
        await mintUsdx(args[0]);
        break;

      case 'transfer':
        if (!args[0] || !args[1]) {
          console.error('❌ Usage: node scripts/fund-account.js transfer <private_key> <smart_account_address>');
          process.exit(1);
        }
        await transferWeth(args[0], args[1]);
        break;

      default:
        console.log('💰 AutoBridge Funding Helper');
        console.log('');
        console.log('Commands:');
        console.log('  wrap <private_key>                           Wrap 0.01 ETH → WETH');
        console.log('  mint <smart_account_address>                 Mint 1000 USDX');
        console.log('  transfer <private_key> <smart_account_address> Transfer 0.005 WETH');
        console.log('');
        console.log('Example:');
        console.log('  node scripts/fund-account.js wrap 0x123...');
        console.log('  node scripts/fund-account.js mint 0xabc...');
        console.log('  node scripts/fund-account.js transfer 0x123... 0xabc...');
        break;
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

main().catch(console.error);