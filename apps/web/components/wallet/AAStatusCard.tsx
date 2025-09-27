'use client';

import { useEffect, useMemo, useState } from 'react';
import { ShieldCheckIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import clsx from 'clsx';

import { AutoBridgeWalletSDK } from '@autobridge/sdk';

import { useWallet } from '../providers/WalletProvider';

interface StatusState {
  ok: boolean;
  missing?: string;
}

const sdk = new AutoBridgeWalletSDK();

export function AAStatusCard() {
  const { smartAccount } = useWallet();
  const [status, setStatus] = useState<StatusState>({ ok: true });

  useEffect(() => {
    try {
      sdk.ensureEnvironmentReady();
      setStatus({ ok: true });
    } catch (error) {
      if (error instanceof Error) {
        setStatus({ ok: false, missing: error.message });
      } else {
        setStatus({ ok: false, missing: 'Unknown error' });
      }
    }
  }, []);

  const walletMessage = useMemo(() => {
    if (smartAccount.locked) {
      return 'Wallet detected but locked. Unlock it to continue.';
    }
    if (smartAccount.deployed && smartAccount.address) {
      return `Smart account ready at ${truncate(smartAccount.address)}.`;
    }
    if (smartAccount.predictedAddress) {
      return `Smart account will deploy at ${truncate(smartAccount.predictedAddress)} on first sponsored transaction.`;
    }
    if (smartAccount.owner) {
      return 'Owner generated. Deploy the smart account to finish onboarding.';
    }
    return 'No wallet yet. Generate one to enable cross-chain actions.';
  }, [smartAccount.address, smartAccount.deployed, smartAccount.locked, smartAccount.owner, smartAccount.predictedAddress]);

  return (
    <div
      className={clsx(
        'space-y-4 rounded-3xl border bg-surfaceAlt/70 p-6 text-sm',
        status.ok ? 'border-success/50 text-slate-200' : 'border-warning/60 text-slate-200',
      )}
    >
      <div className="flex items-center gap-3">
        {status.ok ? (
          <ShieldCheckIcon className="h-5 w-5 text-success" />
        ) : (
          <ExclamationTriangleIcon className="h-5 w-5 text-warning" />
        )}
        <div>
          <p className="text-base font-semibold text-white">Environment readiness</p>
          <p className="text-xs text-slate-400">
            {status.ok
              ? 'Bundler, paymaster, LayerZero, and oracle settings look valid.'
              : status.missing ?? 'Missing configuration detected.'}
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-border/60 bg-surface px-4 py-3 text-xs text-slate-300">
        <p className="uppercase tracking-[0.2em] text-slate-500">Wallet status</p>
        <p className="mt-2 text-slate-200">{walletMessage}</p>
        {smartAccount.owner ? (
          <p className="mt-2 font-mono text-[11px] text-slate-400">Owner: {truncate(smartAccount.owner)}</p>
        ) : null}
      </div>
    </div>
  );
}

function truncate(value?: string): string {
  if (!value) return 'n/a';
  return `${value.slice(0, 6)}…${value.slice(-4)}`;
}
