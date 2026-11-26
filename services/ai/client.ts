/**
 * Minimal multi-provider client (no SDK): OpenAI-compatible Chat Completions and
 * Anthropic Messages, called with fetch from the browser.
 */
import { Settings } from '../settings';
import type { ImagePart, ResolvedModel } from './types';

export class AIError extends Error {
  status?: number;
  /** Raw response body, kept to decide on retries. */
  raw?: string;
  constructor(message: string, status?: number, raw?: string) {
    super(message);
    this.name = 'AIError';
    this.status = status;
    this.raw = raw;
  }
}

const DEFAULT_MAX_TOKENS = 16384;

/** Full URL, routed through the CORS relay when the provider requires it. */
const buildUrl = (resolved: ResolvedModel, path: string): string => {
  const proxy = Settings.getProxyUrl();
  if (resolved.provider.demo) {
    if (!proxy) throw new AIError('Démo indisponible : aucun relais configuré.');
    return `${proxy}/demo${path}`;
  }
  const target = `${resolved.provider.baseUrl}${path}`;
  if (!resolved.useProxy) return target;
  if (!proxy) throw new AIError('Ce fournisseur nécessite un relais CORS (voir Modèle IA → Relais).');
  return `${proxy}/${target.replace(/^https?:\/\//, '')}`;
};

/** The provider's own error message, whatever its JSON shape. */
const providerMessage = (body: string): string => {
  try {
    const j = JSON.parse(body);
    const message =
      j?.error?.message || (typeof j?.error === 'string' ? j.error : '') || j?.message || j?.detail || j?.title || j?.error_msg;
    return typeof message === 'string' ? message.trim().slice(0, 200) : '';
  } catch {
    return body.trim().slice(0, 200);
  }
};

/** Maps HTTP / network errors to short French messages, keeping the provider's wording as detail. */
const describeError = (status: number | undefined, body: string): string => {
  const text = body.slice(0, 300);
  // Errors from the relay's demo mode carry a ready-to-display French message.
  try {
    const parsed = JSON.parse(body);
    if (typeof parsed?.error?.code === 'string' && parsed.error.code.startsWith('DEMO_')) return parsed.error.message;
  } catch {
    // not JSON
  }
  // Errors produced by the CORS relay itself, not by the provider.
  if (/^Host not allowed/.test(text)) {
    return "Le relais n'autorise pas ce fournisseur : ajoutez son domaine à ALLOWED_HOSTS du relais, ou décochez « Passer par le relais » si le fournisseur accepte les navigateurs.";
  }
  if (/^Origin not allowed/.test(text)) {
    return "Le relais refuse cette application (origine non autorisée dans ALLOWED_ORIGINS).";
  }
  const detail = providerMessage(body);
  // The key was accepted, but the model itself is switched off (retired or free access ended).
  if (/model.{0,20}(disabled|deprecated|retired|offline|unavailable)|not.{0,10}(enabled|activated)/i.test(text)) {
    return `Ce modèle est désactivé chez le fournisseur (retiré ou accès gratuit terminé) : « ${detail} ». Votre clé fonctionne : choisissez un autre modèle.`;
  }
  if (/unauthori[sz]ed.?client/i.test(text)) {
    return `Ce fournisseur refuse les appels venant d'une application web (seuls certains logiciels sont autorisés). Message : « ${detail} »`;
  }
  // Gemini answers 400 (not 401) to a bad key: "Please pass a valid API key".
  if (
    status === 401 ||
    status === 403 ||
    /invalid.*(api[_ -]?key|token)|unauthori[sz]ed|API key not valid|valid API key|API key.*(missing|invalid|expired)/i.test(text)
  ) {
    return `Clé API refusée par le fournisseur${detail ? ` : « ${detail} »` : ''}. Vérifiez qu'elle vient bien du même site que l'URL appelée.`;
  }
  if (status === 400) {
    return `Requête refusée par le fournisseur (400)${detail ? ` : « ${detail} »` : ''}. Causes fréquentes : le modèle n'accepte pas les images, ou un paramètre n'est pas supporté.`;
  }
  if (status === 410 || /"title"\s*:\s*"Gone"/.test(text)) {
    return 'Ce modèle a été retiré par le fournisseur.';
  }
  if (status === 404 || /model.*(not found|does not exist|not supported)|no endpoints found/i.test(text)) {
    return "Ce modèle n'existe pas ou n'est pas disponible pour votre clé.";
  }
  if (/"code"\s*:\s*"?1113|insufficient.?balance|余额不足|recharge|resource package|payment required/i.test(text) || status === 402) {
    return 'Solde insuffisant : ce fournisseur exige un crédit (ou une carte) même pour ce modèle.';
  }
  if (status === 429 && /upstream|temporarily rate.?limited/i.test(text)) {
    return 'Modèle gratuit saturé chez le fournisseur (partagé entre tous ses utilisateurs). Réessayez plus tard ou prenez un autre modèle.';
  }
  if (status === 429 || /rate.?limit|quota|RESOURCE_EXHAUSTED|too many requests/i.test(text)) {
    return 'Quota atteint pour ce modèle. Réessayez plus tard ou choisissez-en un autre.';
  }
  if (status === 413 || /too large|payload/i.test(text)) {
    return 'Images trop lourdes pour ce fournisseur. Essayez avec moins de pages.';
  }
  if (/image|vision|multimodal/i.test(text) && /support/i.test(text)) {
    return "Ce modèle n'accepte pas les images.";
  }
  if (status && status >= 500) return 'Le fournisseur rencontre une erreur. Réessayez dans un instant.';
  return text || `Erreur ${status ?? 'réseau'}.`;
};

