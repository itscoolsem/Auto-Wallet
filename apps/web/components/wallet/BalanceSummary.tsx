'use client';

import { ArrowTrendingUpIcon, ArrowUpOnSquareIcon, ArrowDownOnSquareIcon } from '@heroicons/react/24/outline';
import clsx from 'clsx';

import { useWallet } from '../providers/WalletProvider';

export function BalanceSummary() {
  const { balances, smartAccount } = useWallet();

  const total = balances.reduce((acc, item) => acc + item.fiatValueUsd, 0);
  const hasSmartAccount = Boolean(smartAccount.address ?? smartAccount.predictedAddress);

  return (
    <section className="rounded-3xl border border-border/70 bg-surfaceAlt/70 p-6 shadow-card">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm uppercase tracking-widest text-slate-400">Portfolio Value</p>
          <p className="mt-2 text-4xl font-semibold text-white">${total.toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
          <p className="mt-1 text-xs text-slate-400">Across Base, Optimism, and Arbitrum</p>
        </div>
        <div className="flex gap-3">
          <ActionButton label="Send" icon={ArrowUpOnSquareIcon} disabled={!hasSmartAccount || smartAccount.locked} />
          <ActionButton label="Receive" icon={ArrowDownOnSquareIcon} disabled={!hasSmartAccount} />
          <ActionButton label="Swap" icon={ArrowTrendingUpIcon} disabled={!hasSmartAccount || smartAccount.locked} />
        </div>
      </div>
    </section>
  );
}

interface ActionButtonProps {
  label: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  disabled?: boolean;
}

function ActionButton({ label, icon: Icon, disabled }: ActionButtonProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      className={clsx(
        'flex items-center gap-2 rounded-2xl border px-4 py-3 text-sm font-medium transition',
        disabled
          ? 'border-border/60 bg-surface text-slate-500'
          : 'border-primary/40 bg-primary/15 text-primary hover:bg-primary/20',
      )}
    >
      <Icon className="h-5 w-5" />
      {label}
    </button>
  );
}
