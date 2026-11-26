import type { ModelEntry, ProviderDef } from './types';

/**
 * Built-in providers and vision models.
 *
 * Only models that accept images are listed: ProfScanner sends photos.
 * Free tiers change often: the notes are indicative (checked November 2026).
 * Anything missing can be added from the UI with "Modèle perso".
 */
export const PROVIDERS: ProviderDef[] = [
  {
    id: 'demo',
    name: 'Démo gratuite',
    protocol: 'openai',
    baseUrl: '', // served by the relay at <relay>/demo
    needsProxy: true,
    demo: true,
    freeTier: 'Sans clé ni inscription · quelques scans par jour, offerts par le relais.',
  },
  {
    id: 'nvidia',
    name: 'NVIDIA NIM',
    protocol: 'openai',
    baseUrl: 'https://integrate.api.nvidia.com/v1',
    needsProxy: true,
    keyUrl: 'https://build.nvidia.com/settings/api-keys',
    freeTier: 'Gratuit, ~40 requêtes/min. Réservé aux tests (conditions NVIDIA).',
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    protocol: 'openai',
    baseUrl: 'https://openrouter.ai/api/v1',
    keyUrl: 'https://openrouter.ai/settings/keys',
    freeTier: 'Modèles « :free » : 20 req/min, 50 req/jour (1 000/jour après 10 $ de crédit).',
    headers: { 'X-Title': 'ProfScanner' },
  },
  {
    id: 'gemini',
    name: 'Google Gemini',
    protocol: 'openai',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    keyUrl: 'https://aistudio.google.com/app/apikey',
    freeTier: 'Gratuit sans carte : ~500 req/jour sur Flash-Lite, ~20/jour sur Flash.',
  },
  {
    id: 'mistral',
    name: 'Mistral',
    protocol: 'openai',
    baseUrl: 'https://api.mistral.ai/v1',
    keyUrl: 'https://console.mistral.ai/api-keys',
    freeTier: 'Offre « Experiment » gratuite (~1 req/s), données utilisables pour l’entraînement.',
  },
  {
    id: 'zai',
    name: 'Z.ai (GLM)',
    protocol: 'openai',
    baseUrl: 'https://api.z.ai/api/paas/v4',
    needsProxy: true,
    keyUrl: 'https://z.ai/manage-apikey/apikey-list',
    freeTier: 'GLM-4.6V Flash affiché gratuit, mais l’API peut exiger un solde (carte) pour l’utiliser.',
  },
  {
    id: 'siliconflow',
    name: 'SiliconFlow (international)',
    protocol: 'openai',
    baseUrl: 'https://api.siliconflow.com/v1',
    keyUrl: 'https://cloud.siliconflow.com/account/ak',
    freeTier: 'Clés créées sur siliconflow.com uniquement. Aucun modèle vision gratuit confirmé.',
  },
  {
    id: 'siliconflow-cn',
    name: 'SiliconFlow (Chine)',
    protocol: 'openai',
    baseUrl: 'https://api.siliconflow.cn/v1',
    keyUrl: 'https://cloud.siliconflow.cn/account/ak',
    freeTier: 'Clés créées sur siliconflow.cn uniquement. Aucun modèle vision gratuit confirmé.',
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    protocol: 'anthropic',
    baseUrl: 'https://api.anthropic.com/v1',
    keyUrl: 'https://console.anthropic.com/settings/keys',
    freeTier: 'Payant.',
    headers: { 'anthropic-dangerous-direct-browser-access': 'true' },
  },
];

const model = (providerId: string, id: string, label: string, extra: Partial<ModelEntry> = {}): ModelEntry => ({
  key: `${providerId}/${id}`,
  providerId,
  model: id,
  label,
  ...extra,
});

/**
 * Asks a reasoning model to answer directly instead of "thinking" for minutes (a free big
 * model can spend 15+ minutes reasoning). Several conventions exist and none is universal,
 * so the common ones are sent together; a server that rejects them gets the request again
 * without them (see client.ts), and one that ignores them simply keeps reasoning.
 */
const NO_THINKING = {
  reasoning_effort: "none",
  chat_template_kwargs: { enable_thinking: false, thinking: false },
};

