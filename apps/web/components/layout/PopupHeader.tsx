'use client';

import { useWallet } from '../providers/WalletProvider';
import { formatAddress } from '../../lib/walletStorage';

export function PopupHeader() {
  const { smartAccount } = useWallet();
  const signer = smartAccount.owner ?? '0x';
  const account = smartAccount.address ?? smartAccount.predictedAddress ?? '0x';

  return (
    <header className="flex items-center justify-between border-b border-border/50 px-4 py-3">
      <div>
        <h1 className="text-lg font-semibold leading-tight">AutoBridge Wallet</h1>
        <p className="text-xs text-slate-400">Gasless swaps across Base & Arbitrum</p>
      </div>
      <div className="flex flex-col items-end text-xs text-slate-400">
        <span>Smart account</span>
        <span className="text-primary">{formatAddress(account)}</span>
        <span>Owner {formatAddress(signer)}</span>
      </div>
    </header>
  );
}
