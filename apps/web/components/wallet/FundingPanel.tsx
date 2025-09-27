'use client';

import { useState, useEffect } from 'react';
import { type Address } from 'viem';
import clsx from 'clsx';
import {
  wrapEthToWeth,
  mintUsdx,
  transferWethToSmartAccount,
  getEthBalance,
  getWethBalance,
  getUsdxBalance,
  deploySmartAccount,
  type FundingResult
} from '../../lib/fundingUtils';

interface FundingPanelProps {
  ownerAddress?: Address;
  smartAccountAddress?: Address;
  ownerPrivateKey?: string; // From the wallet storage
  walletSalt?: string; // Account salt from wallet storage
}

export function FundingPanel({
  ownerAddress,
  smartAccountAddress,
  ownerPrivateKey,
  walletSalt
}: FundingPanelProps) {
  // Debug logging
  console.log('FundingPanel render:', {
    ownerAddress,
    smartAccountAddress,
    ownerPrivateKey: ownerPrivateKey ? ownerPrivateKey.slice(0, 10) + '...' : 'undefined',
    walletSalt: walletSalt ? walletSalt.slice(0, 10) + '...' : 'undefined'
  });
  const [balances, setBalances] = useState({
    ownerEth: '0',
    ownerWeth: '0',
    ownerUsdx: '0',
    smartEth: '0',
    smartWeth: '0',
    smartUsdx: '0',
  });
  const [isLoading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [feedbackType, setFeedbackType] = useState<'success' | 'error'>('success');
  const [showDebugInfo, setShowDebugInfo] = useState(true); // Always show debug info

  const showFeedback = (message: string, type: 'success' | 'error' = 'success') => {
    setFeedback(message);
    setFeedbackType(type);
    setTimeout(() => setFeedback(null), 5000);
  };

  const refreshBalances = async () => {
    if (!ownerAddress || !smartAccountAddress) return;

    try {
      const [ownerEth, ownerWeth, ownerUsdx, smartEth, smartWeth, smartUsdx] = await Promise.all([
        getEthBalance(ownerAddress),
        getWethBalance(ownerAddress),
        getUsdxBalance(ownerAddress),
        getEthBalance(smartAccountAddress),
        getWethBalance(smartAccountAddress),
        getUsdxBalance(smartAccountAddress),
      ]);

      setBalances({
        ownerEth,
        ownerWeth,
        ownerUsdx,
        smartEth,
        smartWeth,
        smartUsdx,
      });
    } catch (error) {
      console.error('Balance refresh failed:', error);
    }
  };

  useEffect(() => {
    void refreshBalances();
  }, [ownerAddress, smartAccountAddress]);

  const handleWrapEth = async () => {
    if (!ownerPrivateKey) {
      showFeedback('Private key not available', 'error');
      return;
    }

    setLoading(true);
    try {
      const result = await wrapEthToWeth(ownerPrivateKey, '0.01');
      if (result.success) {
        showFeedback(`✅ Wrapped 0.01 ETH to WETH! TX: ${result.txHash?.slice(0, 10)}...`);
        await refreshBalances();
      } else {
        showFeedback(`❌ Wrap failed: ${result.error}`, 'error');
      }
    } catch (error) {
      showFeedback(`❌ Wrap failed: ${error}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleMintUsdx = async () => {
    if (!smartAccountAddress) {
      showFeedback('Smart account address not available', 'error');
      return;
    }

    setLoading(true);
    try {
      const result = await mintUsdx(smartAccountAddress, '1000');
      if (result.success) {
        showFeedback(`✅ Minted 1000 USDX to smart account! TX: ${result.txHash?.slice(0, 10)}...`);
        await refreshBalances();
      } else {
        showFeedback(`❌ Mint failed: ${result.error}`, 'error');
      }
    } catch (error) {
      showFeedback(`❌ Mint failed: ${error}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDeployAccount = async () => {
    if (!smartAccountAddress) {
      showFeedback('Smart account address not available', 'error');
      return;
    }

    setLoading(true);
    try {
      const result = await deploySmartAccount(smartAccountAddress);
      if (result.success) {
        showFeedback(`✅ Smart account deployed! TX: ${result.txHash?.slice(0, 10)}...`);
        await refreshBalances();
      } else {
        showFeedback(`❌ Deployment failed: ${result.error}`, 'error');
      }
    } catch (error) {
      showFeedback(`❌ Deployment failed: ${error}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleTransferWeth = async () => {
    if (!ownerPrivateKey || !smartAccountAddress) {
      showFeedback('Private key or smart account not available', 'error');
      return;
    }

    setLoading(true);
    try {
      const result = await transferWethToSmartAccount(ownerPrivateKey, smartAccountAddress, '0.005');
      if (result.success) {
        showFeedback(`✅ Transferred 0.005 WETH to smart account! TX: ${result.txHash?.slice(0, 10)}...`);
        await refreshBalances();
      } else {
        showFeedback(`❌ Transfer failed: ${result.error}`, 'error');
      }
    } catch (error) {
      showFeedback(`❌ Transfer failed: ${error}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  const isReady = Boolean(ownerAddress && smartAccountAddress && ownerPrivateKey);

  return (
    <section className="rounded-3xl border border-border/70 bg-surfaceAlt/70 p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">💰 Funding Helper</h2>
        <button
          onClick={refreshBalances}
          className="rounded-xl border border-border/60 px-3 py-1 text-xs text-slate-200 hover:border-primary/60 hover:text-primary"
        >
          Refresh
        </button>
      </div>

      {feedback && (
        <div
          className={clsx(
            'mb-4 rounded-2xl border px-4 py-3 text-sm',
            feedbackType === 'success'
              ? 'border-success/50 bg-success/10 text-success'
              : 'border-error/50 bg-error/10 text-error'
          )}
        >
          {feedback}
        </div>
      )}

      {/* Private Key Display */}
      {ownerPrivateKey ? (
        <div className="mb-4 rounded-2xl border border-primary/40 bg-primary/10 p-4">
          <div className="text-primary font-semibold text-sm mb-2">🔑 Private Key Available</div>
          <div className="font-mono text-xs text-slate-300 break-all">
            {ownerPrivateKey}
          </div>
          <button
            onClick={() => navigator.clipboard.writeText(ownerPrivateKey)}
            className="mt-2 text-xs text-primary hover:text-primaryAccent"
          >
            📋 Copy to clipboard
          </button>
        </div>
      ) : (
        <div className="mb-4 rounded-2xl border border-yellow-500/40 bg-yellow-500/10 p-4">
          <div className="text-yellow-400 font-semibold text-sm mb-2">⚠️ No Private Key</div>
          <div className="text-xs text-slate-300">
            Create a new wallet or unlock an existing wallet to see the private key here.
          </div>
        </div>
      )}

      {/* Balance Display */}
      <div className="mb-6 grid grid-cols-2 gap-4 text-sm">
        <div className="rounded-2xl border border-border/60 bg-surface p-3">
          <p className="text-xs text-slate-400 mb-2">Owner EOA</p>
          <p className="text-white">ETH: {balances.ownerEth}</p>
          <p className="text-white">WETH: {balances.ownerWeth}</p>
          <p className="text-white">USDX: {balances.ownerUsdx}</p>
        </div>
        <div className="rounded-2xl border border-border/60 bg-surface p-3">
          <p className="text-xs text-slate-400 mb-2">Smart Account</p>
          <p className="text-white">ETH: {balances.smartEth}</p>
          <p className="text-white">WETH: {balances.smartWeth}</p>
          <p className="text-white">USDX: {balances.smartUsdx}</p>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="space-y-3">
        <button
          onClick={handleDeployAccount}
          disabled={!smartAccountAddress || isLoading}
          className={clsx(
            'w-full rounded-2xl border px-4 py-3 text-sm font-semibold transition',
            smartAccountAddress && !isLoading
              ? 'border-purple-500/40 bg-purple-500/10 text-purple-400 hover:bg-purple-500/20'
              : 'cursor-not-allowed border-border/60 bg-surface text-slate-500'
          )}
        >
          {isLoading ? 'Processing...' : '🚀 Deploy Smart Account (Required First)'}
        </button>

        <button
          onClick={handleWrapEth}
          disabled={!isReady || isLoading}
          className={clsx(
            'w-full rounded-2xl border px-4 py-3 text-sm font-semibold transition',
            isReady && !isLoading
              ? 'border-primary/40 bg-primary text-white hover:bg-primaryAccent'
              : 'cursor-not-allowed border-border/60 bg-surface text-slate-500'
          )}
        >
          {isLoading ? 'Processing...' : '🔄 Wrap 0.01 ETH → WETH (EOA)'}
        </button>

        <button
          onClick={handleMintUsdx}
          disabled={!smartAccountAddress || isLoading}
          className={clsx(
            'w-full rounded-2xl border px-4 py-3 text-sm font-semibold transition',
            smartAccountAddress && !isLoading
              ? 'border-success/40 bg-success/10 text-success hover:bg-success/20'
              : 'cursor-not-allowed border-border/60 bg-surface text-slate-500'
          )}
        >
          {isLoading ? 'Processing...' : '🪙 Mint 1000 USDX (Smart Account)'}
        </button>

        <button
          onClick={handleTransferWeth}
          disabled={!isReady || isLoading}
          className={clsx(
            'w-full rounded-2xl border px-4 py-3 text-sm font-semibold transition',
            isReady && !isLoading
              ? 'border-blue-500/40 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20'
              : 'cursor-not-allowed border-border/60 bg-surface text-slate-500'
          )}
        >
          {isLoading ? 'Processing...' : '📤 Transfer 0.005 WETH → Smart Account'}
        </button>
      </div>

      <div className="mt-4 text-xs text-slate-400">
        <p>• First get Base Sepolia ETH from faucet: <a href="https://bridge.base.org/deposit" target="_blank" className="text-primary hover:underline">bridge.base.org</a></p>
        <p>• Wrap ETH → WETH for swapping</p>
        <p>• Mint USDX for testing swaps</p>
        <p>• Transfer tokens to smart account for paymaster-sponsored swaps</p>
      </div>

      {/* Debug Info Section */}
      <div className="mt-4 border-t border-border/40 pt-4">
        <button
          onClick={() => setShowDebugInfo(!showDebugInfo)}
          className="w-full rounded-xl border border-border/60 px-3 py-2 text-xs text-slate-300 hover:border-primary/60 hover:text-primary transition"
        >
          {showDebugInfo ? '🔒 Hide Debug Info' : '🔍 Show Debug Info'}
        </button>

        {showDebugInfo && (
          <div className="mt-3 space-y-2 rounded-xl border border-yellow-500/40 bg-yellow-500/5 p-3 text-xs font-mono">
            <div className="text-yellow-400 font-semibold">🐛 Debug Information</div>

            <div className="space-y-1">
              <div className="text-slate-300">
                <span className="text-slate-400">Owner Address:</span> {ownerAddress || '❌ Missing'}
              </div>
              <div className="text-slate-300">
                <span className="text-slate-400">Smart Account:</span> {smartAccountAddress || '❌ Missing'}
              </div>
              <div className="text-slate-300">
                <span className="text-slate-400">Private Key:</span> {ownerPrivateKey ? `✅ ${ownerPrivateKey.slice(0, 10)}...${ownerPrivateKey.slice(-6)}` : '❌ Missing'}
              </div>
              <div className="text-slate-300">
                <span className="text-slate-400">Wallet Salt:</span> {walletSalt ? `✅ ${walletSalt.slice(0, 10)}...${walletSalt.slice(-6)}` : '❌ Missing'}
              </div>
              <div className="text-slate-300">
                <span className="text-slate-400">isReady Status:</span> {isReady ? '✅ Ready' : '❌ Not Ready'}
              </div>
            </div>

            {ownerPrivateKey && (
              <div className="mt-3 p-2 bg-slate-900/50 rounded border border-slate-600">
                <div className="text-slate-400 mb-1">Full Private Key (click to copy):</div>
                <button
                  onClick={() => navigator.clipboard.writeText(ownerPrivateKey)}
                  className="text-xs text-yellow-300 hover:text-yellow-200 break-all"
                  title="Click to copy to clipboard"
                >
                  {ownerPrivateKey}
                </button>
              </div>
            )}

            {walletSalt && (
              <div className="mt-3 p-2 bg-slate-900/50 rounded border border-slate-600">
                <div className="text-slate-400 mb-1">Account Salt (click to copy):</div>
                <button
                  onClick={() => navigator.clipboard.writeText(walletSalt)}
                  className="text-xs text-green-300 hover:text-green-200 break-all"
                  title="Click to copy to clipboard"
                >
                  {walletSalt}
                </button>
              </div>
            )}

            <div className="mt-3 space-y-2">
              <button
                onClick={() => {
                  const walletData = {
                    timestamp: new Date().toISOString(),
                    network: 'Base Sepolia',
                    ownerAddress,
                    smartAccountAddress,
                    walletSalt,
                    privateKey: ownerPrivateKey,
                    deployerPrivateKey: '58430a917ca89dfe8a91d897a3223b13c76a74e0d17e387723d7437021cac80a',
                    deployerAddress: '0xEb13414Ac23965D9a2bbCeDC2b3CB7A195d7cE94',
                    contracts: {
                      paymaster: '0xc5026854aeaC69673a8D91fcC54DA9c1779FaC9d',
                      walletExecutor: '0xBd21C35a1bD2DdD3647ad76aAF89163B9AAE7F3c',
                      entryPoint: '0x5ff137d4b0fdcd49dca30c7cf57e578a026d2789',
                      usdxToken: '0x9316D429a2B91007aD72955C8197D494e7213179',
                      wethToken: '0x4200000000000000000000000000000000000006',
                      bridgeSender: '0xa6043B4f718A7965fdaCBe45CA227AbbA556728e'
                    },
                    endpoints: {
                      rpc: 'https://sepolia.base.org',
                      bundler: 'https://api.pimlico.io/v2/84532/rpc?apikey=pim_2EpFnh9Qxs2Hud89jYjjTM',
                      routingService: 'http://localhost:4000'
                    }
                  };

                  const dataStr = JSON.stringify(walletData, null, 2);
                  const blob = new Blob([dataStr], { type: 'application/json' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `autobridge-wallet-${Date.now()}.json`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                className="w-full rounded-xl border border-blue-500/40 bg-blue-500/10 px-3 py-2 text-xs text-blue-400 hover:bg-blue-500/20 transition"
              >
                💾 Export All Wallet Data
              </button>
              <div className="text-xs text-slate-500">
                ⚠️ Keep this information secure and only use for testing!
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}