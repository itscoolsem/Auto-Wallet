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

export async function reverseResolveEns(address: string): Promise<string | null> {
  if (!address || !address.match(/^0x[a-fA-F0-9]{40}$/)) return null;
  try {
    const ensName = await getEnsClient().getEnsName({
      address: address as `0x${string}`
    });
    return ensName ?? null;
  } catch (error) {
    console.error('ENS reverse resolution failed', { address, error });
    return null;
  }
}
