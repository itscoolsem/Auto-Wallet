'use client';

import { TokenHoldings } from '../../components/wallet/TokenHoldings';
import { WalletOnboardingCard } from '../../components/wallet/WalletOnboardingCard';
import { ActionPanel } from '../../components/actions/ActionPanel';
import { FundingPanel } from '../../components/wallet/FundingPanel';
import { useWallet } from '../../components/providers/WalletProvider';
import { type Address } from 'viem';

export default function Home() {
  const { smartAccount, getOwnerPrivateKey, getWalletSalt } = useWallet();

  console.log('🏠 Home: Component rendered, calling getOwnerPrivateKey...');
  const privateKey = getOwnerPrivateKey();
  console.log('🏠 Home: privateKey result:', privateKey ? privateKey.slice(0, 10) + '...' : 'undefined');

  console.log('🏠 Home: Calling getWalletSalt...');
  const walletSalt = getWalletSalt();
  console.log('🏠 Home: walletSalt result:', walletSalt ? walletSalt.slice(0, 10) + '...' : 'undefined');

  console.log('🏠 Home page render summary:', {
    smartAccount,
    privateKey: privateKey ? privateKey.slice(0, 10) + '...' : 'undefined',
    walletSalt: walletSalt ? walletSalt.slice(0, 10) + '...' : 'undefined'
  });

  return (
    <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
      <div className="space-y-6">
        <WalletOnboardingCard />
        <ActionPanel />
        <TokenHoldings />
      </div>
      <div className="space-y-6">
        <FundingPanel
          ownerAddress={smartAccount.owner as Address | undefined}
          smartAccountAddress={(smartAccount.address ?? smartAccount.predictedAddress) as Address | undefined}
          ownerPrivateKey={privateKey}
          walletSalt={walletSalt}
        />
      </div>
    </div>
  );
}
