import { Sidebar } from '../../components/layout/Sidebar';
import { TopBar } from '../../components/layout/TopBar';
import { WalletProvider } from '../../components/providers/WalletProvider';

export default function ShellLayout({ children }: { children: React.ReactNode }) {
  return (
    <WalletProvider>
      <div className="relative flex min-h-screen">
        <div className="fixed inset-y-0 left-0 hidden lg:block">
          <Sidebar />
        </div>
        <div className="flex w-full flex-col lg:pl-60">
          <TopBar />
          <main className="relative flex-1 overflow-y-auto bg-surface px-6 pb-16 pt-6">
            <div className="absolute inset-0 -z-10 bg-grid-overlay opacity-60" aria-hidden />
            <div className="mx-auto max-w-6xl space-y-8">{children}</div>
          </main>
        </div>
      </div>
    </WalletProvider>
  );
}