const timeoutMessage = () =>
  `Délai dépassé (${Settings.getTimeoutMinutes()} min) : le modèle met trop de temps à répondre. ` +
  'Augmentez le délai dans Préférences ou choisissez un modèle plus rapide.';

/** fetch() with the user-configured overall timeout; maps network failures to French. */
const timedFetch = async (url: string, init: RequestInit, signal?: AbortSignal) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Settings.getTimeoutMinutes() * 60 * 1000);
  signal?.addEventListener('abort', () => controller.abort());
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    return { response, controller, clear: () => clearTimeout(timeout) };
  } catch (error: any) {
    clearTimeout(timeout);
    if (error?.name === 'AbortError') throw new AIError(timeoutMessage());
    // fetch() rejects without details on CORS refusals and network failures.
    throw new AIError("Impossible de joindre le fournisseur (réseau, ou appel bloqué par le navigateur : un relais CORS est peut-être nécessaire).");
  }
};

/**
 * Streams an OpenAI-compatible response (server-sent events) and returns the full text.
 * Streaming keeps the connection alive during long generations and lets the UI show progress.
 */
const fetchStream = async (
  url: string,
  init: RequestInit,
  onProgress: (progress: GenerateProgress) => void,
  signal?: AbortSignal
): Promise<string> => {
  const { response, clear } = await timedFetch(url, init, signal);
  try {
    if (!response.ok) {
      const body = await response.text();
      throw new AIError(describeError(response.status, body), response.status, body);
    }
    // Some servers ignore stream:true and answer with plain JSON.
    if (!(response.headers.get('content-type') || '').includes('text/event-stream') || !response.body) {
      return extractOpenAIText(JSON.parse(await response.text()));
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let text = '';
    let reasoningChars = 0;
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) {
        const data = line.replace(/^data:\s?/, '').trim();
        if (!line.startsWith('data:') || !data || data === '[DONE]') continue;
        try {
          const json = JSON.parse(data);
          if (json.error) throw new AIError(describeError(undefined, JSON.stringify(json)), undefined, data);
          const delta = json.choices?.[0]?.delta || {};
          if (typeof delta.content === 'string') text += delta.content;
          // Reasoning models stream their "thinking" separately (NVIDIA: reasoning_content,
          // OpenRouter: reasoning). It is not part of the answer, but shows the model is working.
          const thinking = delta.reasoning_content ?? delta.reasoning;
          if (typeof thinking === 'string') reasoningChars += thinking.length;
        } catch (error) {
          if (error instanceof AIError) throw error;
          // ignore keep-alive comments and partial lines
        }
      }
      onProgress(text ? { phase: 'writing', chars: text.length } : { phase: 'thinking', chars: reasoningChars });
    }
    if (!text) throw new AIError(reasoningChars ? REASONING_ONLY_MESSAGE : 'Réponse vide du modèle.');
    return text;
  } catch (error: any) {
    if (error?.name === 'AbortError') throw new AIError(timeoutMessage());
    throw error;
  } finally {
    clear();
  }
};

const fetchJson = async (url: string, init: RequestInit, signal?: AbortSignal): Promise<any> => {
  const { response, clear } = await timedFetch(url, init, signal);
  let body: string;
  try {
    body = await response.text();
  } catch (error: any) {
    if (error?.name === 'AbortError') throw new AIError(timeoutMessage());
    throw error;
  } finally {
    clear();
  }
  if (!response.ok) throw new AIError(describeError(response.status, body), response.status, body);
  try {
    return JSON.parse(body);
  } catch {
    throw new AIError('Réponse illisible du fournisseur.');
  }
};

/** Removes visible reasoning that some "thinking" models put in the content. */
const stripReasoning = (text: string) => text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

const REASONING_ONLY_MESSAGE =
  'Le modèle a passé tout son temps à « réfléchir » sans écrire le document. ' +
  'Réessayez, ou choisissez un modèle sans raisonnement (ex. Gemini Flash-Lite).';

