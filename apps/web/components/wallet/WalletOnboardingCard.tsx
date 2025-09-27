'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  CheckCircleIcon,
  ExclamationTriangleIcon,
  LockClosedIcon,
  RocketLaunchIcon,
  ShieldCheckIcon,
  SparklesIcon,
} from '@heroicons/react/24/solid';
import { ArrowPathIcon } from '@heroicons/react/24/outline';
import clsx from 'clsx';

import { useWallet } from '../providers/WalletProvider';
import { WalletOnboardingDialog } from './WalletOnboardingDialog';

const STEP_TITLES = {
  create: 'Generate owner wallet',
  backup: 'Back up seed phrase',
  deploy: 'Deploy smart account',
} as const;

type DialogMode = 'create' | 'unlock' | 'backup' | null;

type StepKey = keyof typeof STEP_TITLES;

interface StepConfig {
  key: StepKey;
  description: string;
  complete: boolean;
  action?: React.ReactNode;
  warning?: string;
}

export function WalletOnboardingCard() {
  const {
    smartAccount,
    createSmartAccount,
    unlockSmartAccount,
    acknowledgeMnemonic,
    deploySmartAccount,
    resetWallet,
  } = useWallet();
  const [dialogMode, setDialogMode] = useState<DialogMode>(null);
  const [isDeploying, setDeploying] = useState(false);
  const hasOwner = Boolean(smartAccount.owner);
  const walletLocked = Boolean(smartAccount.locked);
  const needsBackup = Boolean(hasOwner && smartAccount.needsBackup);
  const deployed = Boolean(smartAccount.deployed && smartAccount.address);
  const predictedAddress = smartAccount.address ?? smartAccount.predictedAddress;

  useEffect(() => {
    if (smartAccount.mnemonic && smartAccount.needsBackup) {
      setDialogMode('backup');
    }
  }, [smartAccount.mnemonic, smartAccount.needsBackup]);

  const handleCreate = () => setDialogMode('create');
  const handleUnlock = () => setDialogMode('unlock');
  const handleBackup = () => setDialogMode('backup');
  const handleDialogClose = () => setDialogMode(null);

  const handleDeploy = async () => {
    if (walletLocked) {
      setDialogMode('unlock');
      return;
    }
    setDeploying(true);
    try {
      await deploySmartAccount();
    } finally {
      setDeploying(false);
    }
  };

  const steps: StepConfig[] = useMemo(() => {
    const createComplete = hasOwner;
    const backupComplete = hasOwner && !needsBackup;
    const deployComplete = deployed;

    return [
      {
        key: 'create',
        description: createComplete
          ? `Owner address ${truncate(smartAccount.owner)} ready.`
          : 'Generate a new mnemonic locally and secure it with a password.',
        complete: createComplete,
        warning: createComplete && walletLocked ? 'Wallet locked — unlock to continue.' : undefined,
        action: createComplete ? (
          walletLocked ? (
            <OnboardingButton icon={LockClosedIcon} onClick={handleUnlock}>
              Unlock wallet
            </OnboardingButton>
          ) : (
            <span className="text-xs text-success flex items-center gap-1"><ShieldCheckIcon className="h-4 w-4" /> Ready</span>
          )
        ) : (
          <OnboardingButton icon={SparklesIcon} onClick={handleCreate}>
            Create wallet
          </OnboardingButton>
        ),
      },
      {
        key: 'backup',
        description: backupComplete
          ? 'Seed phrase stored safely. Keep it offline for recovery.'
          : 'Write down your 12-word seed phrase and confirm you’ve saved it.',
        complete: backupComplete,
        warning: needsBackup ? 'Backup required before deploying.' : undefined,
        action: needsBackup ? (
          <OnboardingButton icon={ShieldCheckIcon} onClick={handleBackup}>
            View seed phrase
          </OnboardingButton>
        ) : backupComplete ? (
          <span className="text-xs text-success flex items-center gap-1"><CheckCircleIcon className="h-4 w-4" /> Backed up</span>
        ) : null,
      },
      {
        key: 'deploy',
        description: deployComplete
          ? `Smart account deployed at ${truncate(smartAccount.address)}.`
          : predictedAddress
          ? `Smart account will deploy automatically at ${truncate(predictedAddress)} when you submit your first sponsored action.`
          : 'Smart account will deploy automatically when you submit your first sponsored action.',
        complete: deployComplete,
        warning:
          !deployComplete && !hasOwner
            ? 'Generate a wallet before deploying.'
            : !deployComplete && walletLocked
            ? 'Unlock your wallet to deploy the smart account.'
            : undefined,
        action: deployComplete ? (
          <span className="text-xs text-success flex items-center gap-1"><CheckCircleIcon className="h-4 w-4" /> Deployed</span>
        ) : (
          <span className="text-xs text-info flex items-center gap-1">
            <RocketLaunchIcon className="h-4 w-4" /> Auto-deploy on first paymaster-backed action
          </span>
        ),
      },
    ];
  }, [deployed, hasOwner, handleBackup, handleCreate, handleDeploy, handleUnlock, isDeploying, needsBackup, smartAccount.address, smartAccount.owner, walletLocked]);

  return (
    <section className="space-y-4 rounded-3xl border border-border/70 bg-surfaceAlt/70 p-6">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Onboarding</p>
          <h2 className="text-xl font-semibold text-white">Set up your AutoBridge wallet</h2>
        </div>
        {hasOwner ? (
          <button
            type="button"
            onClick={resetWallet}
            className="flex items-center gap-1 rounded-full border border-border/60 px-3 py-1 text-xs text-slate-400 hover:text-white"
            title="Clear local wallet data"
          >
            <ArrowPathIcon className="h-4 w-4" /> Reset
          </button>
        ) : null}
      </header>

      <ol className="space-y-6">
        {steps.map((step, idx) => (
          <li key={step.key} className="flex gap-4">
            <StepIcon index={idx} complete={step.complete} />
            <div className="flex-1 space-y-2">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-white">{STEP_TITLES[step.key]}</p>
                  <p className="text-xs text-slate-400">{step.description}</p>
                  {step.warning ? (
                    <span className="mt-2 inline-flex items-center gap-2 text-xs text-warning">
                      <ExclamationTriangleIcon className="h-4 w-4" />
                      {step.warning}
                    </span>
                  ) : null}
                </div>
                {step.action}
              </div>
            </div>
          </li>
        ))}
      </ol>

      {dialogMode ? (
        <WalletOnboardingDialog
          open
          mode={dialogMode === 'create' && smartAccount.mnemonic && smartAccount.needsBackup ? 'backup' : dialogMode}
          smartAccount={smartAccount}
          onClose={handleDialogClose}
          onCreate={createSmartAccount}
          onUnlock={unlockSmartAccount}
          onAcknowledge={() => {
            acknowledgeMnemonic();
            handleDialogClose();
          }}
        />
      ) : null}
      {smartAccount.feedback ? (
        <div
          className={clsx(
            'rounded-2xl border px-4 py-3 text-xs',
            smartAccount.feedback.tone === 'success'
              ? 'border-success/40 bg-success/10 text-success'
              : smartAccount.feedback.tone === 'error'
              ? 'border-warning/40 bg-warning/10 text-warning'
              : 'border-info/40 bg-info/10 text-info',
          )}
        >
          {smartAccount.feedback.message}
        </div>
      ) : null}
    </section>
  );
}

function StepIcon({ index, complete }: { index: number; complete: boolean }) {
  if (complete) {
    return (
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-success/10 text-success">
        <CheckCircleIcon className="h-5 w-5" />
      </div>
    );
  }
  return (
    <div className="flex h-8 w-8 items-center justify-center rounded-full border border-border/60 text-xs text-slate-400">
      {index + 1}
    </div>
  );
}

function OnboardingButton({
  icon: Icon,
  children,
  onClick,
  disabled,
  loading,
}: {
  icon: typeof CheckCircleIcon;
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      className={clsx(
        'flex items-center gap-2 rounded-full border border-primary/40 bg-primary/15 px-3 py-1 text-xs font-semibold text-primary transition hover:bg-primary/20 disabled:cursor-not-allowed disabled:opacity-60',
      )}
    >
      {loading ? <ArrowPathIcon className="h-4 w-4 animate-spin" /> : <Icon className="h-4 w-4" />}
      {children}
    </button>
  );
}

function truncate(value?: string): string {
  if (!value) return 'n/a';
  return `${value.slice(0, 6)}…${value.slice(-4)}`;
}
