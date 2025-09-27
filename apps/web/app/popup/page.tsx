'use client';

import { useMemo, useEffect, useState } from 'react';
import { ActionPanel } from '../../components/actions/ActionPanel';
import { FundingPanel } from '../../components/wallet/FundingPanel';
import { useWallet } from '../../components/providers/WalletProvider';
import { useSearchParams } from 'next/navigation';
// Inline formatAddress function to avoid import issues
const formatAddress = (address: string): string => {
  if (!address || address === '0x') return '—';
  if (address.length < 10) return address;
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
};

export default function PopupPage() {
  const { smartAccount, getOwnerPrivateKey, getWalletSalt, send, pythPrice } = useWallet();
  const ownerPk = useMemo(() => getOwnerPrivateKey(), [getOwnerPrivateKey]);
  const salt = useMemo(() => getWalletSalt(), [getWalletSalt]);
  const searchParams = useSearchParams();

  const [isPaymentRequest, setIsPaymentRequest] = useState(false);
  const [paymentDetails, setPaymentDetails] = useState<any>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    const payment = searchParams.get('payment');
    const amount = searchParams.get('amount');
    const token = searchParams.get('token');
    const to = searchParams.get('to');

    if (payment === 'true' && amount && token && to) {
      setIsPaymentRequest(true);
      setPaymentDetails({
        amount: parseFloat(amount),
        token,
        to,
        ethAmount: pythPrice ? (parseFloat(amount) / pythPrice.price).toFixed(6) : '0.01'
      });
    }
  }, [searchParams, pythPrice]);

  const handleApprovePayment = async () => {
    if (!paymentDetails || !smartAccount.address && !smartAccount.predictedAddress) {
      return;
    }

    setIsProcessing(true);

    try {
      // Simulate the payment process with real Pyth data
      const result = {
        success: true,
        userOpHash: '0x' + Array(64).fill(0).map(() => Math.floor(Math.random() * 16).toString(16)).join(''),
        transactionHash: '0x' + Array(64).fill(0).map(() => Math.floor(Math.random() * 16).toString(16)).join(''),
        gasUsed: '245,678',
        amount: paymentDetails.amount,
        token: paymentDetails.token,
        to: paymentDetails.to,
        ethAmount: paymentDetails.ethAmount,
        pythPrice: pythPrice
      };

      // Send result back to parent window
      if (window.opener) {
        window.opener.postMessage({
          type: 'PAYMENT_COMPLETED',
          result
        }, window.location.origin);
      }
    } catch (error) {
      console.error('Payment failed:', error);
      // Send error back to parent window
      if (window.opener) {
        window.opener.postMessage({
          type: 'PAYMENT_FAILED',
          error: error instanceof Error ? error.message : 'Payment failed'
        }, window.location.origin);
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCancelPayment = () => {
    if (window.opener) {
      window.opener.postMessage({
        type: 'PAYMENT_CANCELLED'
      }, window.location.origin);
    }
  };

  // If this is a payment request, show payment approval interface
  if (isPaymentRequest && paymentDetails) {
    return (
      <div className="flex h-full flex-col bg-gradient-to-b from-gray-900 to-gray-800">
        {/* Header */}
        <header className="border-b border-border/50 px-4 py-4 bg-gradient-to-r from-indigo-600/20 to-purple-600/20">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center">
              <span className="text-white font-bold text-sm">AW</span>
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">Payment Approval</h1>
              <p className="text-xs text-slate-300">Auto Wallet Transaction</p>
            </div>
          </div>
        </header>

        <main className="flex-1 px-4 py-6 space-y-6">
          {/* Payment Details */}
          <div className="bg-gradient-to-br from-indigo-500/10 to-purple-500/10 rounded-2xl border border-indigo-500/20 p-6">
            <h2 className="text-lg font-bold text-white mb-4">Transaction Details</h2>

            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-slate-300">Amount:</span>
                <span className="text-white font-semibold text-lg">{paymentDetails.amount} {paymentDetails.token}</span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-slate-300">Equivalent ETH:</span>
                <span className="text-white font-semibold">{paymentDetails.ethAmount} ETH</span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-slate-300">To:</span>
                <span className="text-white font-semibold">{paymentDetails.to}</span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-slate-300">Chain:</span>
                <span className="text-white font-semibold">Base → Arbitrum</span>
              </div>

              {pythPrice && (
                <div className="flex justify-between items-center">
                  <span className="text-slate-300">ETH Price (Pyth):</span>
                  <span className="text-white font-semibold">${pythPrice.price.toFixed(2)}</span>
                </div>
              )}

              <div className="flex justify-between items-center">
                <span className="text-slate-300">Gas Fee:</span>
                <span className="text-green-400 font-semibold">Sponsored ✨</span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-3">
            <button
              onClick={handleApprovePayment}
              disabled={isProcessing}
              className={`w-full py-4 px-6 rounded-2xl font-semibold text-white transition duration-200 ${
                isProcessing
                  ? 'bg-gray-600 cursor-not-allowed'
                  : 'bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700'
              }`}
            >
              {isProcessing ? (
                <div className="flex items-center justify-center gap-2">
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Processing...
                </div>
              ) : (
                '✅ Approve Payment'
              )}
            </button>

            <button
              onClick={handleCancelPayment}
              disabled={isProcessing}
              className="w-full py-3 px-6 rounded-2xl font-medium text-slate-300 border border-slate-600 hover:border-slate-500 hover:text-white transition duration-200"
            >
              Cancel
            </button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-gradient-to-b from-gray-900 to-gray-800">
      {/* Enhanced Header */}
      <header className="border-b border-border/50 px-4 py-4 bg-gradient-to-r from-indigo-600/20 to-purple-600/20">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center">
            <span className="text-white font-bold text-sm">AW</span>
          </div>
          <div>
            <h1 className="text-lg font-bold text-white">Auto Wallet</h1>
            <p className="text-xs text-slate-300">Cross-chain payments made simple</p>
          </div>
        </div>

        {/* Status indicator */}
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${smartAccount.address || smartAccount.predictedAddress ? 'bg-green-400' : 'bg-yellow-400'}`}></div>
          <span className="text-xs text-slate-300">
            {smartAccount.address ? 'Wallet Active' : smartAccount.predictedAddress ? 'Wallet Ready' : 'Setup Required'}
          </span>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {/* Account Info Card */}
        <section className="rounded-2xl border border-border/60 bg-gradient-to-br from-gray-800/50 to-gray-700/50 backdrop-blur-sm px-4 py-3 text-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-slate-300 font-medium">Smart Account</span>
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${smartAccount.deployed ? 'bg-green-400' : 'bg-blue-400'}`}></div>
              <span className="text-xs text-slate-400">{smartAccount.deployed ? 'Deployed' : 'Counterfactual'}</span>
            </div>
          </div>

          <code className="text-xs text-indigo-300 block mb-3 p-2 bg-gray-900/50 rounded-lg">
            {formatAddress(smartAccount.address ?? smartAccount.predictedAddress ?? '0x')}
          </code>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="bg-gray-900/30 rounded-lg p-2">
              <span className="text-slate-400 block">Owner</span>
              <span className="text-slate-200">{formatAddress(smartAccount.owner ?? '0x')}</span>
            </div>
            <div className="bg-gray-900/30 rounded-lg p-2">
              <span className="text-slate-400 block">Salt</span>
              <span className="text-slate-200">{salt ? `${salt.slice(0, 6)}…${salt.slice(-4)}` : '—'}</span>
            </div>
          </div>
        </section>

        {/* Enhanced Action Panel */}
        <div className="bg-gradient-to-br from-indigo-500/10 to-purple-500/10 rounded-2xl border border-indigo-500/20 p-1">
          <ActionPanel />
        </div>

        {/* Enhanced Funding Panel */}
        <div className="bg-gradient-to-br from-green-500/10 to-emerald-500/10 rounded-2xl border border-green-500/20 p-1">
          <FundingPanel
            ownerAddress={smartAccount.owner as `0x${string}` | undefined}
            smartAccountAddress={(smartAccount.address ?? smartAccount.predictedAddress) as `0x${string}` | undefined}
            ownerPrivateKey={ownerPk}
            walletSalt={salt}
          />
        </div>

        {/* Quick Stats */}
        {(smartAccount.address || smartAccount.predictedAddress) && (
          <section className="rounded-2xl border border-border/60 bg-gradient-to-br from-blue-500/10 to-cyan-500/10 px-4 py-3">
            <h3 className="text-sm font-semibold text-blue-300 mb-2">Quick Stats</h3>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-gray-900/30 rounded-lg p-2 text-center">
                <div className="text-blue-300 font-semibold">0</div>
                <div className="text-slate-400">Transactions</div>
              </div>
              <div className="bg-gray-900/30 rounded-lg p-2 text-center">
                <div className="text-green-300 font-semibold">$0</div>
                <div className="text-slate-400">Saved Gas</div>
              </div>
            </div>
          </section>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-border/50 px-4 py-3 bg-gray-900/50">
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span>Powered by Uniswap v4 • Pyth • ENS</span>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
            <span>Live</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
