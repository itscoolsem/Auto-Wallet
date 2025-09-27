'use client';

import { Tab } from '@headlessui/react';
import { ClipboardDocumentIcon, CheckIcon } from '@heroicons/react/24/outline';
import clsx from 'clsx';
import { useEffect, useState } from 'react';

import { useWallet } from '../providers/WalletProvider';

const tabs = [
  { key: 'send', label: 'Send' },
  { key: 'receive', label: 'Receive' },
  { key: 'swap', label: 'Swap' },
  { key: 'bridge', label: 'Bridge' },
] as const;

type ActionTab = (typeof tabs)[number]['key'];

export function ActionPanel() {
  const [active, setActive] = useState<ActionTab>('send');
  const { smartAccount } = useWallet();

  const walletReady = Boolean((smartAccount.address ?? smartAccount.predictedAddress) && smartAccount.owner);
  const walletAddress = smartAccount.address ?? smartAccount.predictedAddress ?? 'Deploy your smart account to reveal address';
  const feedback = smartAccount.feedback;

  return (
    <section className="rounded-3xl border border-border/70 bg-surfaceAlt/70 p-6">
      {feedback ? (
        <div
          className={clsx(
            'mb-4 rounded-2xl border px-4 py-3 text-sm',
            feedback.tone === 'success'
              ? 'border-success/50 bg-success/10 text-success'
              : feedback.tone === 'error'
                ? 'border-error/50 bg-error/10 text-error'
                : 'border-primary/40 bg-primary/10 text-primary',
          )}
        >
          {feedback.message}
        </div>
      ) : null}
      <Tab.Group selectedIndex={tabs.findIndex((tab) => tab.key === active)} onChange={(idx) => setActive(tabs[idx].key)}>
        <Tab.List className="flex gap-2">
          {tabs.map((tab) => (
            <Tab
              key={tab.key}
              className={({ selected }) =>
                clsx(
                  'rounded-2xl px-4 py-2 text-sm font-medium outline-none transition',
                  selected ? 'bg-primary text-white' : 'bg-surface/70 text-slate-300 hover:bg-surface',
                )
              }
            >
              {tab.label}
            </Tab>
          ))}
        </Tab.List>
        <div className="mt-6 space-y-4">
          {active === 'send' && <SendForm disabled={!walletReady} />}
          {active === 'receive' && (
            <ReceivePanel
              smartAccountAddress={walletAddress}
              ownerAddress={smartAccount.owner}
              locked={smartAccount.locked}
              deployed={smartAccount.deployed}
            />
          )}
          {active === 'swap' && <SwapForm disabled={!walletReady} />}
          {active === 'bridge' && <BridgePlanner disabled={!walletReady} />}
        </div>
      </Tab.Group>
    </section>
  );
}

function FormSection({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 gap-4 md:grid-cols-2">{children}</div>;
}

function Label({ title, description }: { title: string; description?: string }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium text-white">{title}</span>
      {description ? <span className="text-xs text-slate-400">{description}</span> : null}
    </label>
  );
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={clsx(
        'rounded-2xl border border-border/60 bg-surface px-3 py-2 text-sm text-white placeholder:text-slate-500',
        props.className,
      )}
    />
  );
}

function Select({ children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={clsx(
        'rounded-2xl border border-border/60 bg-surface px-3 py-2 text-sm text-white',
        props.className,
      )}
    >
      {children}
    </select>
  );
}

function PrimaryButton(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...props}
      className={clsx(
        'w-full rounded-2xl border border-primary/40 bg-primary px-4 py-3 text-sm font-semibold text-white transition hover:bg-primaryAccent disabled:cursor-not-allowed disabled:opacity-60',
        props.className,
      )}
    />
  );
}

