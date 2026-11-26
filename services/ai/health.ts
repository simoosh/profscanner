/**
 * Model status shown in the selector: functional (green), slow (red), unavailable (grey).
 *
 * Status comes from two sources, so free quotas are not burnt on monitoring:
 *  - real transcriptions (passive): every scan records its outcome and duration;
 *  - test requests (active): a tiny request with a 16×16 image, only when the user asks
 *    or when the selector opens and the last result is stale.
 */
import { generate, AIError } from './client';
import { findProvider, resolveModel, unavailabilityReason } from './registry';
import { fetchDemoStatus } from './demo';
import type { HealthState, ModelEntry, ModelHealth } from './types';

const STORAGE = 'profscanner.modelHealth';
export const STALE_AFTER_MS = 30 * 60 * 1000;

const SLOW_PROBE_MS = 8000;
/** How long a test waits for the first output before reporting the model as slow. */
const PROBE_MAX_WAIT_MS = 90000;
const SLOW_SCAN_MS_PER_PAGE = 60000;

// 16×16 white PNG: checks that the model accepts images without spending tokens.
const TINY_PNG =
  'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAIAAACQkWg2AAAAFElEQVR4nGP4TyJgGNUwqmH4agAAr639H708R/EAAAAASUVORK5CYII=';

const readAll = (): Record<string, ModelHealth> => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE) || '{}');
  } catch {
    return {};
  }
};

const writeAll = (all: Record<string, ModelHealth>) => {
  try {
    localStorage.setItem(STORAGE, JSON.stringify(all));
  } catch {
    // ignore
  }
};

export const recordHealth = (key: string, health: ModelHealth) => {
  const all = readAll();
  all[key] = health;
  writeAll(all);
};

/**
 * Current status of a model. Configuration problems (missing key, relay required)
 * always win over recorded results.
 */
export const getHealth = (entry: ModelEntry): ModelHealth => {
  const reason = unavailabilityReason(entry);
  if (reason) return { state: 'down', reason, checkedAt: Date.now(), source: 'probe' };
  return readAll()[entry.key] || { state: 'unknown', checkedAt: 0, source: 'probe' };
};

export const isStale = (health: ModelHealth) => Date.now() - health.checkedAt > STALE_AFTER_MS;

/** Sends a tiny request (text + 16×16 image) and records the result. */
export const probeModel = async (entry: ModelEntry): Promise<ModelHealth> => {
  const reason = unavailabilityReason(entry);
  if (reason) return { state: 'down', reason, checkedAt: Date.now(), source: 'probe' };

  // Demo: ask the relay for its status instead of spending a demo request.
  if (findProvider(entry.providerId)?.demo) {
    const status = await fetchDemoStatus(true);
    const previous = readAll()[entry.key];
    const health: ModelHealth = !status
      ? { state: 'down', reason: 'Relais injoignable.', checkedAt: Date.now(), source: 'probe' }
      : !status.enabled || !status.models?.includes(entry.model)
        ? { state: 'down', reason: 'Démo non activée sur ce relais.', checkedAt: Date.now(), source: 'probe' }
        : status.remaining === 0
          ? { state: 'down', reason: 'Quota démo du jour épuisé. Ajoutez votre propre clé pour continuer.', checkedAt: Date.now(), source: 'probe' }
          : previous?.source === 'scan' && previous.state !== 'down'
            ? { ...previous, checkedAt: Date.now() }
            : { state: 'ok', checkedAt: Date.now(), source: 'probe' };
    recordHealth(entry.key, health);
    return health;
  }

  // The test measures the time to FIRST output (reasoning or answer), then stops the request:
  // a reasoning model can think for minutes, but one that starts streaming is working.
  // Stopping early also saves free quota.
  const controller = new AbortController();
  const started = performance.now();
  let firstTokenMs: number | null = null;
  const stop = (why: 'first' | 'timeout') => {
    if (why === 'first') firstTokenMs = performance.now() - started;
    controller.abort();
  };
  const waitTimer = setTimeout(() => stop('timeout'), PROBE_MAX_WAIT_MS);

  let health: ModelHealth;
  try {
    await generate(resolveModel(entry), {
      system: 'Tu réponds en un mot.',
      prompt: 'Réponds uniquement : OK',
      images: [{ data: TINY_PNG, mimeType: 'image/png' }],
      maxTokens: 64,
      signal: controller.signal,
      onProgress: ({ chars }) => {
        if (chars > 0 && firstTokenMs === null) stop('first');
      },
    });
    health = probeResult(performance.now() - started);
  } catch (error: any) {
    if (firstTokenMs !== null) {
      // We aborted on purpose after the first output: the model works.
      health = probeResult(firstTokenMs);
    } else if (error instanceof AIError && /réfléchir|vide/.test(error.message)) {
      // The model answered (reasoning only / empty): it is up.
      health = probeResult(performance.now() - started);
    } else if (performance.now() - started >= PROBE_MAX_WAIT_MS - 50) {
      health = {
        state: 'slow',
        reason: `Aucune réponse après ${PROBE_MAX_WAIT_MS / 1000} s (file d'attente ou modèle très lent). Un scan peut quand même aboutir : augmentez le délai dans Préférences.`,
        checkedAt: Date.now(),
        source: 'probe',
      };
    } else {
      health = { state: 'down', reason: error?.message || 'Erreur inconnue.', checkedAt: Date.now(), source: 'probe' };
    }
  } finally {
    clearTimeout(waitTimer);
  }
  recordHealth(entry.key, health);
  return health;
};

const probeResult = (latencyMs: number): ModelHealth => ({
  state: latencyMs > SLOW_PROBE_MS ? 'slow' : 'ok',
  latencyMs: Math.round(latencyMs),
  checkedAt: Date.now(),
  source: 'probe',
});

/** Records the outcome of a real transcription. */
export const recordScanOutcome = (
  entry: ModelEntry,
  outcome: { ok: true; durationMs: number; pages: number } | { ok: false; reason: string }
) => {
  if (outcome.ok) {
    const perPage = outcome.durationMs / Math.max(outcome.pages, 1);
    recordHealth(entry.key, {
      state: perPage > SLOW_SCAN_MS_PER_PAGE ? 'slow' : 'ok',
      latencyMs: Math.round(outcome.durationMs),
      checkedAt: Date.now(),
      source: 'scan',
    });
  } else {
    recordHealth(entry.key, { state: 'down', reason: outcome.reason, checkedAt: Date.now(), source: 'scan' });
  }
};

export const STATE_LABELS: Record<HealthState, string> = {
  ok: 'Fonctionnel',
  slow: 'Lent',
  down: 'Indisponible',
  unknown: 'Non testé',
};
