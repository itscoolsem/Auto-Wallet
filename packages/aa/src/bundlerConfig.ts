import { getChain } from '@autobridge/chains';
import { requireEnvAlias } from '@autobridge/common';

export interface BundlerConfig {
  chainSlug: string;
  bundlerUrl: string;
  paymasterAddress: string;
  entryPoint: string;
  walletExecutorAddress: string;
}

export function resolveBundlerConfig(chainSlug: string, env = process.env): BundlerConfig {
  const chain = getChain(chainSlug as never);
  const bundlerVar = chain.erc4337.bundlerEnv;
  const paymasterVar = chain.erc4337.paymasterEnv;
  const executorVar = chain.erc4337.walletExecutorEnv;

  const bundlerUrl = requireEnvAlias(bundlerVar, env, [`NEXT_PUBLIC_${bundlerVar}`]);
  const paymasterAddress = requireEnvAlias(paymasterVar, env, [`NEXT_PUBLIC_${paymasterVar}`]);
  const walletExecutorAddress = requireEnvAlias(executorVar, env, [`NEXT_PUBLIC_${executorVar}`]);

  return {
    chainSlug,
    bundlerUrl,
    paymasterAddress,
    entryPoint: chain.erc4337.entryPoint,
    walletExecutorAddress,
  };
}
