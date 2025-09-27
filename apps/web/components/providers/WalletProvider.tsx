'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AutoBridgeWalletSDK } from '@autobridge/sdk';
import type { RouteEstimate, SendParams } from '@autobridge/sdk';
import { getToken } from '@autobridge/chains';
import { wordlist } from '@scure/bip39/wordlists/english';
import {
  createPublicClient,
  createWalletClient,
  http,
  type Address,
  type Hex,
  erc20Abi,
  formatUnits,
} from 'viem';
import { baseSepolia } from 'viem/chains';
import { generateMnemonic, mnemonicToAccount, type HDAccount } from 'viem/accounts';

import {
  getStoredWalletMeta,
  persistWallet,
  unlockWallet,
  clearStoredWallet,
  generateHexSalt,
  updateStoredSmartAccountAddress,
} from '../../lib/walletStorage';
import { ensureWalletExecutorConfig } from '../../lib/fundingUtils';
import { resolveEnsName } from '../../lib/ens';
import { fetchPythPrice, type PythPriceData } from '../../lib/pyth';
import { autoBridgeAccountFactoryAbi } from '../../lib/abi/autoBridgeAccountFactory';
import {
  mockActivity,
  mockBalances,
  type ActivityItem,
  type SmartAccountState,
  type TokenBalance,
} from '../../lib/walletData';

interface WalletContextValue {
  smartAccount: SmartAccountState;
  balances: TokenBalance[];
  activity: ActivityItem[];
  isRefreshing: boolean;
  createSmartAccount: (password: string) => Promise<void>;
  unlockSmartAccount: (password: string) => Promise<void>;
  acknowledgeMnemonic: () => void;
  deploySmartAccount: () => Promise<void>;
  refreshBalances: () => Promise<void>;
  estimateRoute: (params: SendParams) => Promise<RouteEstimate>;
  send: (params: SendParams) => Promise<string>;
  swap: (params: SendParams) => Promise<string>;
  getTokenBalance: (chainSlug: string, tokenSymbol: string, owner?: Address) => Promise<string>;
  getOwnerPrivateKey: () => string | undefined;
  getWalletSalt: () => string | undefined;
  resetWallet: () => void;
  pythPrice?: PythPriceData | null;
}

const WalletContext = createContext<WalletContextValue | undefined>(undefined);

const sdk = new AutoBridgeWalletSDK({
  routingServiceUrl: process.env.NEXT_PUBLIC_ROUTING_SERVICE_URL || 'http://localhost:4001'
});

const DEFAULT_BASE_RPC = 'https://sepolia.base.org';
const bundlerUrl = process.env.NEXT_PUBLIC_BASE_BUNDLER_URL ?? 'https://bundler.mock';
const factoryAddressEnv = process.env.NEXT_PUBLIC_ACCOUNT_FACTORY_ADDRESS ?? '';
const baseRpcUrl = process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC ?? DEFAULT_BASE_RPC;

