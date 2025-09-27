'use client';

import clsx from 'clsx';
import { mockChains } from '../../../lib/walletData';

interface ChainPillProps {
  chainSlug: string;
}

const palette: Record<string, string> = {
  'base-sepolia': 'bg-blue-500/20 text-blue-200',
  'optimism-sepolia': 'bg-red-500/20 text-red-200',
  'arbitrum-sepolia': 'bg-cyan-500/20 text-cyan-200',
};

export function ChainPill({ chainSlug }: ChainPillProps) {
  const chain = mockChains.find((item) => item.slug === chainSlug);
  return (
    <span
      className={clsx(
        'rounded-full px-3 py-1 text-xs font-medium capitalize',
        palette[chainSlug] ?? 'bg-slate-500/20 text-slate-200',
      )}
    >
      {chain?.name ?? chainSlug}
    </span>
  );
}
