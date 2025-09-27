'use client';

import { ClockIcon, CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/solid';
import { useWallet } from '../providers/WalletProvider';

const icons = {
  confirmed: CheckCircleIcon,
  pending: ClockIcon,
  failed: XCircleIcon,
} as const;

const colors = {
  confirmed: 'text-success',
  pending: 'text-warning',
  failed: 'text-red-400',
} as const;

export function ActivityFeed() {
  const { activity } = useWallet();

  return (
    <section className="rounded-3xl border border-border/70 bg-surfaceAlt/50 p-6">
      <header className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">Recent Activity</h2>
        <span className="text-xs text-slate-400">Auto-syncs from ERC-4337 UserOps & LayerZero events</span>
      </header>
      <div className="mt-4 space-y-4">
        {activity.map((item) => {
          const Icon = icons[item.status];
          return (
            <div key={item.id} className="flex items-start justify-between gap-4 rounded-2xl border border-border/50 bg-surface/80 px-4 py-3">
              <div className="flex items-center gap-3">
                <Icon className={`h-5 w-5 ${colors[item.status]}`} />
                <div>
                  <p className="text-sm font-medium text-white">{item.description}</p>
                  <p className="text-xs text-slate-500">
                    {new Date(item.timestamp).toLocaleTimeString()} • ${item.valueUsd.toLocaleString()}
                  </p>
                </div>
              </div>
              <div className="rounded-full border border-border/60 px-3 py-1 text-xs capitalize text-slate-300">{item.type}</div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
