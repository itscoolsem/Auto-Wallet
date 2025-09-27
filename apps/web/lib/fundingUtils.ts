import {
  createPublicClient,
  createWalletClient,
  http,
  parseEther,
  type Address,
  type Hex,
} from 'viem';
import { baseSepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';

const BASE_SEPOLIA_RPC = process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC || 'https://sepolia.base.org';
const DEPLOYER_PRIVATE_KEY = '0x58430a917ca89dfe8a91d897a3223b13c76a74e0d17e387723d7437021cac80a';
const WETH_ADDRESS = '0x4200000000000000000000000000000000000006' as Address;
const USDX_ADDRESS = (process.env.NEXT_PUBLIC_USDX_ADDRESS || '0x9316D429a2B91007aD72955C8197D494e7213179') as Address;
const WALLET_EXECUTOR_ADDRESS = (
  process.env.NEXT_PUBLIC_WALLET_EXECUTOR_ADDRESS ||
  process.env.WALLET_EXECUTOR_ADDRESS ||
  '0x43E87FDa96b7A39d4aB1aEb501b867216495CBb0'
) as Address;
const DEFAULT_SWAP_ADAPTER_ADDRESS = (
  process.env.NEXT_PUBLIC_SOURCE_SWAP_ADAPTER_ADDRESS ||
  process.env.SOURCE_SWAP_ADAPTER_ADDRESS ||
  '0xf47E6FA1284a2fbcC925d5514111c7078D976388'
) as Address;

const publicClient = createPublicClient({
  chain: baseSepolia,
  transport: http(BASE_SEPOLIA_RPC),
});

const deployerAccount = privateKeyToAccount(DEPLOYER_PRIVATE_KEY as `0x${string}`);
const deployerClient = createWalletClient({
  account: deployerAccount,
  chain: baseSepolia,
  transport: http(BASE_SEPOLIA_RPC),
});

const walletExecutorAbi = [
  {
    name: 'smartAccount',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
  },
  {
    name: 'swapAdapter',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
  },
  {
    name: 'setSmartAccount',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'smartAccount_', type: 'address' }],
    outputs: [],
  },
  {
    name: 'setSwapAdapter',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'adapter', type: 'address' }],
    outputs: [],
  },
] as const;

export interface WalletExecutorConfigResult {
  smartAccountTx?: Hex;
  swapAdapterTx?: Hex;
  updatedSmartAccount?: Address;
  updatedSwapAdapter?: Address;
}

export interface FundingResult {
  success: boolean;
  txHash?: string;
  error?: string;
}

/**
 * Wrap ETH to WETH for a specific account
 */