function SendForm({ disabled }: { disabled: boolean }) {
  const { send } = useWallet();
  const [isSubmitting, setSubmitting] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (disabled) return;
    const form = new FormData(event.currentTarget);
    const params = {
      amount: String(form.get('amount') ?? '0'),
      token: String(form.get('token') ?? 'USDCx'),
      sourceChain: String(form.get('sourceChain') ?? 'base-sepolia'),
      destinationChain: String(form.get('destinationChain') ?? 'optimism-sepolia'),
      recipient: String(form.get('recipient') ?? ''),
    };

    setSubmitting(true);
    try {
      await send(params);
    } catch (error) {
      console.error('Send failed', error);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" aria-disabled={disabled}>
      <FormSection>
        <Label title="From chain" description="Source network" />
        <Select name="sourceChain" defaultValue="base-sepolia" disabled={disabled}>
          <option value="base-sepolia">Base Sepolia</option>
          <option value="optimism-sepolia">Optimism Sepolia</option>
          <option value="arbitrum-sepolia">Arbitrum Sepolia</option>
        </Select>
        <Label title="To chain" description="Destination network" />
        <Select name="destinationChain" defaultValue="optimism-sepolia" disabled={disabled}>
          <option value="optimism-sepolia">Optimism Sepolia</option>
          <option value="base-sepolia">Base Sepolia</option>
          <option value="arbitrum-sepolia">Arbitrum Sepolia</option>
        </Select>
        <Label title="Token" description="Asset to transfer" />
        <Select name="token" defaultValue="USDCx" disabled={disabled}>
          <option value="USDCx">USDCx</option>
          <option value="WETH">WETH</option>
          <option value="PLAY">PLAY</option>
        </Select>
        <Label title="Recipient" description="ENS or address" />
        <Input name="recipient" placeholder="vitalik.base.eth" required disabled={disabled} />
        <Label title="Amount" description="Amount to send" />
        <Input name="amount" placeholder="100" required disabled={disabled} />
      </FormSection>
      <PrimaryButton type="submit" disabled={disabled || isSubmitting}>
        {disabled ? 'Unlock wallet first' : isSubmitting ? 'Submitting…' : 'Send gasless'}
      </PrimaryButton>
    </form>
  );
}

