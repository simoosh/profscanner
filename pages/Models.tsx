import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Check, ChevronDown, ChevronUp, ExternalLink, KeyRound, Loader2, Plus, RefreshCw, Server, ShieldCheck, Trash2, X,
} from 'lucide-react';
import { Settings } from '../services/settings';
import { PROVIDERS } from '../services/ai/catalog';
import { getSelectedModel, listModels, unavailabilityReason } from '../services/ai/registry';
import { getHealth, isStale, probeModel, STATE_LABELS } from '../services/ai/health';
import { fetchDemoStatus, type DemoStatus } from '../services/ai/demo';
import type { CustomModel, HealthState, ModelEntry, ModelHealth, Protocol } from '../services/ai/types';

// ── Status dot ──────────────────────────────────────────────
const DOT_CLASSES: Record<HealthState, string> = {
  ok: 'bg-green-500',
  slow: 'bg-red-500',
  down: 'bg-gray-300 dark:bg-slate-600',
  unknown: 'border-2 border-gray-300 dark:border-slate-500 bg-transparent',
};

const StatusDot: React.FC<{ health: ModelHealth; testing?: boolean }> = ({ health, testing }) =>
  testing ? (
    <Loader2 size={12} className="animate-spin text-blue-500 flex-shrink-0" />
  ) : (
    <span
      className={`w-3 h-3 rounded-full flex-shrink-0 ${DOT_CLASSES[health.state]}`}
      title={STATE_LABELS[health.state]}
      aria-label={STATE_LABELS[health.state]}
    />
  );

