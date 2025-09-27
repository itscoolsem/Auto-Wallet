'use client';

import { SparklesIcon } from '@heroicons/react/24/outline';
import { useWallet } from '../providers/WalletProvider';
import { ChainPill } from './elements/ChainPill';

export function TokenHoldings() {
  const { balances } = useWallet();

  return (
    <section className="rounded-3xl border border-border/70 bg-surfaceAlt/50 p-6">
      <header className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">Assets</h2>
        <div className="flex items-center gap-2 text-xs text-primary">
          <SparklesIcon className="h-4 w-4" />
          Gas covered on destination chain
        </div>
      </header>
      <div className="mt-4 space-y-3">
        {balances.map((balance) => (
          <div
            key={`${balance.chainSlug}-${balance.symbol}`}
            className="flex items-center justify-between rounded-2xl border border-border/50 bg-surface/70 px-4 py-3"
          >
            <div>
              <p className="text-sm font-medium text-white">{balance.symbol}</p>
              <p className="text-xs text-slate-400">{balance.name}</p>
            </div>
            <div className="flex items-center gap-4 text-right">
              <ChainPill chainSlug={balance.chainSlug} />
              <div>
                <p className="text-sm font-semibold text-white">{balance.amount}</p>
                <p className="text-xs text-slate-400">${balance.fiatValueUsd.toLocaleString()}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
