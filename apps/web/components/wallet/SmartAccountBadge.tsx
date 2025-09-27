'use client';

import { useEffect, useMemo, useState } from 'react';
import { CheckCircleIcon, ClockIcon, PlusIcon, LockClosedIcon } from '@heroicons/react/24/solid';
import clsx from 'clsx';

import type { SmartAccountState } from '../../lib/walletData';
import { WalletOnboardingDialog } from './WalletOnboardingDialog';

interface SmartAccountBadgeProps {
  smartAccount: SmartAccountState;
  onCreate: (password: string) => Promise<void>;
  onUnlock: (password: string) => Promise<void>;
  onAcknowledge: () => void;
  onDeploy: () => Promise<void>;
  onReset: () => void;
}

type BadgeStatus = 'ready' | 'deploying' | 'locked' | 'needs-deploy' | 'missing';

export function SmartAccountBadge({
  smartAccount,
  onCreate,
  onUnlock,
  onAcknowledge,
  onDeploy,
  onReset,
}: SmartAccountBadgeProps) {
  const [mode, setMode] = useState<'create' | 'unlock' | 'backup' | null>(null);

  const status: BadgeStatus = useMemo(() => {
    if (smartAccount.deploying) return 'deploying';
    if (smartAccount.locked) return 'locked';
    if (smartAccount.deployed && smartAccount.address) return 'ready';
    if (smartAccount.owner) return 'needs-deploy';
    return 'missing';
  }, [smartAccount.address, smartAccount.deployed, smartAccount.deploying, smartAccount.locked, smartAccount.owner]);

  useEffect(() => {
    if (smartAccount.mnemonic && smartAccount.needsBackup) {
      setMode('backup');
    }
  }, [smartAccount.mnemonic, smartAccount.needsBackup]);

  const buttonLabel = {
    missing: 'Create wallet',
    locked: 'Unlock wallet',
    deploying: 'Creating…',
    'needs-deploy': 'Deploy smart account',
    ready: 'Smart account ready',
  }[status];

  const openMode = () => {
    if (status === 'locked') {
      setMode('unlock');
    } else {
      setMode('create');
    }
  };

  if (status === 'ready') {
    return (
      <div className="flex items-center gap-2 rounded-full border border-success/40 bg-success/10 px-3 py-1 text-sm text-success">
        <CheckCircleIcon className="h-4 w-4" />
        Smart account ready
      </div>
    );
  }

  if (status === 'needs-deploy') {
    return (
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-2 rounded-full border border-info/40 bg-info/10 px-3 py-1 text-sm text-info">
          <ClockIcon className="h-4 w-4" />
          Auto-deploys on first action
        </div>
        {smartAccount.owner ? (
          <button
            type="button"
            onClick={onReset}
            className="text-xs text-slate-500 hover:text-slate-300"
            title="Clear stored wallet"
          >
            Reset
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={openMode}
          disabled={status === 'deploying'}
          className={clsx(
            'flex items-center gap-2 rounded-full border px-3 py-1 text-sm transition',
            status === 'deploying'
              ? 'border-warning/40 bg-warning/10 text-warning'
              : status === 'locked'
              ? 'border-primary/40 bg-primary/10 text-primary hover:bg-primary/20'
              : status === 'needs-deploy'
              ? 'border-info/40 bg-info/10 text-info hover:bg-info/20'
              : 'border-primary/40 bg-primary/10 text-primary hover:bg-primary/20',
          )}
        >
          {status === 'deploying' ? (
            <ClockIcon className="h-4 w-4" />
          ) : status === 'locked' ? (
            <LockClosedIcon className="h-4 w-4" />
          ) : (
            <PlusIcon className="h-4 w-4" />
          )}
          {buttonLabel}
        </button>
        {smartAccount.owner ? (
          <button
            type="button"
            onClick={onReset}
            className="text-xs text-slate-500 hover:text-slate-300"
            title="Clear stored wallet"
          >
            Reset
          </button>
        ) : null}
      </div>

      {mode ? (
        <WalletOnboardingDialog
          open
          mode={mode === 'create' && smartAccount.mnemonic && smartAccount.needsBackup ? 'backup' : mode}
          smartAccount={smartAccount}
          onClose={() => setMode(null)}
          onCreate={onCreate}
          onUnlock={onUnlock}
          onAcknowledge={onAcknowledge}
        />
      ) : null}
    </>
  );
}