const extractOpenAIText = (json: any): string => {
  const message = json?.choices?.[0]?.message;
  const content = message?.content;
  if (typeof content === 'string' && content.trim()) return content;
  if (Array.isArray(content) && content.length) return content.map((part: any) => part?.text || '').join('');
  if (message?.reasoning_content || message?.reasoning) throw new AIError(REASONING_ONLY_MESSAGE);
  throw new AIError('Réponse vide du modèle.');
};

interface GenerateParams {
  system: string;
  prompt: string;
  images?: ImagePart[];
  maxTokens?: number;
  signal?: AbortSignal;
  /** When set, the response is streamed and this is called as text arrives. */
  onProgress?: (progress: GenerateProgress) => void;
}

/** "thinking": a reasoning model is reasoning (not yet writing); "writing": answer text is arriving. */
export interface GenerateProgress {
  phase: 'thinking' | 'writing';
  chars: number;
}

interface CallOptions {
  mergeSystem: boolean;
  sendMaxTokens: boolean;
  stream: boolean;
  /** Send the model's extraBody (e.g. reasoning switched off). */
  extra: boolean;
}

const callOpenAI = async (resolved: ResolvedModel, params: GenerateParams, opts: CallOptions) => {
  const userContent = [
    ...(params.images || []).map((img) => ({
      type: 'image_url',
      image_url: { url: `data:${img.mimeType};base64,${img.data}` },
    })),
    { type: 'text', text: opts.mergeSystem ? `${params.system}\n\n${params.prompt}` : params.prompt },
  ];
  const messages = opts.mergeSystem
    ? [{ role: 'user', content: userContent }]
    : [
        { role: 'system', content: params.system },
        { role: 'user', content: userContent },
      ];

  const body: Record<string, unknown> = {
    ...(opts.extra ? resolved.entry.extraBody : undefined),
    model: resolved.entry.model,
    messages,
    temperature: 0.2,
  };
  if (opts.sendMaxTokens) body.max_tokens = params.maxTokens ?? resolved.entry.maxTokens ?? DEFAULT_MAX_TOKENS;
  if (opts.stream) body.stream = true;

  const init: RequestInit = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(resolved.apiKey ? { Authorization: `Bearer ${resolved.apiKey}` } : {}),
      ...resolved.provider.headers,
    },
    body: JSON.stringify(body),
  };
  const url = buildUrl(resolved, '/chat/completions');

  if (opts.stream && params.onProgress) return fetchStream(url, init, params.onProgress, params.signal);
  return extractOpenAIText(await fetchJson(url, init, params.signal));
};

const callAnthropic = async (resolved: ResolvedModel, params: GenerateParams) => {
  const content = [
    ...(params.images || []).map((img) => ({
      type: 'image',
      source: { type: 'base64', media_type: img.mimeType, data: img.data },
    })),
    { type: 'text', text: params.prompt },
  ];
  const json = await fetchJson(
    buildUrl(resolved, '/messages'),
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': resolved.apiKey,
        'anthropic-version': '2023-06-01',
        ...resolved.provider.headers,
      },
      body: JSON.stringify({
        model: resolved.entry.model,
        system: params.system,
        max_tokens: params.maxTokens ?? resolved.entry.maxTokens ?? DEFAULT_MAX_TOKENS,
        messages: [{ role: 'user', content }],
      }),
    },
    params.signal
  );
  const text = (json?.content || []).filter((b: any) => b.type === 'text').map((b: any) => b.text).join('');
  if (!text) throw new AIError('Réponse vide du modèle.');
  return text;
};

/**
 * Sends a prompt (+ images) and returns the text answer.
 * Retries once without the features some OpenAI-compatible servers reject
 * (system role on Gemma-like models, max_tokens above the model's limit, streaming).
 */
export const generate = async (resolved: ResolvedModel, params: GenerateParams): Promise<string> => {
  if (resolved.provider.protocol === 'anthropic') return stripReasoning(await callAnthropic(resolved, params));

  const stream = !!params.onProgress;
  try {
    return stripReasoning(await callOpenAI(resolved, params, { mergeSystem: false, sendMaxTokens: true, stream, extra: true }));
  } catch (error: any) {
    const message = String(error?.raw || error?.message || '');
    if (error instanceof AIError && error.status === 400) {
      const hasExtra = !!resolved.entry.extraBody;
      const retry: CallOptions = {
        mergeSystem: /system/i.test(message),
        sendMaxTokens: !/max_tokens|max_completion_tokens|maximum.*tokens/i.test(message),
        stream: stream && !/stream/i.test(message),
        // A 400 from a provider often gives no reason ("Invalid request"): when the model
        // has provider-specific fields, drop them first, as they are the usual culprit.
        extra: !hasExtra,
      };
      if (retry.mergeSystem || !retry.sendMaxTokens || retry.stream !== stream || retry.extra !== true) {
        return stripReasoning(await callOpenAI(resolved, params, retry));
      }
    }
    throw error;
  }
};
