/**
 * ProfScanner relay — Cloudflare Worker.
 *
 * 1. CORS relay
 *    Some AI providers (NVIDIA NIM, Z.ai…) do not send CORS headers, so browsers refuse
 *    to call them directly. The worker forwards the request and adds CORS headers:
 *      https://<relay>/<provider-host>/<path>  →  https://<provider-host>/<path>
 *    It stores nothing and adds no credentials: the user's own key travels in the
 *    Authorization header, exactly as in a direct call.
 *
 * 2. Demo mode (optional)
 *    Lets visitors try the app without a key, on the maintainer's key (NVIDIA NIM by
 *    default, any OpenAI-compatible endpoint via DEMO_UPSTREAM_URL), within strict limits:
 *      POST https://<relay>/demo/chat/completions   (OpenAI-compatible, no Authorization)
 *      GET  https://<relay>/demo/status             (enabled? quota left?)
 *    The key is a Worker secret and never reaches the browser. Quotas are counted in a
 *    Durable Object (per hashed IP per day, global per day, global per minute).
 *    Demo mode is OFF unless DEMO_API_KEY is set AND ALLOWED_ORIGINS is not "*".
 *
 * Configuration (wrangler.toml [vars], secrets with `wrangler secret put`):
 *   ALLOWED_ORIGINS       comma-separated origins allowed to use the relay, or "*"
 *   ALLOWED_HOSTS         comma-separated upstream hosts for the CORS relay
 *   DEMO_API_KEY          (secret) API key used for demo requests
 *   DEMO_UPSTREAM_URL     chat completions endpoint (default: NVIDIA NIM)
 *   DEMO_MODELS           comma-separated model ids allowed in demo mode
 *   DEMO_PER_IP_PER_DAY   default 10
 *   DEMO_GLOBAL_PER_DAY   default 300
 *   DEMO_MAX_PER_MINUTE   default 30 (stay under NVIDIA's ~40 req/min)
 *   DEMO_MAX_TOKENS       default 16384
 *   DEMO_MAX_BODY_BYTES   default 8000000
 */

const DEFAULT_ALLOWED_HOSTS = [
  'integrate.api.nvidia.com',
  'api.z.ai',
  'open.bigmodel.cn',
  'models.github.ai',
  'api.sambanova.ai',
];

const DEFAULT_DEMO_UPSTREAM = 'https://integrate.api.nvidia.com/v1/chat/completions';
const DEFAULT_DEMO_MODELS = ['z-ai/glm-5.3-flash'];

// Only these request headers are forwarded upstream by the CORS relay.
const FORWARDED_HEADERS = ['authorization', 'content-type', 'accept', 'x-api-key', 'anthropic-version'];

const list = (value, fallback) =>
  value ? String(value).split(',').map((s) => s.trim()).filter(Boolean) : fallback;

const int = (value, fallback) => {
  const n = parseInt(value, 10);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
};

const corsHeaders = (allowOrigin) => ({
  'Access-Control-Allow-Origin': allowOrigin,
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type, Accept, X-Api-Key, Anthropic-Version',
  'Access-Control-Expose-Headers': 'X-Demo-Remaining',
  'Access-Control-Max-Age': '86400',
  Vary: 'Origin',
});

const text = (status, message, headers = {}) =>
  new Response(message, { status, headers: { 'Content-Type': 'text/plain; charset=utf-8', ...headers } });

/** OpenAI-style JSON error, with a stable `code` the app can recognise. */
const jsonError = (status, code, message, headers = {}) =>
  new Response(JSON.stringify({ error: { code, message } }), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...headers },
  });

const today = () => new Date().toISOString().slice(0, 10);

const sha256 = async (value) => {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 32);
};

const demoConfig = (env, allowedOrigins) => ({
  enabled: !!env.DEMO_API_KEY && !!env.DEMO_QUOTA && !allowedOrigins.includes('*'),
  models: list(env.DEMO_MODELS, DEFAULT_DEMO_MODELS),
  perIpPerDay: int(env.DEMO_PER_IP_PER_DAY, 10),
  globalPerDay: int(env.DEMO_GLOBAL_PER_DAY, 300),
  maxPerMinute: int(env.DEMO_MAX_PER_MINUTE, 30),
  maxTokens: int(env.DEMO_MAX_TOKENS, 16384),
  maxBodyBytes: int(env.DEMO_MAX_BODY_BYTES, 8000000),
});