function normalizeAddress(value: string | undefined): Address | undefined {
  if (!value) return undefined;
  return /^0x[a-fA-F0-9]{40}$/.test(value) ? (value as Address) : undefined;
}

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [smartAccount, setSmartAccount] = useState<SmartAccountState>({ deploying: false });
  const [unlockCounter, setUnlockCounter] = useState(0);
  const [balances, setBalances] = useState<TokenBalance[]>(mockBalances);
  const [activity, setActivity] = useState<ActivityItem[]>(mockActivity);
  const [isRefreshing, setRefreshing] = useState(false);
  const [pythPrice, setPythPrice] = useState<PythPriceData | null>(null);
  const ownerAccountRef = useRef<HDAccount | null>(null);

  const factoryAddress = normalizeAddress(factoryAddressEnv);

  const publicClient = useMemo(
    () =>
      createPublicClient({
        chain: baseSepolia,
        transport: http(baseRpcUrl),
      }),
    [baseRpcUrl],
  );

  const walletClient = useMemo(() => {
    const account = ownerAccountRef.current;
    if (!account) return null;
    return createWalletClient({
      account,
      chain: baseSepolia,
      transport: http(baseRpcUrl),
    });
  }, [baseRpcUrl, smartAccount.owner]);

  const aaEnv = useMemo<Record<string, string | undefined>>(
    () => ({
      BASE_BUNDLER_URL:
        process.env.NEXT_PUBLIC_BASE_BUNDLER_URL ?? process.env.BASE_BUNDLER_URL,
      PAYMASTER_ADDRESS:
        process.env.NEXT_PUBLIC_PAYMASTER_ADDRESS ?? process.env.PAYMASTER_ADDRESS,
      WALLET_EXECUTOR_ADDRESS:
        process.env.NEXT_PUBLIC_WALLET_EXECUTOR_ADDRESS ?? process.env.WALLET_EXECUTOR_ADDRESS,
      POOL_HOOK_ADDRESS:
        process.env.NEXT_PUBLIC_POOL_HOOK_ADDRESS ?? process.env.POOL_HOOK_ADDRESS,
      GAS_VAULT_ADDRESS:
        process.env.NEXT_PUBLIC_GAS_VAULT_ADDRESS ?? process.env.GAS_VAULT_ADDRESS,
    }),
    [],
  );

  const computeSmartAccountAddress = useCallback(
    async (owner: Address, salt: Hex): Promise<Address | undefined> => {
      if (!factoryAddress) {
        return undefined;
      }
      try {
        const address = await publicClient.readContract({
          address: factoryAddress,
          abi: autoBridgeAccountFactoryAbi,
          functionName: 'computeAddress',
          args: [owner, salt],
        });
        return address;
      } catch (error) {
        console.error('Failed to compute smart account address', error);
        return undefined;
      }
    },
    [factoryAddress, publicClient],
  );

  const getTokenBalance = useCallback(
    async (chainSlug: string, tokenSymbol: string, owner?: Address): Promise<string> => {
      const target = owner ?? ((smartAccount.address ?? smartAccount.predictedAddress) as Address | undefined);
      if (!target) {
        return '0';
      }

      try {
        const token = getToken(chainSlug as never, tokenSymbol);
        if (!token?.address) {
          return '—';
        }

        if (chainSlug !== 'base-sepolia') {
          console.warn('Token balance lookup currently supports Base Sepolia only', {
            chainSlug,
            tokenSymbol,
          });
          return '—';
        }

        const balance = await publicClient.readContract({
          address: token.address as Address,
          abi: erc20Abi,
          functionName: 'balanceOf',
          args: [target],
        });

        return formatUnits(balance as bigint, token.decimals);
      } catch (error) {
        console.error('Failed to fetch token balance', { chainSlug, tokenSymbol, owner: target, error });
        return '0';
      }
    },
    [publicClient, smartAccount.address, smartAccount.predictedAddress],
  );

  useEffect(() => {
    const meta = getStoredWalletMeta();
    if (!meta) return;

    let cancelled = false;

    const hydrate = async () => {
      let predicted = meta.smartAccountAddress;
      if (!predicted) {
        predicted = await computeSmartAccountAddress(meta.ownerAddress as Address, meta.accountSalt);
      }

      let deployed = false;
      let deployedAddress: Address | undefined;
      if (predicted) {
        try {
          const code = await publicClient.getCode({ address: predicted, blockTag: 'latest' });
          if (code && code !== '0x') {
            deployed = true;
            deployedAddress = predicted;
          }
        } catch (error) {
          console.error('Failed to inspect smart account deployment state', error);
        }
      }

      // Try to auto-unlock for testing (check for unencrypted mnemonic)
      const autoUnlockMnemonic = localStorage.getItem('autobridge.testing.mnemonic');
      if (autoUnlockMnemonic) {
        try {
          const ownerAccount = mnemonicToAccount(autoUnlockMnemonic);
          ownerAccountRef.current = ownerAccount;
          console.log('Auto-unlocked wallet for testing');

          if (!cancelled) {
            setSmartAccount({
              address: deployedAddress,
              predictedAddress: predicted,
              deployed,
              owner: meta.ownerAddress,
              salt: meta.accountSalt,
              bundlerUrl,
              deploying: false,
              locked: false,
              feedback: {
                tone: 'success',
                message: 'Wallet auto-unlocked for testing.',
                timestamp: Date.now(),
              },
            });
            setUnlockCounter(prev => prev + 1);
          }
        } catch (error) {
          console.error('Auto-unlock failed:', error);
          if (!cancelled) {
            setSmartAccount({
              address: deployedAddress,
              predictedAddress: predicted,
              deployed,
              owner: meta.ownerAddress,
              salt: meta.accountSalt,
              bundlerUrl,
              deploying: false,
              locked: true,
              feedback: {
                tone: 'info',
                message: 'Stored wallet detected. Unlock to resume.',
                timestamp: Date.now(),
              },
            });
          }
        }
      } else {
        if (!cancelled) {
          setSmartAccount({
            address: deployedAddress,
            predictedAddress: predicted,
            deployed,
            owner: meta.ownerAddress,
            salt: meta.accountSalt,
            bundlerUrl,
            deploying: false,
            locked: true,
            feedback: {
              tone: 'info',
              message: 'Stored wallet detected. Unlock to resume.',
              timestamp: Date.now(),
            },
          });
        }
      }
    };

    void hydrate();

    return () => {
      cancelled = true;
    };
  }, [bundlerUrl, computeSmartAccountAddress, publicClient]);

  const createSmartAccount = useCallback(
    async (password: string) => {
      if (smartAccount.deploying) return;
      setSmartAccount((prev) => ({
        ...prev,
        deploying: true,
        error: undefined,
        feedback: { tone: 'info', message: 'Generating owner wallet…', timestamp: Date.now() },
      }));
      try {
        console.log('🔄 createSmartAccount: Starting wallet creation process...');
        const mnemonic = generateMnemonic(wordlist);
        console.log('✅ createSmartAccount: Generated mnemonic');

        const ownerAccount = mnemonicToAccount(mnemonic);
        console.log('✅ createSmartAccount: Created owner account:', ownerAccount.address);

        ownerAccountRef.current = ownerAccount;
        console.log('✅ createSmartAccount: Set ownerAccountRef.current');

        // Store unencrypted mnemonic for auto-unlock (testing only)
        localStorage.setItem('autobridge.testing.mnemonic', mnemonic);
        console.log('✅ createSmartAccount: Stored mnemonic in localStorage');

        // Store private key directly for immediate access
        const privateKeyHex = `0x${Buffer.from(ownerAccount.getHdKey().privateKey!).toString('hex')}`;
        localStorage.setItem('autobridge.testing.privatekey', privateKeyHex);
        console.log('✅ createSmartAccount: Stored private key in localStorage:', privateKeyHex.slice(0, 10) + '...');

        const salt = generateHexSalt();
        const smartAccountAddress = await computeSmartAccountAddress(ownerAccount.address, salt);

        await persistWallet(
          mnemonic,
          {
            ownerAddress: ownerAccount.address,
            accountSalt: salt,
            smartAccountAddress: smartAccountAddress,
          },
          password,
        );

        setSmartAccount({
          address: undefined,
          predictedAddress: smartAccountAddress,
          deployed: false,
          owner: ownerAccount.address,
          salt,
          bundlerUrl,
          deploying: false,
          locked: false,
          mnemonic,
          needsBackup: true,
          feedback: {
            tone: 'info',
            message: 'Owner wallet generated. Back up the seed phrase.',
            timestamp: Date.now(),
          },
        });

        // Force re-render for private key access
        setUnlockCounter(prev => prev + 1);

        setActivity((prev) => [
          {
            id: `wallet-${Date.now()}`,
            type: 'receive',
            status: 'confirmed',
            description: 'Wallet seed generated locally',
            timestamp: Date.now(),
            valueUsd: 0,
          },
          ...prev,
        ]);
      } catch (error) {
        console.error('Failed to create wallet', error);
        setSmartAccount((prev) => ({
          ...prev,
          deploying: false,
          error: 'Wallet creation failed',
          feedback: { tone: 'error', message: 'Wallet creation failed. Try again.', timestamp: Date.now() },
        }));
        throw error;
      }
    },
    [computeSmartAccountAddress, smartAccount.deploying],
  );

  const unlockSmartAccount = useCallback(async (password: string) => {
    const unlocked = await unlockWallet(password);
    if (!unlocked) {
      throw new Error('No stored wallet found');
    }
    const ownerAccount = mnemonicToAccount(unlocked.mnemonic);
    console.log('unlockSmartAccount: Created ownerAccount:', ownerAccount);
    console.log('unlockSmartAccount: Setting ownerAccountRef.current');
    ownerAccountRef.current = ownerAccount;
    console.log('unlockSmartAccount: ownerAccountRef.current after set:', ownerAccountRef.current);
    const predicted =
      unlocked.meta.smartAccountAddress ??
      (await computeSmartAccountAddress(ownerAccount.address, unlocked.meta.accountSalt));

    let deployed = false;
    let deployedAddress: Address | undefined;
    if (predicted) {
      try {
        const code = await publicClient.getCode({ address: predicted, blockTag: 'latest' });
        if (code && code !== '0x') {
          deployed = true;
          deployedAddress = predicted;
        }
      } catch (error) {
        console.error('Failed to confirm smart account deployment during unlock', error);
      }
    }

    // Store unencrypted mnemonic for auto-unlock (testing only)
    localStorage.setItem('autobridge.testing.mnemonic', unlocked.mnemonic);
    // Store private key directly for immediate access
    const privateKeyHex = `0x${Buffer.from(ownerAccount.getHdKey().privateKey!).toString('hex')}`;
    localStorage.setItem('autobridge.testing.privatekey', privateKeyHex);

    setSmartAccount({
      address: deployedAddress,
      predictedAddress: predicted,
      deployed,
      owner: unlocked.meta.ownerAddress,
      salt: unlocked.meta.accountSalt,
      bundlerUrl,
      deploying: false,
      locked: false,
      mnemonic: undefined,
      needsBackup: false,
      feedback: {
        tone: 'success',
        message: 'Wallet unlocked successfully.',
        timestamp: Date.now(),
      },
    });

    // Force re-render of components that depend on getOwnerPrivateKey
    setUnlockCounter(prev => prev + 1);
  }, [bundlerUrl, computeSmartAccountAddress, publicClient]);

  const acknowledgeMnemonic = useCallback(() => {
    setSmartAccount((prev) => ({
      ...prev,
      mnemonic: undefined,
      needsBackup: false,
      feedback: { tone: 'success', message: 'Seed phrase acknowledged. Keep it safe!', timestamp: Date.now() },
    }));
  }, []);

  const deploySmartAccount = useCallback(async () => {
    if (!factoryAddress) {
      setSmartAccount((prev) => ({
        ...prev,
        error: 'Factory address missing',
        feedback: { tone: 'error', message: 'Factory address missing in .env.', timestamp: Date.now() },
      }));
      return;
    }
    if (!smartAccount.owner || !smartAccount.salt) {
      setSmartAccount((prev) => ({
        ...prev,
        error: 'Wallet not initialised',
        feedback: { tone: 'error', message: 'Generate a wallet before deploying.', timestamp: Date.now() },
      }));
      return;
    }
    const account = ownerAccountRef.current;
    if (!account) {
      setSmartAccount((prev) => ({
        ...prev,
        error: 'Unlock wallet to deploy',
        feedback: { tone: 'info', message: 'Unlock your wallet before deploying.', timestamp: Date.now() },
      }));
      return;
    }
    setSmartAccount((prev) => ({
      ...prev,
      deploying: true,
      error: undefined,
      feedback: { tone: 'info', message: 'Deploying smart account…', timestamp: Date.now() },
    }));
    try {
      const { request } = await publicClient.simulateContract({
        address: factoryAddress,
        abi: autoBridgeAccountFactoryAbi,
        functionName: 'createAccount',
        args: [account.address, smartAccount.salt as Hex],
        account,
      });
      if (!walletClient) {
        throw new Error('Wallet client unavailable');
      }
      const txHash = await walletClient.writeContract(request);
      const accountAddress = await computeSmartAccountAddress(account.address, smartAccount.salt as Hex);
      if (accountAddress) {
        updateStoredSmartAccountAddress(accountAddress);
      }
      const shortHash = truncateHash(txHash);
      setSmartAccount((prev) => ({
        ...prev,
        address: accountAddress,
        predictedAddress: accountAddress ?? prev.predictedAddress,
        deployed: Boolean(accountAddress),
        deploying: false,
        locked: false,
        feedback: {
          tone: 'success',
          message: `Smart account deployed${shortHash ? ` (tx ${shortHash})` : ''}.`,
          timestamp: Date.now(),
        },
      }));
      setActivity((prev) => [
        {
          id: `deploy-${Date.now()}`,
          type: 'receive',
          status: 'pending',
          description: `Deploying smart account (tx ${txHash.slice(0, 10)}…)`,
          timestamp: Date.now(),
          valueUsd: 0,
        },
        ...prev,
      ]);
    } catch (error) {
      console.error('Smart account deployment failed', error);
      setSmartAccount((prev) => ({
        ...prev,
        deploying: false,
        error: 'Deployment failed',
        feedback: { tone: 'error', message: 'Smart account deployment failed. Check RPC and funds.', timestamp: Date.now() },
      }));
      throw error;
    }
  }, [computeSmartAccountAddress, factoryAddress, publicClient, smartAccount.owner, smartAccount.salt, walletClient]);

  const refreshBalances = useCallback(async () => {
    setRefreshing(true);
    try {
      const walletAddress = smartAccount.address ?? smartAccount.predictedAddress;
      if (!walletAddress) {
        setBalances(mockBalances);
        return;
      }

      // Fetch real balances for WETH and USDX on Base Sepolia
      const [wethBalance, usdxBalance] = await Promise.all([
        getTokenBalance('base-sepolia', 'WETH', walletAddress as Address),
        getTokenBalance('base-sepolia', 'USDX', walletAddress as Address),
      ]);

      const realBalances: TokenBalance[] = [
        {
          symbol: 'WETH',
          name: 'Wrapped Ether',
          chainSlug: 'base-sepolia',
          amount: wethBalance,
          fiatValueUsd: parseFloat(wethBalance) * 2000, // Mock price
        },
        {
          symbol: 'USDX',
          name: 'USDX Token',
          chainSlug: 'base-sepolia',
          amount: usdxBalance,
          fiatValueUsd: parseFloat(usdxBalance) * 1, // $1 per USDX
        },
      ];

      setBalances(realBalances);
    } catch (error) {
      console.error('Failed to refresh balances', error);
      setBalances(mockBalances);
    } finally {
      setRefreshing(false);
    }
  }, [smartAccount.address, smartAccount.predictedAddress, getTokenBalance]);

  const estimateRoute = useCallback(async (params: SendParams) => {
    console.log('💡 estimateRoute: Starting route estimation with params:', params);
    try {
      const result = await sdk.estimateRoute(params);
      console.log('✅ estimateRoute: Route estimation successful:', result);
      return result;
    } catch (error) {
      console.error('❌ estimateRoute: Route estimation failed:', error);
      throw error;
    }
  }, []);

  const assertReady = useCallback(() => {
    if (!(smartAccount.address ?? smartAccount.predictedAddress) || smartAccount.locked) {
      throw new Error('Smart account not ready');
    }
  }, [smartAccount.address, smartAccount.locked, smartAccount.predictedAddress]);

  const submitRoute = useCallback(
    async (params: SendParams, action: 'send' | 'swap') => {
      console.log(`🚀 submitRoute: Starting ${action.toUpperCase()} operation with params:`, params);

      try {
        assertReady();
        console.log('✅ submitRoute: Smart account readiness check passed');
      } catch (error) {
        console.error('❌ submitRoute: Smart account readiness check failed:', error);
        throw error;
      }

      const ownerAccount = ownerAccountRef.current;
      console.log('🔍 submitRoute: Owner account:', ownerAccount ? `${ownerAccount.address}` : 'null');

      let signer = walletClient;
      if (!signer && ownerAccount) {
        console.log('🔄 submitRoute: Creating wallet client from owner account...');
        signer = createWalletClient({
          account: ownerAccount,
          chain: baseSepolia,
          transport: http(baseRpcUrl),
        });
        console.log('✅ submitRoute: Wallet client created');
      }

      let resolvedRecipient = params.recipient;
      if (resolvedRecipient?.toLowerCase().endsWith('.eth')) {
        console.log('🔍 submitRoute: Resolving ENS recipient', resolvedRecipient);
        const ensAddress = await resolveEnsName(resolvedRecipient);
        if (!ensAddress) {
          throw new Error(`Unable to resolve ENS name: ${resolvedRecipient}`);
        }
        resolvedRecipient = ensAddress;
        console.log('✅ submitRoute: ENS resolved', { name: params.recipient, address: ensAddress });
      }

      const normalizedParams: SendParams = {
        ...params,
        recipient: resolvedRecipient,
      };

      const readinessIssues: string[] = [];
      const senderAddress = smartAccount.address ?? smartAccount.predictedAddress;
      console.log('🔍 submitRoute: Checking readiness conditions...');
      console.log('🔍 submitRoute: Sender address:', senderAddress);
      console.log('🔍 submitRoute: Owner account:', ownerAccount ? 'available' : 'missing');
      console.log('🔍 submitRoute: Signer:', signer ? 'available' : 'missing');
      console.log('🔍 submitRoute: Smart account owner:', smartAccount.owner);

      if (!ownerAccount) readinessIssues.push('owner key locked');
      if (!signer) readinessIssues.push('wallet client unavailable');
      if (!senderAddress) readinessIssues.push('smart account address missing');
      if (!smartAccount.owner) readinessIssues.push('owner address missing');

      const isCounterfactual = !smartAccount.deployed || !smartAccount.address;
      console.log('🔍 submitRoute: Is counterfactual deployment:', isCounterfactual);

      if (isCounterfactual) {
        console.log('🔍 submitRoute: Checking counterfactual requirements...');
        console.log('🔍 submitRoute: Factory address:', factoryAddress);
        console.log('🔍 submitRoute: Account salt:', smartAccount.salt);
        if (!factoryAddress) readinessIssues.push('factory address missing');
        if (!smartAccount.salt) readinessIssues.push('account salt missing');
      }

      if (readinessIssues.length > 0) {
        const diagnostic = readinessIssues.join(', ');
        console.error('❌ submitRoute: Submission aborted - wallet not ready:', { action, params, readinessIssues });
        throw new Error(`Unlock your wallet before submitting (${diagnostic})`);
      }
      console.log('✅ submitRoute: All readiness checks passed');

      console.log('🔍 submitRoute: Checking environment variables...');
      const requiredEnv = ['BASE_BUNDLER_URL', 'PAYMASTER_ADDRESS', 'WALLET_EXECUTOR_ADDRESS', 'POOL_HOOK_ADDRESS'];
      const missingEnv = requiredEnv.filter((key) => !aaEnv[key]);
      console.log('🔍 submitRoute: Environment check:', { aaEnv, missingEnv });

      if (missingEnv.length > 0) {
        console.error('❌ submitRoute: Missing environment variables:', missingEnv);
        throw new Error(`Missing environment variables: ${missingEnv.join(', ')}`);
      }
      console.log('✅ submitRoute: Environment variables check passed');

      const now = Date.now();

      let routePlan = normalizedParams.routeOverride;
      if (!routePlan) {
        console.log('🔄 submitRoute: No route override provided, estimating route...');
        try {
          console.log('🔄 submitRoute: Calling estimateRoute with params:', normalizedParams);
          const estimate = await estimateRoute(normalizedParams);
          routePlan = estimate.plan;
          console.log('✅ submitRoute: Route estimation complete', {
            action,
            params: normalizedParams,
            planId: routePlan.id,
            plan: routePlan,
            estimate
          });
        } catch (error) {
          console.error('❌ submitRoute: Route estimation failed:', error);
          const message =
            'Routing service unavailable. Start `npm run dev --workspace apps/routing-service` or provide a manual route override.';
          console.error('❌ submitRoute: Setting error feedback:', message);
          setSmartAccount((prev) => ({
            ...prev,
            feedback: { tone: 'error', message, timestamp: Date.now() },
          }));
          throw new Error(message);
        }
      } else {
        console.log('✅ submitRoute: Using provided route override:', routePlan);
      }
      const activityId = `${action}-${now}`;
      const targetToken = normalizedParams.tokenOut ?? routePlan.sourceSwap?.tokenOut ?? normalizedParams.token;
      const activityDescription =
        action === 'swap'
          ? `Swapping ${normalizedParams.amount} ${normalizedParams.token} to ${targetToken} on ${normalizedParams.sourceChain}`
          : `Sending ${normalizedParams.amount} ${normalizedParams.token} to ${normalizedParams.recipient}`;
      const valueUsd = Number.parseFloat(normalizedParams.amount) || 0;

      setActivity((prev) => [
        {
          id: activityId,
          type: action,
          status: 'pending',
          description: activityDescription,
          timestamp: now,
          valueUsd,
        },
        ...prev,
      ]);

      console.log('🔄 submitRoute: Setting UI feedback and starting execution...');
      setSmartAccount((prev) => ({
        ...prev,
        feedback: { tone: 'info', message: 'Submitting gasless transaction…', timestamp: now },
      }));

      try {
        const executeParams = {
          plan: routePlan,
          chainSlug: routePlan.srcChain,
          smartAccount: senderAddress as Address,
          owner: smartAccount.owner as Address,
          publicClient,
          env: aaEnv,
          signUserOpHash: (hash: any) => {
            console.log('🔐 submitRoute: Signing user operation hash:', hash);
            return signer!.signMessage({
              account: ownerAccount,
              message: { raw: hash },
            });
          },
          factory:
            isCounterfactual && factoryAddress
              ? {
                  address: factoryAddress,
                  salt: smartAccount.salt as Hex,
                  owner: smartAccount.owner as Address,
                }
              : undefined,
        };

        console.log('🚀 submitRoute: Calling SDK executeRoute with params:', executeParams);

        if (senderAddress) {
          try {
            console.log('🔧 submitRoute: Ensuring wallet executor is configured for smart account', {
              walletExecutor: aaEnv.WALLET_EXECUTOR_ADDRESS,
              smartAccount: senderAddress,
            });
            const configResult = await ensureWalletExecutorConfig(senderAddress as Address);
            console.log('✅ submitRoute: Wallet executor configuration result:', configResult);
          } catch (configError) {
            console.error('⚠️ submitRoute: Failed to configure wallet executor', configError);
          }
        }

        const result = await sdk.executeRoute(executeParams);

        console.log('✅ submitRoute: AA submission success!', {
          action,
          params: normalizedParams,
          routePlan,
          userOpHash: result.userOpHash,
          gasEstimates: result.gasEstimates,
          bundlerResponse: result.bundlerResponse,
          result
        });

        setSmartAccount((prev) => ({
          ...prev,
          feedback: {
            tone: 'success',
            message: `${action === 'swap' ? 'Swap' : 'Send'} submitted to bundler.`,
            timestamp: Date.now(),
          },
        }));

        setActivity((prev) =>
          prev.map((item) =>
            item.id === activityId
              ? {
                  ...item,
                  status: 'confirmed',
                  description:
                    action === 'swap'
                      ? `Swap submitted (userOp ${truncateHash(result.userOpHash)})`
                      : `Send submitted (userOp ${truncateHash(result.userOpHash)})`,
                }
              : item,
          ),
        );

        if (isCounterfactual && senderAddress) {
          void (async () => {
            try {
              await new Promise((resolve) => setTimeout(resolve, 3000));
              const code = await publicClient.getCode({ address: senderAddress as Address, blockTag: 'latest' });
              if (code && code !== '0x') {
                setSmartAccount((prev) => ({
                  ...prev,
                  address: senderAddress as Address,
                  predictedAddress: senderAddress as Address,
                  deployed: true,
                }));
                updateStoredSmartAccountAddress(senderAddress as Address);
              }
            } catch (error) {
              console.error('Failed to verify smart account deployment after submission', error);
            }
          })();
        }

        console.log('✅ submitRoute: Returning result:', result.bundlerResponse.result ?? result.userOpHash);
        return result.bundlerResponse.result ?? result.userOpHash;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        console.error(`❌ submitRoute: ${action.toUpperCase()} FAILED!`, {
          action,
          params: normalizedParams,
          error,
          errorMessage: message,
          errorStack: error instanceof Error ? error.stack : undefined,
          routePlan,
          smartAccount,
          aaEnv,
          executeParams: {
            plan: routePlan,
            chainSlug: routePlan.srcChain,
            smartAccount: senderAddress,
            owner: smartAccount.owner,
            env: aaEnv
          }
        });

        console.error('❌ submitRoute: Setting error feedback in UI');
        setSmartAccount((prev) => ({
          ...prev,
          feedback: {
            tone: 'error',
            message: `${action === 'swap' ? 'Swap' : 'Send'} failed: ${message}`,
            timestamp: Date.now(),
          },
        }));

        console.error('❌ submitRoute: Updating activity status to failed');
        setActivity((prev) =>
          prev.map((item) =>
            item.id === activityId
              ? {
                  ...item,
                  status: 'failed',
                  description: `${action === 'swap' ? 'Swap' : 'Send'} failed: ${message}`,
                }
              : item,
          ),
        );

        console.error('❌ submitRoute: Re-throwing error');
        throw error;
      }
    },
    [
      aaEnv,
      assertReady,
      baseRpcUrl,
      estimateRoute,
      factoryAddress,
      publicClient,
      sdk,
      smartAccount.address,
      smartAccount.deployed,
      smartAccount.owner,
      smartAccount.predictedAddress,
      smartAccount.salt,
      walletClient,
    ],
  );

  const send = useCallback((params: SendParams) => {
    console.log('📤 send: Initiating SEND operation with params:', params);
    return submitRoute(params, 'send');
  }, [submitRoute]);

  const swap = useCallback((params: SendParams) => {
    console.log('🔄 swap: Initiating SWAP operation with params:', params);
    return submitRoute(params, 'swap');
  }, [submitRoute]);

  const resetWallet = useCallback(() => {
    clearStoredWallet();
    ownerAccountRef.current = null;
    // Clear any unlock sessions
    Object.keys(sessionStorage).forEach(key => {
      if (key.startsWith('wallet-unlock-')) {
        sessionStorage.removeItem(key);
      }
    });
    // Clear testing mnemonic and private key
    localStorage.removeItem('autobridge.testing.mnemonic');
    localStorage.removeItem('autobridge.testing.privatekey');
    setSmartAccount({ deploying: false });
  }, []);

  const getOwnerPrivateKey = useCallback(() => {
    console.log('🔍 getOwnerPrivateKey: Starting search...');

    // Check if we're in browser environment
    if (typeof window !== 'undefined') {
      console.log('✅ getOwnerPrivateKey: Browser environment detected');

      // Try to get private key directly
      const storedPrivateKey = localStorage.getItem('autobridge.testing.privatekey');
      if (storedPrivateKey) {
        console.log('✅ getOwnerPrivateKey: Found stored private key!', storedPrivateKey.slice(0, 10) + '...');
        return storedPrivateKey;
      } else {
        console.log('❌ getOwnerPrivateKey: No private key in localStorage');
      }

      // Fallback: try to derive from mnemonic
      const storedMnemonic = localStorage.getItem('autobridge.testing.mnemonic');
      if (storedMnemonic) {
        console.log('✅ getOwnerPrivateKey: Found stored mnemonic, deriving private key...');
        try {
          const account = mnemonicToAccount(storedMnemonic);
          const privateKey = `0x${Buffer.from(account.getHdKey().privateKey!).toString('hex')}`;
          console.log('✅ getOwnerPrivateKey: Derived private key from mnemonic', privateKey.slice(0, 10) + '...');
          // Store it for next time
          localStorage.setItem('autobridge.testing.privatekey', privateKey);
          console.log('✅ getOwnerPrivateKey: Stored derived private key in localStorage');
          return privateKey;
        } catch (error) {
          console.error('❌ getOwnerPrivateKey: Failed to generate account from stored mnemonic:', error);
        }
      } else {
        console.log('❌ getOwnerPrivateKey: No mnemonic in localStorage');
      }
    } else {
      console.log('❌ getOwnerPrivateKey: Not in browser environment');
    }

    // Fallback to ref
    console.log('🔍 getOwnerPrivateKey: Checking ownerAccountRef...');
    const refPrivateKeyBytes = ownerAccountRef.current?.getHdKey().privateKey;
    if (refPrivateKeyBytes) {
      const refPrivateKey = `0x${Buffer.from(refPrivateKeyBytes).toString('hex')}`;
      console.log('✅ getOwnerPrivateKey: Using ref private key', refPrivateKey.slice(0, 10) + '...');
      // Also store it in localStorage for persistence
      if (typeof window !== 'undefined') {
        localStorage.setItem('autobridge.testing.privatekey', refPrivateKey);
        console.log('✅ getOwnerPrivateKey: Stored ref private key in localStorage');
      }
      return refPrivateKey;
    } else {
      console.log('❌ getOwnerPrivateKey: ownerAccountRef.current is null or has no private key');
    }

    console.log('❌ getOwnerPrivateKey: No private key found anywhere');
    return undefined;
  }, [unlockCounter]);

  useEffect(() => {
    const feedId = process.env.NEXT_PUBLIC_PYTH_USDX_PRICE_ID ?? process.env.PYTH_USDX_PRICE_ID;
    if (!feedId) return;
    let cancelled = false;
    const load = async () => {
      const data = await fetchPythPrice(feedId);
      if (!cancelled) {
        setPythPrice(data);
      }
    };
    void load();
    const interval = setInterval(load, 60_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const getWalletSalt = useCallback(() => {
    const meta = getStoredWalletMeta();
    return meta?.accountSalt;
  }, []);

  const value = useMemo<WalletContextValue>(
    () => ({
      smartAccount,
      balances,
      activity,
      isRefreshing,
      createSmartAccount,
      unlockSmartAccount,
      acknowledgeMnemonic,
      deploySmartAccount,
      refreshBalances,
      estimateRoute,
      send,
      swap,
      getTokenBalance,
      getOwnerPrivateKey,
      getWalletSalt,
      resetWallet,
      pythPrice,
    }),
    [
      smartAccount,
      balances,
      activity,
      isRefreshing,
      createSmartAccount,
      unlockSmartAccount,
      acknowledgeMnemonic,
      deploySmartAccount,
      refreshBalances,
      estimateRoute,
      send,
      swap,
      getTokenBalance,
      getOwnerPrivateKey,
      getWalletSalt,
      resetWallet,
      pythPrice,
    ],
  );

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet() {
  const ctx = useContext(WalletContext);
  if (!ctx) {
    throw new Error('useWallet must be used within WalletProvider');
  }
  return ctx;
}


function truncateHash(value?: string) {
  if (!value) return '';
  return `${value.slice(0, 10)}…${value.slice(-6)}`;
}
