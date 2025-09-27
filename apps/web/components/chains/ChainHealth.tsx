'use client';

import { ShieldCheckIcon } from '@heroicons/react/24/outline';

import { mockChains } from '../../lib/walletData';

const statusColor: Record<string, string> = {
  Healthy: 'text-success',
  Degraded: 'text-warning',
};

export function ChainHealth() {
  return (
    <section className="space-y-4">
      {mockChains.map((chain) => {
        const bundlerEnvValue = (process.env as Record<string, string | undefined>)[chain.bundlerEnv];
        const bundlerStatus = bundlerEnvValue ? 'Configured' : 'Missing';
        return (
          <div key={chain.slug} className="rounded-3xl border border-border/70 bg-surfaceAlt/70 p-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-white">{chain.name}</h2>
                <p className="text-xs text-slate-400">Chain ID: <code className="font-mono text-slate-300">{chain.chainId}</code></p>
                <p className="text-xs text-slate-400">RPC env: <code className="font-mono text-slate-300">{chain.rpcEnv}</code></p>
                <p className="text-xs text-slate-400">
                  Fallback RPC:{' '}
                  <a href={chain.rpcFallback} className="underline" target="_blank" rel="noreferrer">
                    {chain.rpcFallback}
                  </a>
                </p>
                <p className="text-xs text-slate-400">LayerZero endpoint env: <code className="font-mono text-slate-300">{chain.lzEndpointEnv}</code></p>
                <p className="text-xs text-slate-400">Bundler URL: <span className="font-mono text-slate-300">{bundlerEnvValue ?? 'pending'}</span></p>
              </div>
              <div className="flex items-center gap-2 rounded-full border border-border/60 bg-surface px-3 py-1 text-sm text-slate-100">
                <ShieldCheckIcon className="h-5 w-5 text-primary" />
                <span className={statusColor[chain.status] ?? 'text-slate-300'}>{chain.status}</span>
              </div>
            </div>
            <div className="mt-4 grid gap-3 text-xs text-slate-400 md:grid-cols-2">
              <div className="rounded-2xl border border-border/50 bg-surface/70 p-4">
                <p className="text-slate-300">ERC-4337</p>
                <p>Bundler status: {bundlerStatus}</p>
                {chain.bundlerNote ? <p className="text-xs text-slate-500">{chain.bundlerNote}</p> : null}
                <p>Paymaster env: <code className="font-mono text-xs">PAYMASTER_ADDRESS</code></p>
              </div>
              <div className="rounded-2xl border border-border/50 bg-surface/70 p-4">
                <p className="text-slate-300">Explorers & Ops</p>
                <p>
                  Explorer:{' '}
                  <a href={chain.explorer} className="underline" target="_blank" rel="noreferrer">
                    {chain.explorer}
                  </a>
                </p>
                <p>LayerZero endpoint ID pending confirmation.</p>
              </div>
            </div>
          </div>
        );
      })}
    </section>
  );
}
