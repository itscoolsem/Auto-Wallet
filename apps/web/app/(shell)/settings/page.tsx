import Link from 'next/link';

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-border/70 bg-surfaceAlt/70 p-6">
        <h2 className="text-xl font-semibold text-white">Developer Settings</h2>
        <p className="mt-2 text-sm text-slate-400">
          Inject bundler / paymaster / LayerZero credentials via environment variables. Refer to{' '}
          <a
            href="https://github.com/your-org/autobridge-wallet/blob/main/docs/BUILD_PLAN.md"
            className="underline"
            target="_blank"
            rel="noreferrer"
          >
            docs/BUILD_PLAN.md
          </a>{' '}
          for required keys.
        </p>
        <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-slate-300">
          <li>BASE_BUNDLER_URL, OPTIMISM_BUNDLER_URL, ARBITRUM_BUNDLER_URL</li>
          <li>PAYMASTER_ADDRESS, LZ_* endpoint IDs, PYTH_* price IDs</li>
          <li>Configure RPC URLs in `.env` then restart the wallet app</li>
        </ul>
      </section>
      <section className="rounded-3xl border border-border/70 bg-surfaceAlt/70 p-6">
        <h2 className="text-xl font-semibold text-white">Export Wallet Data</h2>
        <p className="mt-2 text-sm text-slate-400">
          Full data export and recovery will arrive once the SDK send/balance flows are implemented.
        </p>
      </section>
    </div>
  );
}
