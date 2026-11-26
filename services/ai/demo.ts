import { Settings } from '../settings';

export interface DemoStatus {
  enabled: boolean;
  models?: string[];
  perIpPerDay?: number;
  /** Demo requests left today for this device/network. */
  remaining?: number;
}

let cache: { url: string; at: number; status: DemoStatus } | null = null;
const CACHE_MS = 60 * 1000;

/** Asks the relay whether the free demo is enabled and how many scans are left today. */
export const fetchDemoStatus = async (force = false): Promise<DemoStatus | null> => {
  const proxy = Settings.getProxyUrl();
  if (!proxy) return null;
  if (!force && cache && cache.url === proxy && Date.now() - cache.at < CACHE_MS) return cache.status;
  try {
    const response = await fetch(`${proxy}/demo/status`);
    if (!response.ok) return { enabled: false };
    const status = (await response.json()) as DemoStatus;
    cache = { url: proxy, at: Date.now(), status };
    return status;
  } catch {
    return null;
  }
};

export const invalidateDemoStatus = () => {
  cache = null;
};