const formatLatency = (ms?: number) => (ms === undefined ? '' : ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} s`);

// ── Custom model form ───────────────────────────────────────
const emptyCustom = (): CustomModel => ({
  key: `custom:${typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : Date.now()}`,
  label: '',
  protocol: 'openai',
  baseUrl: '',
  model: '',
  apiKey: '',
  viaProxy: false,
});

const inputClass =
  'w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-slate-600 bg-gray-50 dark:bg-slate-900 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';

const CustomModelSheet: React.FC<{ onClose: () => void; onSave: (m: CustomModel) => void }> = ({ onClose, onSave }) => {
  const [form, setForm] = useState<CustomModel>(emptyCustom);
  const set = (patch: Partial<CustomModel>) => setForm((f) => ({ ...f, ...patch }));
  const valid = /^https?:\/\/.+/.test(form.baseUrl.trim()) && form.model.trim().length > 0;

  return (
    // z-[70]: above the bottom navigation bar (z-50)
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-white dark:bg-slate-800 w-full max-w-lg rounded-t-2xl sm:rounded-2xl p-5 space-y-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">Modèle perso</h2>
          <button onClick={onClose} aria-label="Fermer" className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700">
            <X size={20} />
          </button>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          N'importe quelle API compatible OpenAI (OpenRouter, Groq, Together, Ollama, LM Studio, vLLM…) ou Anthropic.
          Le modèle doit accepter les images.
        </p>

        <label className="block text-sm">
          <span className="text-gray-600 dark:text-gray-300 font-medium">Nom affiché</span>
          <input className={`${inputClass} mt-1`} value={form.label} onChange={(e) => set({ label: e.target.value })} placeholder="Mon modèle" />
        </label>

        <div className="text-sm">
          <span className="text-gray-600 dark:text-gray-300 font-medium">Protocole</span>
          <div className="mt-1 grid grid-cols-2 gap-2">
            {(['openai', 'anthropic'] as Protocol[]).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => set({ protocol: p })}
                className={`py-2 rounded-xl border text-sm font-medium ${
                  form.protocol === p
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                    : 'border-gray-200 dark:border-slate-600 text-gray-600 dark:text-gray-300'
                }`}
              >
                {p === 'openai' ? 'Compatible OpenAI' : 'Anthropic'}
              </button>
            ))}
          </div>
        </div>

        <label className="block text-sm">
          <span className="text-gray-600 dark:text-gray-300 font-medium">URL de base</span>
          <input
            className={`${inputClass} mt-1 font-mono`}
            value={form.baseUrl}
            onChange={(e) => set({ baseUrl: e.target.value })}
            placeholder={form.protocol === 'openai' ? 'https://api.exemple.com/v1' : 'https://api.anthropic.com/v1'}
            spellCheck={false}
          />
          <span className="text-xs text-gray-400">
            {form.protocol === 'openai' ? '…/chat/completions sera ajouté automatiquement.' : '…/messages sera ajouté automatiquement.'}
          </span>
        </label>

        <label className="block text-sm">
          <span className="text-gray-600 dark:text-gray-300 font-medium">Identifiant du modèle</span>
          <input className={`${inputClass} mt-1 font-mono`} value={form.model} onChange={(e) => set({ model: e.target.value })} placeholder="qwen/qwen3-vl-235b" spellCheck={false} />
        </label>

        <label className="block text-sm">
          <span className="text-gray-600 dark:text-gray-300 font-medium">Clé API</span>
          <input
            className={`${inputClass} mt-1 font-mono`}
            type="password"
            autoComplete="off"
            value={form.apiKey}
            onChange={(e) => set({ apiKey: e.target.value })}
            placeholder="Facultatif pour un serveur local"
          />
        </label>

        <label className="flex items-start gap-3 text-sm cursor-pointer">
          <input type="checkbox" className="mt-1" checked={form.viaProxy} onChange={(e) => set({ viaProxy: e.target.checked })} />
          <span className="text-gray-600 dark:text-gray-300">
            Passer par le relais CORS
            <span className="block text-xs text-gray-400">À cocher si le fournisseur bloque les appels depuis un navigateur.</span>
          </span>
        </label>

        <button
          disabled={!valid}
          onClick={() => onSave({ ...form, baseUrl: form.baseUrl.trim(), model: form.model.trim(), label: form.label.trim() })}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold py-3 rounded-xl"
        >
          Ajouter et sélectionner
        </button>
      </div>
    </div>
  );
};

// ── Page ────────────────────────────────────────────────────
const Models: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const returnTo: string | undefined = location.state?.returnTo;

  const [version, setVersion] = useState(0); // bump to re-read settings / health
  const refresh = () => setVersion((v) => v + 1);

  const models = useMemo(() => listModels(), [version]); // eslint-disable-line react-hooks/exhaustive-deps
  const selected = useMemo(() => getSelectedModel(), [version]); // eslint-disable-line react-hooks/exhaustive-deps
  const [testing, setTesting] = useState<Set<string>>(new Set());
  const [openProvider, setOpenProvider] = useState<string | null>(null);
  const [keyDrafts, setKeyDrafts] = useState<Record<string, string>>(() => Settings.getProviderKeys());
  const [showCustom, setShowCustom] = useState(false);
  const [showRelay, setShowRelay] = useState(false);
  const [proxyDraft, setProxyDraft] = useState(() => Settings.getProxyUrl());
  const [demoStatus, setDemoStatus] = useState<DemoStatus | null | undefined>(undefined);

  useEffect(() => {
    fetchDemoStatus(true).then(setDemoStatus);
  }, [version]);

  const demoLine = (fallback?: string) => {
    if (!Settings.getProxyUrl()) return 'Nécessite un relais configuré (voir plus bas).';
    if (demoStatus === undefined) return 'Vérification…';
    if (demoStatus === null) return 'Relais injoignable.';
    if (!demoStatus.enabled) return 'Démo non activée sur ce relais.';
    const n = demoStatus.remaining ?? 0;
    return n > 0 ? `Il vous reste ${n} scan${n > 1 ? 's' : ''} gratuit${n > 1 ? 's' : ''} aujourd'hui.` : fallback || 'Quota démo du jour épuisé.';
  };

  const runProbe = useCallback(async (entry: ModelEntry) => {
    setTesting((s) => new Set(s).add(entry.key));
    await probeModel(entry);
    setTesting((s) => {
      const next = new Set(s);
      next.delete(entry.key);
      return next;
    });
    refresh();
  }, []);

  // Test the selected model when the page opens and its status is stale (one request at most).
  useEffect(() => {
    const health = getHealth(selected);
    if (health.state !== 'down' && isStale(health)) runProbe(selected);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const selectModel = (entry: ModelEntry) => {
    Settings.setSelectedModelKey(entry.key);
    refresh();
  };

  const saveKey = (providerId: string) => {
    Settings.setProviderKey(providerId, keyDrafts[providerId] || '');
    refresh();
    const first = models.find((m) => m.providerId === providerId && m.key === selected.key) || models.find((m) => m.providerId === providerId);
    if (first && (keyDrafts[providerId] || '').trim()) runProbe(first);
  };

  const testConfigured = () => {
    models.filter((m) => !unavailabilityReason(m)).forEach((m) => runProbe(m));
  };

  const saveCustom = (custom: CustomModel) => {
    Settings.saveCustomModel(custom);
    Settings.setSelectedModelKey(custom.key);
    setShowCustom(false);
    refresh();
    const entry = listModels().find((m) => m.key === custom.key);
    if (entry) runProbe(entry);
  };

  const deleteCustom = (key: string) => {
    Settings.deleteCustomModel(key);
    refresh();
  };

  const saveProxy = () => {
    Settings.setProxyUrl(proxyDraft);
    refresh();
  };

  const groups = [
    ...PROVIDERS.map((p) => ({ provider: p, models: models.filter((m) => m.providerId === p.id) })),
  ].filter((g) => g.models.length);
  const customModels = models.filter((m) => m.custom);

  const ModelRow: React.FC<{ entry: ModelEntry }> = ({ entry }) => {
    const health = getHealth(entry);
    const isSelected = entry.key === selected.key;
    const isTesting = testing.has(entry.key);
    return (
      <div
        className={`flex items-center gap-3 px-4 py-3 border-t border-gray-50 dark:border-slate-700 ${
          health.state === 'down' ? 'opacity-60' : ''
        } ${isSelected ? 'bg-blue-50/60 dark:bg-blue-900/20' : ''}`}
      >
        <button onClick={() => selectModel(entry)} className="flex-1 min-w-0 flex items-center gap-3 text-left">
          <StatusDot health={health} testing={isTesting} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium text-gray-900 dark:text-white truncate">{entry.label}</span>
              {entry.free && (
                <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300">GRATUIT</span>
              )}
            </div>
            <p
              className={`text-xs text-gray-400 dark:text-gray-500 ${health.reason && health.state !== 'ok' ? 'line-clamp-3 break-words' : 'truncate'}`}
              title={health.reason}
            >
              {(health.state === 'down' || health.state === 'slow') && health.reason
                ? health.reason
                : [STATE_LABELS[health.state], formatLatency(health.latencyMs), entry.note].filter(Boolean).join(' · ')}
            </p>
          </div>
          {isSelected && <Check size={18} className="text-blue-600 flex-shrink-0" />}
        </button>
        {entry.custom && (
          <button onClick={() => deleteCustom(entry.key)} aria-label="Supprimer ce modèle" className="p-1.5 text-gray-400 hover:text-red-500">
            <Trash2 size={16} />
          </button>
        )}
        <button
          onClick={() => runProbe(entry)}
          disabled={isTesting || !!unavailabilityReason(entry)}
          aria-label="Tester ce modèle"
          className="p-1.5 text-gray-400 hover:text-blue-600 disabled:opacity-30"
        >
          <RefreshCw size={16} />
        </button>
      </div>
    );
  };

  return (
    <div className="min-h-dvh bg-gray-50 dark:bg-slate-900 transition-colors duration-300 pb-24">
      {showCustom && <CustomModelSheet onClose={() => setShowCustom(false)} onSave={saveCustom} />}

      {/* Header */}
      <div className="bg-white dark:bg-slate-800 p-4 shadow-sm flex items-center gap-3 sticky top-0 z-10 border-b dark:border-slate-700">
        <button onClick={() => (returnTo ? navigate(returnTo, { replace: true }) : navigate(-1))} className="p-2 -ml-2 rounded-full hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-600 dark:text-gray-200">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
        </button>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white flex-1">Modèle IA</h1>
        <button onClick={testConfigured} className="text-sm font-medium text-blue-600 dark:text-blue-400 flex items-center gap-1">
          <RefreshCw size={14} /> Tout tester
        </button>
      </div>

      <div className="p-4 space-y-4 max-w-2xl mx-auto">
        {/* Légende */}
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500 dark:text-gray-400 px-1">
          {(['ok', 'slow', 'down', 'unknown'] as HealthState[]).map((s) => (
            <span key={s} className="flex items-center gap-1.5">
              <span className={`w-2.5 h-2.5 rounded-full ${DOT_CLASSES[s]}`} /> {STATE_LABELS[s]}
            </span>
          ))}
        </div>

        {returnTo && unavailabilityReason(selected) && (
          <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300 text-sm">
            Choisissez un modèle et ajoutez la clé de son fournisseur pour lancer le scan.
          </div>
        )}

        {/* Fournisseurs */}
        {groups.map(({ provider, models: providerModels }) => {
          const hasKey = !!Settings.getProviderKey(provider.id);
          const open = openProvider === provider.id;
          return (
            <section key={provider.id} className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 overflow-hidden">
              <button onClick={() => setOpenProvider(open ? null : provider.id)} className="w-full px-4 py-3 flex items-center gap-3 text-left">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h2 className="font-bold text-gray-900 dark:text-white">{provider.name}</h2>
                    {provider.needsProxy && (
                      <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300">RELAIS</span>
                    )}
                  </div>
                  <p className={`text-xs truncate ${provider.demo ? 'text-blue-600 dark:text-blue-400 font-medium' : 'text-gray-400 dark:text-gray-500'}`}>
                    {provider.demo ? demoLine() : provider.freeTier}
                  </p>
                </div>
                {provider.demo ? (
                  <span className="text-xs font-medium text-blue-600 dark:text-blue-400">Sans clé</span>
                ) : (
                  <span className={`text-xs font-medium flex items-center gap-1 ${hasKey ? 'text-green-600' : 'text-gray-400'}`}>
                    <KeyRound size={14} /> {hasKey ? 'Clé ✓' : 'Clé'}
                  </span>
                )}
                {open ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
              </button>

              {open && provider.demo && (
                <p className="px-4 pb-4 text-xs text-gray-500 dark:text-gray-400">
                  {provider.freeTier} Les scans passent par le relais, avec la clé du mainteneur, dans la limite d'un quota
                  journalier par appareil. Pour un usage régulier, ajoutez votre propre clé gratuite (NVIDIA, OpenRouter…).
                </p>
              )}

              {open && !provider.demo && (
                <div className="px-4 pb-4 space-y-2">
                  <div className="flex gap-2">
                    <input
                      type="password"
                      autoComplete="off"
                      spellCheck={false}
                      value={keyDrafts[provider.id] || ''}
                      onChange={(e) => setKeyDrafts((d) => ({ ...d, [provider.id]: e.target.value }))}
                      placeholder={`Clé ${provider.name}`}
                      className={`${inputClass} font-mono flex-1 min-w-0`}
                    />
                    <button onClick={() => saveKey(provider.id)} className="px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold">
                      OK
                    </button>
                  </div>
                  {provider.keyUrl && (
                    <a href={provider.keyUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline">
                      Obtenir une clé {provider.name} <ExternalLink size={12} />
                    </a>
                  )}
                  {provider.needsProxy && (
                    <p className="text-xs text-purple-700 dark:text-purple-300">
                      {provider.name} bloque les appels directs depuis un navigateur (CORS) : il faut un relais, voir plus bas.
                    </p>
                  )}
                </div>
              )}

              {providerModels.map((m) => (
                <ModelRow key={m.key} entry={m} />
              ))}
            </section>
          );
        })}

        {/* Modèles perso */}
        {customModels.length > 0 && (
          <section className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 overflow-hidden">
            <h2 className="px-4 py-3 font-bold text-gray-900 dark:text-white">Mes modèles</h2>
            {customModels.map((m) => (
              <ModelRow key={m.key} entry={m} />
            ))}
          </section>
        )}

        {/* Relais CORS */}
        <section className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 overflow-hidden">
          <button onClick={() => setShowRelay(!showRelay)} className="w-full px-4 py-3 flex items-center gap-3 text-left">
            <Server size={18} className="text-purple-500" />
            <div className="flex-1">
              <h2 className="font-bold text-gray-900 dark:text-white">Relais CORS</h2>
              <p className="text-xs text-gray-400 dark:text-gray-500">{Settings.getProxyUrl() ? Settings.getProxyUrl() : 'Non configuré : démo, NVIDIA et Z.ai indisponibles'}</p>
            </div>
            {showRelay ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
          </button>
          {showRelay && (
            <div className="px-4 pb-4 space-y-2">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Certains fournisseurs refusent les appels venant d'un navigateur. Le relais est un petit Cloudflare Worker gratuit
                (dossier <code>proxy/</code> du projet) qui transmet la requête sans rien stocker. Votre clé passe par lui.
              </p>
              <div className="flex gap-2">
                <input
                  value={proxyDraft}
                  onChange={(e) => setProxyDraft(e.target.value)}
                  placeholder="https://profscanner-relay.<compte>.workers.dev"
                  spellCheck={false}
                  className={`${inputClass} font-mono flex-1 min-w-0`}
                />
                <button onClick={saveProxy} className="px-4 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-sm font-bold">
                  OK
                </button>
              </div>
            </div>
          )}
        </section>

        {/* Bouton modèle perso */}
        <button
          onClick={() => setShowCustom(true)}
          className="w-full py-3.5 rounded-2xl border-2 border-dashed border-gray-300 dark:border-slate-600 text-gray-600 dark:text-gray-300 font-semibold flex items-center justify-center gap-2 hover:border-blue-400 hover:text-blue-600"
        >
          <Plus size={18} /> Modèle perso
        </button>

        <div className="flex items-start gap-3 px-2 text-xs text-gray-500 dark:text-gray-400">
          <ShieldCheck size={16} className="flex-shrink-0 text-green-500 mt-0.5" />
          <p>
            Les clés sont enregistrées uniquement dans ce navigateur et envoyées seulement au fournisseur concerné
            (ou à votre relais). Le bouton ⟳ envoie une petite requête de test qui compte dans votre quota.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Models;
