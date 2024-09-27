'use client';

export interface PythPriceData {
  id: string;
  price: number;
  confidence: number;
  publishTime: number;
}

const DEFAULT_PYTH_ENDPOINT = process.env.NEXT_PUBLIC_PYTH_ENDPOINT ?? process.env.PYTH_ENDPOINT ?? 'https://hermes.pyth.network';

export async function fetchPythPrice(feedId: string): Promise<PythPriceData | null> {
  if (!feedId) return null;
  try {
    const url = `${DEFAULT_PYTH_ENDPOINT}/api/latest_price_feeds?ids[]=${feedId}`;
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'AutoBridge/1.0'
      },
      signal: AbortSignal.timeout(10000) // 10 second timeout
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const payload = await response.json();
    const entry = Array.isArray(payload) ? payload[0] : undefined;
    if (!entry?.price) return null;
    const rawPrice = Number(entry.price.price ?? entry.price.aggregatePrice ?? 0);
    const rawConfidence = Number(entry.price.confidenceInterval ?? entry.price.confidence ?? 0);
    const expo = Number(entry.price.expo ?? entry.price.exponent ?? 0);
    const scale = Number.isFinite(expo) ? Math.pow(10, expo) : 1;
    const price = Number.isFinite(rawPrice) ? rawPrice * scale : 0;
    const confidence = Number.isFinite(rawConfidence) ? rawConfidence * Math.abs(scale) : 0;
    return {
      id: feedId,
      price: Number.isFinite(price) ? price : 0,
      confidence: Number.isFinite(confidence) ? confidence : 0,
      publishTime: Number(entry.price.publishTime ?? entry.publishTime ?? Date.now() / 1000),
    };
  } catch (error) {
    console.error('Failed to fetch Pyth price', { feedId, error });
    return null;
  }
}