/** Asks the quota Durable Object to check (and optionally consume) one demo request. */
const quotaCall = async (env, action, ipHash, config) => {
  const stub = env.DEMO_QUOTA.get(env.DEMO_QUOTA.idFromName('global'));
  const response = await stub.fetch('https://quota/' + action, {
    method: 'POST',
    body: JSON.stringify({
      ipHash,
      perIpPerDay: config.perIpPerDay,
      globalPerDay: config.globalPerDay,
      maxPerMinute: config.maxPerMinute,
    }),
  });
  return response.json();
};

const handleDemo = async (request, env, url, cors, allowedOrigins) => {
  const config = demoConfig(env, allowedOrigins);
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  // Hashed with the date: no raw IP is stored, and hashes change every day.
  const ipHash = await sha256(`${today()}|${ip}|${env.DEMO_API_KEY || ''}`);

  if (url.pathname === '/demo/status' && request.method === 'GET') {
    if (!config.enabled) return Response.json({ enabled: false }, { headers: cors });
    const quota = await quotaCall(env, 'peek', ipHash, config);
    return Response.json(
      { enabled: true, models: config.models, perIpPerDay: config.perIpPerDay, remaining: quota.remaining },
      { headers: cors }
    );
  }

  if (url.pathname !== '/demo/chat/completions' || request.method !== 'POST') {
    return text(404, 'Not found.', cors);
  }
  if (!config.enabled) return jsonError(503, 'DEMO_DISABLED', 'La démo gratuite est désactivée sur ce relais.', cors);

  const length = int(request.headers.get('Content-Length'), 0);
  if (length > config.maxBodyBytes) {
    return jsonError(413, 'DEMO_TOO_LARGE', 'Requête trop lourde pour la démo : envoyez moins de pages.', cors);
  }

  let payload;
  try {
    const raw = await request.text();
    if (raw.length > config.maxBodyBytes) {
      return jsonError(413, 'DEMO_TOO_LARGE', 'Requête trop lourde pour la démo : envoyez moins de pages.', cors);
    }
    payload = JSON.parse(raw);
  } catch {
    return jsonError(400, 'DEMO_BAD_REQUEST', 'Requête invalide.', cors);
  }
  if (!config.models.includes(payload.model)) {
    return jsonError(400, 'DEMO_MODEL_NOT_ALLOWED', 'Ce modèle n’est pas disponible en démo.', cors);
  }

  const quota = await quotaCall(env, 'consume', ipHash, config);
  if (!quota.allowed) {
    const messages = {
      ip: `Quota démo du jour atteint (${config.perIpPerDay} scans). Ajoutez votre propre clé gratuite pour continuer.`,
      global: 'La démo a atteint son quota du jour. Ajoutez votre propre clé gratuite pour continuer.',
      minute: 'La démo est très sollicitée : réessayez dans une minute.',
    };
    return jsonError(429, 'DEMO_QUOTA', messages[quota.reason] || messages.global, {
      ...cors,
      'Retry-After': quota.reason === 'minute' ? '60' : '3600',
      'X-Demo-Remaining': String(quota.remaining ?? 0),
    });
  }

  // Only the fields the app uses are forwarded; output length is capped.
  const body = {
    model: payload.model,
    messages: payload.messages,
    temperature: typeof payload.temperature === 'number' ? payload.temperature : 0.2,
    max_tokens: Math.min(int(payload.max_tokens, config.maxTokens), config.maxTokens),
    stream: payload.stream === true,
  };

  let upstream;
  try {
    upstream = await fetch(env.DEMO_UPSTREAM_URL || DEFAULT_DEMO_UPSTREAM, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.DEMO_API_KEY}`,
        'Content-Type': 'application/json',
        Accept: body.stream ? 'text/event-stream' : 'application/json',
      },
      body: JSON.stringify(body),
    });
  } catch (error) {
    return jsonError(502, 'DEMO_UPSTREAM', 'Le service de démo est injoignable.', cors);
  }

  const headers = new Headers(cors);
  headers.set('Content-Type', upstream.headers.get('content-type') || 'application/json');
  headers.set('X-Demo-Remaining', String(quota.remaining));
  return new Response(upstream.body, { status: upstream.status, headers });
};

const handleRelay = async (request, env, url, cors) => {
  const [host, ...pathParts] = url.pathname.replace(/^\/+/, '').split('/');
  if (!host) return text(200, 'ProfScanner relay. Usage: /<provider-host>/<path> or /demo/…', cors);

  const allowedHosts = list(env.ALLOWED_HOSTS, DEFAULT_ALLOWED_HOSTS);
  if (!allowedHosts.includes(host.toLowerCase())) return text(403, `Host not allowed: ${host}`, cors);

  const headers = new Headers();
  FORWARDED_HEADERS.forEach((name) => {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  });

  let upstream;
  try {
    upstream = await fetch(`https://${host}/${pathParts.join('/')}${url.search}`, {
      method: request.method,
      headers,
      body: request.method === 'POST' ? await request.arrayBuffer() : undefined,
    });
  } catch (error) {
    return text(502, `Upstream unreachable: ${error.message}`, cors);
  }

  const responseHeaders = new Headers();
  ['content-type', 'retry-after', 'x-ratelimit-remaining-requests', 'x-ratelimit-reset-requests'].forEach((name) => {
    const value = upstream.headers.get(name);
    if (value) responseHeaders.set(name, value);
  });
  Object.entries(cors).forEach(([name, value]) => responseHeaders.set(name, value));
  return new Response(upstream.body, { status: upstream.status, headers: responseHeaders });
};

