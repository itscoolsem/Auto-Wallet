import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import clsx from 'clsx';

import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: 'autowallet',
  description: 'Chain-abstracted, gas-sponsored smart account wallet',
};

interface RootLayoutProps {
  children: React.ReactNode;
}

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en" className="dark">
      <body className={clsx('bg-surface min-h-screen', inter.variable)}>
        {children}
      </body>
    </html>
  );
}