function ReceivePanel({
  smartAccountAddress,
  ownerAddress,
  locked,
  deployed,
}: {
  smartAccountAddress: string;
  ownerAddress?: string;
  locked?: boolean;
  deployed?: boolean;
}) {
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [mintCopied, setMintCopied] = useState(false);

  async function copyValue(value: string, field: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 1500);
    } catch (error) {
      console.error('Failed to copy value', { field, error });
    }
  }

  const usdxAddress = process.env.NEXT_PUBLIC_USDX_ADDRESS ?? process.env.USDX_ADDRESS;
  const hasSmartAddress = smartAccountAddress.startsWith('0x');
  const mintRecipient = hasSmartAddress ? smartAccountAddress : ownerAddress;
  const mintCommand =
    usdxAddress && mintRecipient
      ? `cast send ${usdxAddress} "mint(address,uint256)" ${mintRecipient} 1000000000000000000000 --rpc-url https://sepolia.base.org --private-key <DEPLOYER_KEY>`
      : undefined;
  async function copyMintCommand() {
    if (!mintCommand) return;
    try {
      await navigator.clipboard.writeText(mintCommand);
      setMintCopied(true);
      setTimeout(() => setMintCopied(false), 1500);
    } catch (error) {
      console.error('Failed to copy mint command', error);
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border/60 bg-surface px-4 py-3">
        <p className="text-xs uppercase tracking-widest text-slate-400">Smart account address</p>
        <div className="mt-2 flex items-center justify-between gap-2">
          <p className="font-mono text-sm text-white break-all">{smartAccountAddress}</p>
          <button
            type="button"
            className="flex items-center gap-1 rounded-xl border border-border/60 px-3 py-1 text-xs text-slate-200 hover:border-primary/60 hover:text-primary"
            onClick={() => copyValue(smartAccountAddress, 'smart')}
          >
            {copiedField === 'smart' ? (
              <>
                <CheckIcon className="h-4 w-4" /> Copied
              </>
            ) : (
              <>
                <ClipboardDocumentIcon className="h-4 w-4" /> Copy
              </>
            )}
          </button>
        </div>
      </div>
     {ownerAddress ? (
       <div className="rounded-2xl border border-border/60 bg-surface px-4 py-3">
         <p className="text-xs uppercase tracking-widest text-slate-400">Owner EOA</p>
         <div className="mt-2 flex items-center justify-between gap-2">
           <p className="font-mono text-sm text-white break-all">{ownerAddress}</p>
            <button
              type="button"
              className="flex items-center gap-1 rounded-xl border border-border/60 px-3 py-1 text-xs text-slate-200 hover:border-primary/60 hover:text-primary"
              onClick={() => copyValue(ownerAddress, 'owner')}
            >
              {copiedField === 'owner' ? (
                <>
                  <CheckIcon className="h-4 w-4" /> Copied
                </>
              ) : (
                <>
                  <ClipboardDocumentIcon className="h-4 w-4" /> Copy
                </>
              )}
            </button>
          </div>
        </div>
      ) : null}
      <p className="text-sm text-slate-400">
        {locked
          ? 'Unlock your wallet to display QR codes and receive helpers.'
          : deployed
          ? 'Top up any supported token on any chain—we’ll route it automatically and sponsor gas on the destination chain.'
          : 'Fund the predicted smart-account address above; your first sponsored action will deploy the account automatically.'}
      </p>
      <button
        type="button"
        onClick={copyMintCommand}
        disabled={!mintCommand}
        className={clsx(
          'w-full rounded-2xl border px-4 py-3 text-sm font-semibold transition',
          mintCommand
            ? 'border-primary/40 bg-primary/10 text-primary hover:bg-primary/20'
            : 'cursor-not-allowed border-border/60 bg-surface text-slate-500',
        )}
        title={
          mintCommand
            ? 'Copies a Foundry command to mint 1,000 USDX to your smart account'
            : 'Set USDX address to enable mint command copy'
        }
      >
        {mintCommand ? (mintCopied ? 'Mint command copied!' : 'Copy 1,000 USDX mint command') : 'Mint helper unavailable'}
      </button>
    </div>
  );
}

