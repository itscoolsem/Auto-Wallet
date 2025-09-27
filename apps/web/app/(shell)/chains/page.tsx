import { ChainHealth } from '../../../components/chains/ChainHealth';
import { ChainSwitcher } from '../../../components/chains/ChainSwitcher';

export default function ChainsPage() {
  return (
    <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
      <ChainHealth />
      <ChainSwitcher />
    </div>
  );
}
