/**
 * Provider-agnostic AI model description.
 *
 * Two wire protocols cover virtually every provider:
 *  - "openai": OpenAI-compatible Chat Completions (OpenRouter, Mistral, Groq, NVIDIA NIM,
 *    Z.ai, SiliconFlow, Together, Cerebras, Gemini's OpenAI endpoint, Ollama, LM Studio…)
 *  - "anthropic": Anthropic Messages API
 */
export type Protocol = 'openai' | 'anthropic';

export interface ProviderDef {
  id: string;
  name: string;
  protocol: Protocol;
  baseUrl: string;
  /** The provider does not send CORS headers: browser calls must go through the relay. */
  needsProxy?: boolean;
  /** Free demo served by the relay with the maintainer's key: no user key, daily quota. */
  demo?: boolean;
  /** Where to get a key. */
  keyUrl?: string;
  /** Short note about the free tier, shown in the UI. */
  freeTier?: string;
  /** Extra headers required by the provider. */
  headers?: Record<string, string>;
}

export interface ModelEntry {
  /** Unique key in the app: "<providerId>/<model>" for built-ins, "custom:<uuid>" for custom ones. */
  key: string;
  providerId: string;
  /** Model identifier sent to the API. */
  model: string;
  label: string;
  free?: boolean;
  /** Short hint shown under the name (quality, limits…). */
  note?: string;
  maxTokens?: number;
  custom?: boolean;
  /**
   * Extra fields merged into the request body, e.g. to turn off "thinking" on reasoning
   * models that otherwise spend minutes (and their whole token budget) reasoning.
   * Dropped automatically if the server rejects them.
   */
  extraBody?: Record<string, unknown>;
}

/** User-defined model with its own endpoint and key. */
export interface CustomModel {
  key: string;
  label: string;
  protocol: Protocol;
  baseUrl: string;
  model: string;
  apiKey: string;
  viaProxy: boolean;
}

export type HealthState = 'ok' | 'slow' | 'down' | 'unknown';

export interface ModelHealth {
  state: HealthState;
  /** Latency of the last successful call, in ms. */
  latencyMs?: number;
  /** Why the model is down, in French, shown to the user. */
  reason?: string;
  checkedAt: number;
  /** "probe" = test request, "scan" = real transcription. */
  source: 'probe' | 'scan';
}

/** Everything needed to call a model. */
export interface ResolvedModel {
  entry: ModelEntry;
  provider: ProviderDef;
  apiKey: string;
  useProxy: boolean;
}

export interface ImagePart {
  data: string; // base64, no data: prefix
  mimeType: string;
}
