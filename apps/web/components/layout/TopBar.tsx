'use client';

import { BellIcon } from '@heroicons/react/24/outline';
import Image from 'next/image';
import clsx from 'clsx';

import { useWallet } from '../providers/WalletProvider';

export function TopBar() {
  const { smartAccount } = useWallet();

  const status = (() => {
    if (smartAccount.deployed && smartAccount.address && !smartAccount.locked) {
      return { label: 'Smart account ready', tone: 'success' as const };
    }
    if (smartAccount.locked) {
      return { label: 'Wallet locked — unlock to continue', tone: 'warning' as const };
    }
    if (smartAccount.predictedAddress) {
      return { label: 'Smart account will deploy on first action', tone: 'primary' as const };
    }
    if (smartAccount.owner) {
      return { label: 'Deploy your smart account to finish setup', tone: 'primary' as const };
    }
    return { label: 'Create a wallet to get started', tone: 'default' as const };
  })();

  const ownerPreview = smartAccount.owner ? truncate(smartAccount.owner) : undefined;
  const accountPreview = smartAccount.address
    ? truncate(smartAccount.address)
    : smartAccount.predictedAddress
    ? truncate(smartAccount.predictedAddress)
    : undefined;

  return (
    <header className="flex items-center justify-between border-b border-border/70 bg-surface/70 px-8 py-4 backdrop-blur">
      <div>
        <h1 className="text-2xl font-semibold text-white">autowallet</h1>
        <p className="text-sm text-slate-400">Unified USDX transfers with gas sponsorship across Base and Arbitrum.</p>
      </div>
      <div className="flex items-center gap-4">
        <span
          className={clsx(
            'rounded-full border px-4 py-1 text-xs font-medium',
            status.tone === 'success'
              ? 'border-success/40 bg-success/10 text-success'
              : status.tone === 'warning'
              ? 'border-warning/40 bg-warning/10 text-warning'
              : status.tone === 'primary'
              ? 'border-primary/40 bg-primary/15 text-primary'
              : 'border-border/60 bg-surface text-slate-300',
          )}
        >
          {status.label}
        </span>
        <button
          type="button"
          className="flex h-10 w-10 items-center justify-center rounded-full border border-border/70 bg-surfaceAlt/80 hover:bg-surfaceAlt"
        >
          <BellIcon className="h-5 w-5 text-slate-300" />
        </button>
        <div className="flex items-center gap-2 rounded-full border border-border/80 bg-surfaceAlt/70 px-3 py-1 text-sm text-slate-200">
          <Image src="https://avatars.githubusercontent.com/u/0?v=4" alt="avatar" width={24} height={24} className="rounded-full" />
          <div className="flex flex-col leading-tight">
            <span>Demo User</span>
            {ownerPreview ? <span className="text-[11px] text-slate-500">Owner {ownerPreview}</span> : null}
            {accountPreview ? <span className="text-[11px] text-slate-500">Account {accountPreview}</span> : null}
          </div>
        </div>
      </div>
    </header>
  );
}

function truncate(value?: string) {
  if (!value) return '';
  return `${value.slice(0, 6)}…${value.slice(-4)}`;
}
