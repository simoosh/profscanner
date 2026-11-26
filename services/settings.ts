/**
 * User settings stored on the device (localStorage).
 *
 * "Bring your own key": the user picks a model from any provider and enters the key
 * for that provider. Keys never leave the device except in requests sent to the
 * provider itself (or through the user's own CORS relay).
 */
import type { CustomModel } from './ai/types';

const KEYS_STORAGE = 'profscanner.providerKeys';
const SELECTED_MODEL_STORAGE = 'profscanner.selectedModel';
const CUSTOM_MODELS_STORAGE = 'profscanner.customModels';
const PROXY_URL_STORAGE = 'profscanner.proxyUrl';
const SAVE_HISTORY_STORAGE = 'saveHistory';
const TIMEOUT_STORAGE = 'profscanner.timeoutMinutes';
export const DEFAULT_TIMEOUT_MINUTES = 15;
export const TIMEOUT_CHOICES = [5, 10, 15, 30, 60];

// Legacy (Gemini-only version)
const LEGACY_API_KEY = 'profscanner.geminiApiKey';
const LEGACY_MODEL = 'profscanner.geminiModel';

const read = (key: string): string | null => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};

const write = (key: string, value: string | null) => {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // storage unavailable (private mode…): settings simply won't persist
  }
};

const readJson = <T>(key: string, fallback: T): T => {
  try {
    const raw = read(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
};

/**
 * API keys are printable ASCII. Copy-paste can bring spaces, line breaks, "Bearer "
 * prefixes or invisible characters (zero-width spaces) that make the provider refuse it.
 */
export const cleanKey = (key: string): string =>
  key.replace(/^\s*Bearer\s+/i, '').replace(/[^\x21-\x7E]/g, '');

/** Moves the key of the Gemini-only version into the new per-provider storage. */
const migrateLegacySettings = () => {
  const legacyKey = read(LEGACY_API_KEY);
  if (!legacyKey) return;
  const keys = readJson<Record<string, string>>(KEYS_STORAGE, {});
  if (!keys.gemini) keys.gemini = legacyKey;
  write(KEYS_STORAGE, JSON.stringify(keys));
  if (!read(SELECTED_MODEL_STORAGE)) {
    write(SELECTED_MODEL_STORAGE, `gemini/${read(LEGACY_MODEL) || 'gemini-3.1-pro-preview'}`);
  }
  write(LEGACY_API_KEY, null);
  write(LEGACY_MODEL, null);
};
migrateLegacySettings();

export const Settings = {
  // ── Provider keys ──
  getProviderKeys: (): Record<string, string> => readJson(KEYS_STORAGE, {}),
  getProviderKey: (providerId: string): string => Settings.getProviderKeys()[providerId] || '',
  setProviderKey: (providerId: string, key: string) => {
    const keys = Settings.getProviderKeys();
    key = cleanKey(key);
    if (key) keys[providerId] = key;
    else delete keys[providerId];
    write(KEYS_STORAGE, JSON.stringify(keys));
  },

  // ── Selected model ──
  getSelectedModelKey: (): string | null => read(SELECTED_MODEL_STORAGE),
  setSelectedModelKey: (key: string) => write(SELECTED_MODEL_STORAGE, key),

  // ── Custom models ──
  getCustomModels: (): CustomModel[] => readJson(CUSTOM_MODELS_STORAGE, []),
  saveCustomModel: (model: CustomModel) => {
    const models = Settings.getCustomModels().filter((m) => m.key !== model.key);
    models.push({ ...model, apiKey: cleanKey(model.apiKey) });
    write(CUSTOM_MODELS_STORAGE, JSON.stringify(models));
  },
  deleteCustomModel: (key: string) => {
    write(CUSTOM_MODELS_STORAGE, JSON.stringify(Settings.getCustomModels().filter((m) => m.key !== key)));
  },

  // ── CORS relay ──
  /** User-defined relay URL, or the one baked into the build (VITE_PROXY_URL). */
  getProxyUrl: (): string =>
    (read(PROXY_URL_STORAGE) ?? (import.meta.env.VITE_PROXY_URL as string | undefined) ?? '').replace(/\/+$/, ''),
  setProxyUrl: (url: string) => write(PROXY_URL_STORAGE, url.trim() ? url.trim() : null),

  // ── Request timeout ──
  /** Maximum duration of one transcription, in minutes (free tiers can queue for minutes). */
  getTimeoutMinutes: (): number => {
    const value = parseInt(read(TIMEOUT_STORAGE) || '', 10);
    return Number.isFinite(value) && value > 0 ? value : DEFAULT_TIMEOUT_MINUTES;
  },
  setTimeoutMinutes: (minutes: number) => write(TIMEOUT_STORAGE, String(minutes)),

  // ── History ──
  getSaveHistory: (): boolean => read(SAVE_HISTORY_STORAGE) !== 'false',
  setSaveHistory: (value: boolean) => write(SAVE_HISTORY_STORAGE, String(value)),
};
