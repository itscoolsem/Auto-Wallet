'use client';

import { useState } from 'react';
import { RadioGroup } from '@headlessui/react';

import { mockChains } from '../../lib/walletData';

export function ChainSwitcher() {
  const [selected, setSelected] = useState(mockChains[0]);

  return (
    <section className="rounded-3xl border border-border/70 bg-surfaceAlt/70 p-6">
      <header>
        <h2 className="text-lg font-semibold text-white">Preview wallet on</h2>
        <p className="text-xs text-slate-400">Switching chains updates the primary dashboard context.</p>
      </header>
      <RadioGroup value={selected} onChange={setSelected} className="mt-4 space-y-3">
        {mockChains.map((chain) => (
          <RadioGroup.Option key={chain.slug} value={chain}>
            {({ checked }) => (
              <div
                className={`flex items-center justify-between rounded-2xl border px-4 py-3 text-sm transition ${checked ? 'border-primary/60 bg-primary/10 text-white' : 'border-border/60 bg-surface text-slate-300'}`}
              >
                <div>
                  <p className="text-sm font-medium">{chain.name}</p>
                  <p className="text-xs text-slate-400">Status: {chain.status}</p>
                  <p className="text-xs text-slate-400">Bundler env: {chain.bundlerEnv}</p>
                </div>
                <div className="text-xs uppercase tracking-widest text-slate-400">Chain ID {chain.chainId}</div>
              </div>
            )}
          </RadioGroup.Option>
        ))}
      </RadioGroup>
    </section>
  );
}