export default {
  async fetch(request, env = {}) {
    const origin = request.headers.get('Origin') || '';
    const allowedOrigins = list(env.ALLOWED_ORIGINS, ['*']);
    const allowOrigin = allowedOrigins.includes('*') ? '*' : allowedOrigins.includes(origin) ? origin : '';

    if (!allowOrigin) return text(403, 'Origin not allowed.');
    const cors = corsHeaders(allowOrigin);

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (request.method !== 'POST' && request.method !== 'GET') return text(405, 'Method not allowed.', cors);

    const url = new URL(request.url);
    if (url.pathname === '/demo' || url.pathname.startsWith('/demo/')) {
      return handleDemo(request, env, url, cors, allowedOrigins);
    }
    return handleRelay(request, env, url, cors);
  },
};

/**
 * Demo quota counters. A single instance ("global") keeps today's counters; they are
 * wiped when the date changes, so storage never grows beyond one day of hashed IPs.
 */
export class DemoQuota {
  constructor(state) {
    this.storage = state.storage;
  }

  async fetch(request) {
    const action = new URL(request.url).pathname.slice(1);
    const { ipHash, perIpPerDay, globalPerDay, maxPerMinute } = await request.json();

    const day = today();
    if ((await this.storage.get('day')) !== day) {
      await this.storage.deleteAll();
      await this.storage.put('day', day);
    }

    const minute = Math.floor(Date.now() / 60000);
    const ipKey = `ip:${ipHash}`;
    const minuteKey = `min:${minute}`;
    const [ipCount = 0, globalCount = 0, minuteCount = 0] = await Promise.all([
      this.storage.get(ipKey),
      this.storage.get('global'),
      this.storage.get(minuteKey),
    ]);
    const remaining = Math.max(0, Math.min(perIpPerDay - ipCount, globalPerDay - globalCount));

    if (action === 'peek') return Response.json({ remaining });

    if (ipCount >= perIpPerDay) return Response.json({ allowed: false, reason: 'ip', remaining: 0 });
    if (globalCount >= globalPerDay) return Response.json({ allowed: false, reason: 'global', remaining: 0 });
    if (minuteCount >= maxPerMinute) return Response.json({ allowed: false, reason: 'minute', remaining });

    await this.storage.put({ [ipKey]: ipCount + 1, global: globalCount + 1, [minuteKey]: minuteCount + 1 });
    await this.storage.delete(`min:${minute - 1}`);
    return Response.json({ allowed: true, remaining: remaining - 1 });
  }
}