export async function wrapEthToWeth(
  userPrivateKey: string,
  amountEth: string = '0.01'
): Promise<FundingResult> {
  try {
    const account = privateKeyToAccount(userPrivateKey as `0x${string}`);
    const walletClient = createWalletClient({
      account,
      chain: baseSepolia,
      transport: http(BASE_SEPOLIA_RPC),
    });

    const txHash = await walletClient.sendTransaction({
      to: WETH_ADDRESS,
      data: '0xd0e30db0', // deposit() function selector
      value: parseEther(amountEth),
    });

    // Wait for confirmation
    await publicClient.waitForTransactionReceipt({ hash: txHash });

    return { success: true, txHash };
  } catch (error) {
    console.error('WETH wrap failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Mint USDX tokens to a specific address using deployer key
 */
export async function mintUsdx(
  recipientAddress: Address,
  amountTokens: string = '1000'
): Promise<FundingResult> {
  try {
    const amount = parseEther(amountTokens); // USDX has 18 decimals

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

    // Wait for confirmation
    await publicClient.waitForTransactionReceipt({ hash: txHash });

    return { success: true, txHash };
  } catch (error) {
    console.error('USDX mint failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Transfer WETH from EOA to smart account
 */
export async function transferWethToSmartAccount(
  userPrivateKey: string,
  smartAccountAddress: Address,
  amountWeth: string = '0.005'
): Promise<FundingResult> {
  try {
    const account = privateKeyToAccount(userPrivateKey as `0x${string}`);
    const walletClient = createWalletClient({
      account,
      chain: baseSepolia,
      transport: http(BASE_SEPOLIA_RPC),
    });

    const amount = parseEther(amountWeth);

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

    // Wait for confirmation
    await publicClient.waitForTransactionReceipt({ hash: txHash });

    return { success: true, txHash };
  } catch (error) {
    console.error('WETH transfer failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

export async function ensureWalletExecutorConfig(
  smartAccountAddress: Address,
  swapAdapterAddress: Address = DEFAULT_SWAP_ADAPTER_ADDRESS,
): Promise<WalletExecutorConfigResult> {
  if (!WALLET_EXECUTOR_ADDRESS || WALLET_EXECUTOR_ADDRESS === '0x0000000000000000000000000000000000000000') {
    console.warn('[walletExecutor] Missing wallet executor address. Skipping configuration.');
    return {};
  }

  const result: WalletExecutorConfigResult = {};

  try {
    console.log('[walletExecutor] Checking configuration', {
      walletExecutor: WALLET_EXECUTOR_ADDRESS,
      smartAccountAddress,
      swapAdapterAddress,
    });

    const [currentSmartAccount, currentSwapAdapter] = await Promise.all([
      publicClient.readContract({
        address: WALLET_EXECUTOR_ADDRESS,
        abi: walletExecutorAbi,
        functionName: 'smartAccount',
      }) as Promise<Address>,
      publicClient.readContract({
        address: WALLET_EXECUTOR_ADDRESS,
        abi: walletExecutorAbi,
        functionName: 'swapAdapter',
      }) as Promise<Address>,
    ]);

    console.log('[walletExecutor] Current on-chain config', {
      currentSmartAccount,
      currentSwapAdapter,
    });

    if (currentSmartAccount.toLowerCase() !== smartAccountAddress.toLowerCase()) {
      console.log('[walletExecutor] Updating smart account binding');
      const txHash = await deployerClient.writeContract({
        address: WALLET_EXECUTOR_ADDRESS,
        abi: walletExecutorAbi,
        functionName: 'setSmartAccount',
        args: [smartAccountAddress],
      });
      await publicClient.waitForTransactionReceipt({ hash: txHash });
      result.smartAccountTx = txHash;
      result.updatedSmartAccount = smartAccountAddress;
      console.log('[walletExecutor] ✅ Smart account binding updated', { txHash });
    } else {
      console.log('[walletExecutor] Smart account already configured');
    }

    if (currentSwapAdapter.toLowerCase() !== swapAdapterAddress.toLowerCase()) {
      console.log('[walletExecutor] Updating swap adapter address');
      const txHash = await deployerClient.writeContract({
        address: WALLET_EXECUTOR_ADDRESS,
        abi: walletExecutorAbi,
        functionName: 'setSwapAdapter',
        args: [swapAdapterAddress],
      });
      await publicClient.waitForTransactionReceipt({ hash: txHash });
      result.swapAdapterTx = txHash;
      result.updatedSwapAdapter = swapAdapterAddress;
      console.log('[walletExecutor] ✅ Swap adapter updated', { txHash });
    } else {
      console.log('[walletExecutor] Swap adapter already configured');
    }

    return result;
  } catch (error) {
    console.error('[walletExecutor] Failed to configure executor', {
      error: error instanceof Error ? error.message : error,
    });
    throw error;
  }
}

/**
 * Check ETH balance for an address
 */
export async function getEthBalance(address: Address): Promise<string> {
  try {
    const balance = await publicClient.getBalance({ address });
    return (Number(balance) / 1e18).toFixed(4);
  } catch (error) {
    console.error('ETH balance check failed:', error);
    return '0';
  }
}

/**
 * Check WETH balance for an address
 */
export async function getWethBalance(address: Address): Promise<string> {
  try {
    const balance = await publicClient.readContract({
      address: WETH_ADDRESS,
      abi: [
        {
          name: 'balanceOf',
          type: 'function',
          stateMutability: 'view',
          inputs: [{ name: 'account', type: 'address' }],
          outputs: [{ name: '', type: 'uint256' }]
        }
      ],
      functionName: 'balanceOf',
      args: [address],
    });
    return (Number(balance) / 1e18).toFixed(4);
  } catch (error) {
    console.error('WETH balance check failed:', error);
    return '0';
  }
}

/**
 * Check USDX balance for an address
 */
export async function getUsdxBalance(address: Address): Promise<string> {
  try {
    const balance = await publicClient.readContract({
      address: USDX_ADDRESS,
      abi: [
        {
          name: 'balanceOf',
          type: 'function',
          stateMutability: 'view',
          inputs: [{ name: 'account', type: 'address' }],
          outputs: [{ name: '', type: 'uint256' }]
        }
      ],
      functionName: 'balanceOf',
      args: [address],
    });
    return (Number(balance) / 1e18).toFixed(4);
  } catch (error) {
    console.error('USDX balance check failed:', error);
    return '0';
  }
}

/**
 * Deploy smart account with minimal transaction
 */
export async function deploySmartAccount(smartAccountAddress: Address): Promise<FundingResult> {
  try {
    console.log('[deploySmartAccount] Deploying smart account:', smartAccountAddress);

    // Simple approach: send ETH to trigger deployment if counterfactual
    const txHash = await deployerClient.sendTransaction({
      to: smartAccountAddress,
      value: parseEther('0.001'), // Small amount to trigger deployment
    });

    console.log('[deploySmartAccount] Transaction sent:', txHash);

    // Wait for confirmation
    await publicClient.waitForTransactionReceipt({ hash: txHash });

    console.log('[deploySmartAccount] ✅ Smart account deployed successfully');

    return { success: true, txHash };
  } catch (error) {
    console.error('[deploySmartAccount] Deployment failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}
