'use client';

import { useEffect, useState } from 'react';
import clsx from 'clsx';

import type { SmartAccountState } from '../../lib/walletData';

interface WalletOnboardingDialogProps {
  open: boolean;
  mode: 'create' | 'unlock' | 'backup';
  smartAccount: SmartAccountState;
  onClose: () => void;
  onCreate: (password: string) => Promise<void>;
  onUnlock: (password: string) => Promise<void>;
  onAcknowledge: () => void;
}

export function WalletOnboardingDialog({
  open,
  mode,
  smartAccount,
  onClose,
  onCreate,
  onUnlock,
  onAcknowledge,
}: WalletOnboardingDialogProps) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) {
      setPassword('');
      setConfirmPassword('');
      setError(null);
      setSubmitting(false);
    }
  }, [open, mode]);

  if (!open) return null;

  const submittingLabel = mode === 'create' ? 'Creating wallet…' : 'Unlocking…';

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (mode === 'create') {
      if (!password) {
        setError('Choose a password to encrypt your seed phrase.');
        return;
      }
      if (password !== confirmPassword) {
        setError('Passwords do not match.');
        return;
      }
    }

    setSubmitting(true);
    try {
      if (mode === 'create') {
        await onCreate(password);
      } else if (mode === 'unlock') {
        await onUnlock(password);
        onClose();
      }
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Something went wrong');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
      <div className="w-full max-w-lg rounded-3xl border border-border/60 bg-surface p-6 text-sm text-slate-200 shadow-2xl">
        {mode === 'backup' ? (
          <BackupStep smartAccount={smartAccount} onClose={onClose} onAcknowledge={onAcknowledge} />
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <header className="space-y-1">
              <h2 className="text-lg font-semibold text-white">
                {mode === 'create' ? 'Create your wallet' : 'Unlock your wallet'}
              </h2>
              <p className="text-xs text-slate-400">
                {mode === 'create'
                  ? 'Generate a new mnemonic locally and protect it with a password. No keys leave your browser.'
                  : 'Enter the password you used when creating this wallet to decrypt the mnemonic and continue.'}
              </p>
            </header>

            <div className="space-y-4">
              <label className="flex flex-col gap-1 text-xs uppercase tracking-widest text-slate-400">
                Password
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="new-password"
                  className="rounded-2xl border border-border/60 bg-surfaceAlt px-3 py-2 text-sm text-white"
                  placeholder="Create a strong password"
                  required
                />
              </label>

              {mode === 'create' ? (
                <label className="flex flex-col gap-1 text-xs uppercase tracking-widest text-slate-400">
                  Confirm password
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    autoComplete="new-password"
                    className="rounded-2xl border border-border/60 bg-surfaceAlt px-3 py-2 text-sm text-white"
                    placeholder="Repeat password"
                    required
                  />
                </label>
              ) : null}
            </div>

            {error || smartAccount.error ? (
              <p className="rounded-2xl border border-warning/50 bg-warning/10 px-3 py-2 text-xs text-warning">
                {error ?? smartAccount.error}
              </p>
            ) : null}

            <div className="flex justify-end gap-3">
              <button
                type="button"
                className="rounded-2xl border border-border/50 bg-transparent px-4 py-2 text-xs uppercase tracking-[0.2em] text-slate-400 hover:bg-surfaceAlt"
                onClick={onClose}
              >
                Cancel
              </button>
              <button
                type="submit"
                className={clsx(
                  'rounded-2xl border border-primary/40 bg-primary px-5 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-white transition',
                  isSubmitting && 'opacity-70',
                )}
                disabled={isSubmitting}
              >
                {isSubmitting ? submittingLabel : mode === 'create' ? 'Create wallet' : 'Unlock'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

function BackupStep({
  smartAccount,
  onClose,
  onAcknowledge,
}: {
  smartAccount: SmartAccountState;
  onClose: () => void;
  onAcknowledge: () => void;
}) {
  const mnemonic = smartAccount.mnemonic ?? 'Mnemonic unavailable';

  const words = mnemonic.split(' ');

  const handleCopy = async () => {
    try {
      if (typeof navigator === 'undefined' || !navigator.clipboard) {
        throw new Error('Clipboard API unavailable');
      }
      await navigator.clipboard.writeText(mnemonic);
    } catch (error) {
      console.error('Failed to copy mnemonic', error);
    }
  };

  const handleComplete = () => {
    onAcknowledge();
    onClose();
  };

  return (
    <div className="space-y-5">
      <header className="space-y-1">
        <h2 className="text-lg font-semibold text-white">Secure your seed phrase</h2>
        <p className="text-xs text-slate-400">
          Write these 12 words down in order. They unlock your wallet if you ever clear your browser storage.
        </p>
      </header>

      <ol className="grid grid-cols-2 gap-2 rounded-2xl border border-border/60 bg-surfaceAlt p-4 text-sm font-mono text-slate-200">
        {words.map((word, idx) => (
          <li key={word + idx} className="flex items-center gap-2">
            <span className="w-6 text-xs text-slate-500">{idx + 1}.</span>
            <span>{word}</span>
          </li>
        ))}
      </ol>

      <div className="rounded-2xl border border-border/60 bg-surfaceAlt px-4 py-3 text-xs text-slate-300">
        <div className="flex items-center justify-between">
          <span className="uppercase tracking-[0.2em] text-slate-500">Owner EOA</span>
          <span className="font-mono text-slate-200">{smartAccount.owner}</span>
        </div>
        {smartAccount.address ? (
          <div className="mt-2 flex items-center justify-between">
            <span className="uppercase tracking-[0.2em] text-slate-500">Smart account</span>
            <span className="font-mono text-slate-200">{smartAccount.address}</span>
          </div>
        ) : null}
        {smartAccount.salt ? (
          <div className="mt-2 flex items-center justify-between">
            <span className="uppercase tracking-[0.2em] text-slate-500">Salt</span>
            <span className="font-mono text-slate-200">{smartAccount.salt}</span>
          </div>
        ) : null}
      </div>

      <div className="flex justify-between gap-3">
        <button
          type="button"
          onClick={handleCopy}
          className="rounded-2xl border border-border/60 bg-surfaceAlt px-4 py-2 text-xs uppercase tracking-[0.2em] text-slate-300 hover:bg-surface"
        >
          Copy seed phrase
        </button>
        <button
          type="button"
          onClick={handleComplete}
          className="rounded-2xl border border-success/40 bg-success px-5 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-white"
        >
          I stored it safely
        </button>
      </div>
    </div>
  );
}
