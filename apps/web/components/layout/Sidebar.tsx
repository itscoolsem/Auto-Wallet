'use client';

import Link from 'next/link';
import type { Route } from 'next';
import { usePathname } from 'next/navigation';
import { WalletIcon, Cog6ToothIcon, ArrowPathRoundedSquareIcon, RocketLaunchIcon } from '@heroicons/react/24/outline';
import clsx from 'clsx';

const nav = [
  {
    label: 'Wallet',
    href: '/' as Route,
    icon: WalletIcon,
  },
  {
    label: 'Demo Store',
    href: '/demo' as Route,
    icon: RocketLaunchIcon,
  },
  {
    label: 'Chains',
    href: '/chains' as Route,
    icon: ArrowPathRoundedSquareIcon,
  },
  {
    label: 'Settings',
    href: '/settings' as Route,
    icon: Cog6ToothIcon,
  },
] as const satisfies Array<{ label: string; href: Route; icon: typeof WalletIcon }>;

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex h-full w-60 flex-col justify-between border-r border-border/60 bg-surface/80 px-4 py-6">
      <div>
        <Link href="/" className="flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/15">
            <span className="text-lg font-semibold text-primary">AB</span>
          </div>
          <span className="text-lg font-semibold">AutoBridge</span>
        </Link>
        <nav className="mt-10 space-y-2">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={clsx(
                'flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition',
                pathname === item.href
                  ? 'bg-primary/15 text-primary'
                  : 'text-slate-300 hover:bg-surfaceAlt/80 hover:text-white',
              )}
            >
              <item.icon className="h-5 w-5" />
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
      <div className="rounded-xl border border-border/80 p-4 text-xs text-slate-400">
        <p className="font-semibold text-slate-200">Gas vault</p>
        <p className="mt-1 text-lg font-semibold text-slate-100">2.45 ETH</p>
        <p className="mt-1">Covers sponsored transactions across all chains.</p>
      </div>
    </aside>
  );
}