export const BUILTIN_MODELS: ModelEntry[] = [
  model('demo', 'gemini-3.5-flash-lite', 'Gemini 3.5 Flash-Lite', { free: true, note: 'Pour essayer, bon en arabe. Ajoutez votre clé pour un usage régulier.' }),

  model('nvidia', 'z-ai/glm-5.3-flash', 'GLM-5.3 Flash', { free: true, note: 'Grand modèle multimodal (MoE 320B), 1M de contexte.', extraBody: NO_THINKING }),
  model('nvidia', 'nvidia/nemotron-3.5-super-vl-120b-a12b', 'Nemotron 3.5 Super VL', {
    free: true,
    note: 'Rapide sur l’offre gratuite. Raisonnement désactivé pour répondre directement.',
    // Reasoning model: without this it thinks for minutes and can return an empty answer.
    extraBody: { chat_template_kwargs: { enable_thinking: false } },
  }),
  model('nvidia', 'mistralai/mistral-large-4-1t-a52b', 'Mistral Large 4', { free: true, note: 'Raisonne toujours : niveau bas (low) pour limiter le temps.', extraBody: { reasoning_effort: 'low' } }),
  model('nvidia', 'moonshotai/kimi-k3.1-pro', 'Kimi K3.1 Pro', { free: true, note: 'Très grand modèle, 1M de contexte. Vision à confirmer.', extraBody: NO_THINKING }),

  model('openrouter', 'google/gemma-4-31b-it:free', 'Gemma 4 31B', { free: true, note: 'Quota partagé par tous les utilisateurs gratuits : souvent saturé.' }),
  model('openrouter', 'google/gemma-4-26b-a4b-it:free', 'Gemma 4 26B (MoE)', { free: true, note: 'Variante plus légère, parfois moins saturée.' }),
  model('openrouter', 'nvidia/nemotron-3.5-super-vl:free', 'Nemotron 3.5 Super VL', {
    free: true,
    note: 'Raisonnement désactivé pour répondre directement.',
    extraBody: { reasoning: { enabled: false } },
  }),

  model('gemini', 'gemini-3.5-flash-lite', 'Gemini 3.5 Flash-Lite', { free: true, note: 'Bon en arabe, ~500 requêtes/jour gratuites.' }),
  model('gemini', 'gemini-3.1-flash-lite', 'Gemini 3.1 Flash-Lite', { free: true, note: '~500 requêtes/jour gratuites.' }),
  model('gemini', 'gemini-3.8-flash', 'Gemini 3.8 Flash', { free: true, note: 'Quota gratuit très réduit (~20 requêtes/jour).' }),
  model('gemini', 'gemini-4-hydrogen', 'Gemini 4 Hydrogen', { note: 'Identifiant ajouté sur demande : quota gratuit non vérifié, peut exiger la facturation.' }),
  model('gemini', 'gemini-3.5-flash', 'Gemini 3.5 Flash', { free: true, note: 'Meilleur score gratuit en OCR arabe, mais ~20 requêtes/jour.' }),
  model('gemini', 'gemini-3.1-pro-preview', 'Gemini 3.1 Pro', { note: 'Meilleure qualité sur les maths manuscrites. Facturation souvent requise.' }),

  model('mistral', 'mistral-small-latest', 'Mistral Small', { free: true }),
  model('mistral', 'pixtral-large-latest', 'Pixtral Large', { free: true }),

  model('zai', 'glm-4.6v-flash', 'GLM-4.6V Flash', { free: true }),

  // GLM-4.1V-9B-Thinking now answers "Model disabled" (free access ended). No free vision model
  // could be confirmed on SiliconFlow: this one is probably paid, and its id is unverified.
  model('siliconflow', 'Qwen/Qwen3-VL-30B-A3B-Instruct', 'Qwen3-VL 30B', { note: 'Probablement payant (quelques centimes). Identifiant à confirmer avec ⟳.' }),
  model('siliconflow-cn', 'Qwen/Qwen3-VL-30B-A3B-Instruct', 'Qwen3-VL 30B', { note: 'Probablement payant. Identifiant à confirmer avec ⟳.' }),

  model('anthropic', 'claude-sonnet-5-5', 'Claude Sonnet 5.5'),
];

/** Default when a relay is configured (zero-config demo) and when it is not. */
export const DEFAULT_MODEL_KEY_WITH_PROXY = 'demo/gemini-3.5-flash-lite';
export const DEFAULT_MODEL_KEY = 'openrouter/google/gemma-4-31b-it:free';

export const getProvider = (id: string) => PROVIDERS.find((p) => p.id === id);