function SwapForm({ disabled }: { disabled: boolean }) {
  const { swap, smartAccount, getTokenBalance, pythPrice } = useWallet();
  const [isSubmitting, setSubmitting] = useState(false);
  const [mode, setMode] = useState<'same' | 'cross'>('same');
  const [sourceChain, setSourceChain] = useState('base-sepolia');
  const [destinationChain, setDestinationChain] = useState('optimism-sepolia');
  const [tokenIn, setTokenIn] = useState('USDCx');
  const [tokenOut, setTokenOut] = useState('USDX');
  const [tokenInBalance, setTokenInBalance] = useState('—');
  const [tokenOutBalance, setTokenOutBalance] = useState('—');
  const [ownerTokenInBalance, setOwnerTokenInBalance] = useState('—');
  const [ownerTokenOutBalance, setOwnerTokenOutBalance] = useState('—');

  useEffect(() => {
    if (mode === 'same') {
      setDestinationChain(sourceChain);
    } else if (mode === 'cross' && destinationChain === sourceChain) {
      setDestinationChain(sourceChain === 'base-sepolia' ? 'optimism-sepolia' : 'base-sepolia');
    }
  }, [mode, sourceChain, destinationChain]);

  useEffect(() => {
    let cancelled = false;

    async function refreshBalances() {
      const smartAddress = (smartAccount.address ?? smartAccount.predictedAddress) as string | undefined;
      const ownerAddress = smartAccount.owner as string | undefined;
      if (disabled || !smartAddress) {
        setTokenInBalance('—');
        setTokenOutBalance('—');
        setOwnerTokenInBalance(ownerAddress ? '…' : '—');
        setOwnerTokenOutBalance(ownerAddress ? '…' : '—');
        return;
      }

      setTokenInBalance('…');
      setTokenOutBalance('…');
      if (ownerAddress) {
        setOwnerTokenInBalance('…');
        setOwnerTokenOutBalance('…');
      }

      const [inBal, outBal] = await Promise.all([
        getTokenBalance(sourceChain, tokenIn),
        getTokenBalance(mode === 'same' ? sourceChain : destinationChain, tokenOut),
      ]);

      const [ownerIn, ownerOut] = ownerAddress
        ? await Promise.all([
            getTokenBalance(sourceChain, tokenIn, ownerAddress as `0x${string}`),
            getTokenBalance(
              mode === 'same' ? sourceChain : destinationChain,
              tokenOut,
              ownerAddress as `0x${string}`,
            ),
          ])
        : ['—', '—'];

      if (!cancelled) {
        setTokenInBalance(inBal);
        setTokenOutBalance(outBal);
        setOwnerTokenInBalance(ownerIn);
        setOwnerTokenOutBalance(ownerOut);
      }
    }

    void refreshBalances();

    return () => {
      cancelled = true;
    };
  }, [
    disabled,
    getTokenBalance,
    smartAccount.address,
    smartAccount.predictedAddress,
    smartAccount.owner,
    sourceChain,
    destinationChain,
    tokenIn,
    tokenOut,
    mode,
  ]);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (disabled) return;
    const form = new FormData(event.currentTarget);
    const amount = String(form.get('amount') ?? '0');
    const params = {
      amount,
      token: tokenIn,
      tokenOut,
      sourceChain,
      destinationChain: mode === 'same' ? sourceChain : destinationChain,
      recipient: smartAccount.address ?? smartAccount.predictedAddress ?? smartAccount.owner ?? '',
      routeOverride: undefined,
    };

    if (!params.recipient) {
      throw new Error('Deploy or unlock your smart account before swapping');
    }

    setSubmitting(true);
    try {
      await swap(params);
    } catch (error) {
      console.error('Swap failed', error);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" aria-disabled={disabled}>
      <div className="flex flex-wrap gap-2">
        {(
          [
            { value: 'same', label: 'Same chain' },
            { value: 'cross', label: 'Cross chain' },
          ] as const
        ).map((option) => (
          <button
            key={option.value}
            type="button"
            disabled={disabled}
            onClick={() => setMode(option.value)}
            className={clsx(
              'rounded-2xl border px-3 py-2 text-sm transition',
              mode === option.value
                ? 'border-primary bg-primary/15 text-primary'
                : 'border-border/60 bg-surfaceAlt/60 text-slate-300 hover:border-primary/40 hover:text-white',
              disabled && 'opacity-60',
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
      {pythPrice ? (
        <p className="text-xs text-slate-400">
          USDX price (Pyth): ${pythPrice.price.toFixed(4)} (confidence ±{pythPrice.confidence.toExponential(2)})
        </p>
      ) : null}
      <FormSection>
        <Label title="From chain" />
        <Select
          name="sourceChain"
          value={sourceChain}
          onChange={(event) => setSourceChain(String(event.target.value))}
          disabled={disabled}
        >
          <option value="base-sepolia">Base Sepolia</option>
        </Select>
        {mode === 'cross' ? (
          <>
            <Label title="To chain" />
            <Select
              name="destinationChain"
              value={destinationChain}
              onChange={(event) => setDestinationChain(String(event.target.value))}
              disabled={disabled}
            >
              <option value="optimism-sepolia">Optimism Sepolia</option>
              <option value="arbitrum-sepolia">Arbitrum Sepolia</option>
              <option value="base-sepolia">Base Sepolia</option>
            </Select>
          </>
        ) : null}
        <Label title="Token In" description={`Balance: ${tokenInBalance}`} />
        <Select
          name="tokenIn"
          value={tokenIn}
          onChange={(event) => setTokenIn(String(event.target.value))}
          disabled={disabled}
        >
          <option value="USDCx">USDCx</option>
          <option value="WETH">WETH</option>
          <option value="USDX">USDX</option>
          <option value="PLAY">PLAY</option>
        </Select>
        <Label title="Token Out" description={`Balance: ${tokenOutBalance}`} />
        <Select
          name="tokenOut"
          value={tokenOut}
          onChange={(event) => setTokenOut(String(event.target.value))}
          disabled={disabled}
        >
          <option value="USDX">USDX</option>
          <option value="USDCx">USDCx</option>
          <option value="WETH">WETH</option>
          <option value="PLAY">PLAY</option>
        </Select>
        <Label title="Amount" />
        <Input name="amount" placeholder="250" required disabled={disabled} />
      </FormSection>
      <PrimaryButton type="submit" disabled={disabled || isSubmitting}>
        {disabled ? 'Unlock wallet first' : isSubmitting ? 'Submitting swap…' : 'Start swap'}
      </PrimaryButton>
      <p className="text-xs text-slate-400">
        Swapping {tokenIn} → {tokenOut} on {mode === 'same' ? sourceChain : `${sourceChain} → ${destinationChain}`}.
        Output lands in your AutoBridge smart account. Use the Bridge tab for delivery to another chain.
      </p>
      {smartAccount.owner ? (
        <p className="text-xs text-slate-500">
          Owner EOA balances — {tokenIn}: {ownerTokenInBalance}, {tokenOut}:{' '}
          {ownerTokenOutBalance}. Move assets to the smart account before swapping to let the paymaster sponsor gas.
        </p>
      ) : null}
    </form>
  );
}

function BridgePlanner({ disabled }: { disabled: boolean }) {
  const { estimateRoute } = useWallet();
  const [routeId, setRouteId] = useState<string | null>(null);
  const [isEstimating, setEstimating] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (disabled) return;
    const form = new FormData(event.currentTarget);
    const params = {
      amount: String(form.get('amount') ?? '0'),
      token: String(form.get('token') ?? 'USDCx'),
      sourceChain: String(form.get('sourceChain') ?? 'base-sepolia'),
      destinationChain: String(form.get('destinationChain') ?? 'arbitrum-sepolia'),
      recipient: String(form.get('recipient') ?? ''),
    };

    setEstimating(true);
    try {
      const result = await estimateRoute(params);
      setRouteId(result.plan.id ?? 'mock');
    } catch (error) {
      console.error('Failed to estimate route', error);
    } finally {
      setEstimating(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" aria-disabled={disabled}>
      <FormSection>
        <Label title="From chain" />
        <Select name="sourceChain" defaultValue="base-sepolia" disabled={disabled}>
          <option value="base-sepolia">Base Sepolia</option>
          <option value="optimism-sepolia">Optimism Sepolia</option>
          <option value="arbitrum-sepolia">Arbitrum Sepolia</option>
        </Select>
        <Label title="To chain" />
        <Select name="destinationChain" defaultValue="arbitrum-sepolia" disabled={disabled}>
          <option value="arbitrum-sepolia">Arbitrum Sepolia</option>
          <option value="optimism-sepolia">Optimism Sepolia</option>
        </Select>
        <Label title="Token" />
        <Select name="token" defaultValue="USDCx" disabled={disabled}>
          <option value="USDCx">USDCx</option>
          <option value="USDX">USDX</option>
        </Select>
        <Label title="Recipient" />
        <Input name="recipient" placeholder="0xdestination" required disabled={disabled} />
        <Label title="Amount" />
        <Input name="amount" placeholder="500" required disabled={disabled} />
      </FormSection>
      <PrimaryButton type="submit" disabled={disabled || isEstimating}>
        {disabled ? 'Unlock wallet first' : isEstimating ? 'Estimating…' : 'Estimate gasless route'}
      </PrimaryButton>
      {routeId ? (
        <div className="rounded-2xl border border-success/40 bg-success/10 px-4 py-3 text-sm text-success">
          Route prepared: {routeId}
        </div>
      ) : null}
    </form>
  );
}
