'use client';

import { createPublicClient, http } from 'viem';
import { sepolia } from 'viem/chains';

const ENS_RPC =
  process.env.NEXT_PUBLIC_ENS_FALLBACK_RPC ??
  process.env.ENS_FALLBACK_RPC ??
  'https://rpc.ankr.com/eth_sepolia';

let ensClient;

function getEnsClient() {
  if (!ensClient) {
    ensClient = createPublicClient({
      chain: sepolia,
      transport: http(ENS_RPC),
    });
  }
  return ensClient;
}

export async function resolveEnsName(name: string): Promise<string | null> {
  if (!name || !name.endsWith('.eth')) return null;
  try {
    const address = await getEnsClient().getEnsAddress({ name });
    return address ?? null;
  } catch (error) {
    console.error('ENS resolution failed', { name, error });
    return null;
  }
}
