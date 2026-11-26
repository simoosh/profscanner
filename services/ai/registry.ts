import { Settings } from '../settings';
import { getCachedDemoStatus } from './demo';
import {
  BUILTIN_MODELS,
  DEFAULT_MODEL_KEY,
  DEFAULT_MODEL_KEY_WITH_PROXY,
  PROVIDERS,
  getProvider,
} from './catalog';
import type { CustomModel, ModelEntry, ProviderDef, ResolvedModel } from './types';

/** Custom models are exposed as a model + a private provider definition. */
const customProvider = (custom: CustomModel): ProviderDef => ({
  id: custom.key,
  name: 'Modèle perso',
  protocol: custom.protocol,
  baseUrl: custom.baseUrl.replace(/\/+$/, ''),
  needsProxy: custom.viaProxy,
  headers: custom.protocol === 'anthropic' ? { 'anthropic-dangerous-direct-browser-access': 'true' } : undefined,
});

const customEntry = (custom: CustomModel): ModelEntry => ({
  key: custom.key,
  providerId: custom.key,
  model: custom.model,
  label: custom.label || custom.model,
  custom: true,
});

export const listModels = (): ModelEntry[] => [
  ...BUILTIN_MODELS,
  ...Settings.getCustomModels().map(customEntry),
];

export const findProvider = (providerId: string): ProviderDef | undefined => {
  const builtin = getProvider(providerId);
  if (builtin) return builtin;
  const custom = Settings.getCustomModels().find((m) => m.key === providerId);
  return custom ? customProvider(custom) : undefined;
};

export const getApiKeyFor = (entry: ModelEntry): string => {
  if (entry.custom) return Settings.getCustomModels().find((m) => m.key === entry.key)?.apiKey || '';
  return Settings.getProviderKey(entry.providerId);
};

/**
 * Why a model cannot be used right now (missing key, relay required…), or null.
 * Local servers (Ollama, LM Studio) may not need a key.
 */
export const unavailabilityReason = (entry: ModelEntry): string | null => {
  const provider = findProvider(entry.providerId);
  if (!provider) return 'Fournisseur inconnu.';
  if (provider.demo) {
    if (!Settings.getProxyUrl()) return 'Démo indisponible : aucun relais configuré.';
    const demo = getCachedDemoStatus();
    if (demo && !demo.enabled) return 'Démo non activée sur ce relais.';
    if (demo && demo.remaining === 0) return 'Quota démo du jour épuisé. Ajoutez votre propre clé pour continuer.';
    return null; // status not known yet: assume available, the relay answers clearly if not
  }
  if (provider.needsProxy && !Settings.getProxyUrl()) {
    return 'Ce fournisseur bloque les appels depuis un navigateur : configurez un relais CORS.';
  }
  const isLocal = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?/.test(provider.baseUrl);
  if (!getApiKeyFor(entry) && !isLocal) return 'Clé API manquante.';
  return null;
};

export const resolveModel = (entry: ModelEntry): ResolvedModel => {
  const provider = findProvider(entry.providerId);
  if (!provider) throw new Error('Fournisseur inconnu.');
  return {
    entry,
    provider,
    apiKey: getApiKeyFor(entry),
    useProxy: !!provider.needsProxy,
  };
};

/** Selected model, falling back to a sensible default. */
export const getSelectedModel = (): ModelEntry => {
  const models = listModels();
  const selected = models.find((m) => m.key === Settings.getSelectedModelKey());
  if (selected) return selected;
  // The free demo is the default only when the relay is configured AND reports it enabled.
  const demoAvailable = !!Settings.getProxyUrl() && getCachedDemoStatus()?.enabled === true;
  const fallbackKey = demoAvailable ? DEFAULT_MODEL_KEY_WITH_PROXY : DEFAULT_MODEL_KEY;
  return models.find((m) => m.key === fallbackKey) || models[0];
};

/** True when the selected model can be called (key present, relay available if needed). */
export const isSelectedModelUsable = (): boolean => unavailabilityReason(getSelectedModel()) === null;

export { PROVIDERS };
