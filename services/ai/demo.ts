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
    const status: DemoStatus = response.ok ? ((await response.json()) as DemoStatus) : { enabled: false };
    cache = { url: proxy, at: Date.now(), status };
    return status;
  } catch {
    return null;
  }
};

/** Last status received from the relay (null until the first answer): lets synchronous code decide. */
export const getCachedDemoStatus = (): DemoStatus | null => {
  const proxy = Settings.getProxyUrl();
  return cache && cache.url === proxy ? cache.status : null;
};

export const invalidateDemoStatus = () => {
  cache = null;
};
