import clsx from 'clsx';

import '../globals.css';
import { WalletProvider } from '../../components/providers/WalletProvider';

export const metadata = {
  title: 'AutoBridge Wallet Popup',
  description: 'Quick swap & pay popup',
};

export default function PopupLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body
        className={clsx(
          'bg-surface text-white min-h-screen flex items-center justify-center p-4',
          'w-[375px] h-[600px] mx-auto'
        )}
      >
        <WalletProvider>
          <div className="w-full h-full overflow-hidden rounded-3xl border border-border/60 bg-surfaceAlt shadow-2xl">
            {children}
          </div>
        </WalletProvider>
      </body>
    </html>
  );
}
