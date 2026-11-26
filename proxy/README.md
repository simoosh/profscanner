# Relay (optional): CORS + free demo

`worker.js` is a small [Cloudflare Worker](https://developers.cloudflare.com/workers/) with two jobs:

1. **CORS relay.** Some AI providers do not send [CORS](https://developer.mozilla.org/docs/Web/HTTP/CORS) headers, so browsers refuse to call them directly, whatever the key. The relay forwards requests to an allow-list of provider hosts and adds CORS headers. It stores nothing; the user's own key passes through it.
2. **Free demo (optional).** Visitors can try ProfScanner without any key, on *your* key, within daily limits. The key is a Worker secret and never reaches the browser.

CORS support, checked in November 2026:

| Provider | Direct browser calls |
|----------|----------------------|
| OpenRouter, Google Gemini (OpenAI endpoint), Mistral, Groq, Cerebras, SiliconFlow, Together, Cohere | ✅ allowed |
| **NVIDIA NIM**, **Z.ai / BigModel (GLM)**, GitHub Models, SambaNova | ❌ blocked: need the relay |

Cloudflare's free plan covers it: 100,000 Worker requests per day, and Durable Objects (used for the demo counters).

## Deploy

1. Create a free [Cloudflare account](https://dash.cloudflare.com/sign-up).
2. In `wrangler.toml`, set the origin(s) where your app is hosted:

   ```toml
   ALLOWED_ORIGINS = "https://your-domain.example,http://localhost:5173"
   ```

3. From this folder:

   ```bash
   npx wrangler login
   ```

   ```bash
   npx wrangler deploy
   ```

4. Use the printed URL (`https://profscanner-relay.<account>.workers.dev`):
   - in the app: **Profile → AI model → CORS relay**, or
   - baked into the build: `VITE_PROXY_URL=https://profscanner-relay.<account>.workers.dev npm run build`. With a relay URL in the build, new visitors land directly on the free demo.

## Enable the free demo

```bash
npx wrangler secret put DEMO_API_KEY
```

Paste the key (an NVIDIA `nvapi-…` key by default). The demo then appears in the app as **Démo gratuite**, selected by default for visitors without a key.

Safeguards, all configurable in `wrangler.toml`:

| Variable | Default | Effect |
|----------|---------|--------|
| `DEMO_PER_IP_PER_DAY` | 10 | Scans per visitor (IP address) per day |
| `DEMO_GLOBAL_PER_DAY` | 300 | Scans per day for everyone together |
| `DEMO_MAX_PER_MINUTE` | 30 | Burst limit, kept under NVIDIA's ~40 requests/min |
| `DEMO_MODELS` | `z-ai/glm-5.3-flash` | Only these models can be called with the demo key |
| `DEMO_MAX_TOKENS` | 16384 | Output length cap |
| `DEMO_MAX_BODY_BYTES` | 8000000 | Request size cap (images included) |
| `DEMO_UPSTREAM_URL` | NVIDIA NIM | Any OpenAI-compatible `/chat/completions` URL |

- Demo mode stays **off** while `ALLOWED_ORIGINS` is `"*"`.
- Only the fields the app needs (model, messages, temperature, max_tokens) are forwarded with the demo key.
- IP addresses are never stored: counters use a SHA-256 hash salted with the date, and every counter is wiped when the day changes.
- Failed requests still count, so the demo cannot be drained by spamming bad calls.

### Know the limits before turning it on

- **Origin checks do not stop scripts.** `ALLOWED_ORIGINS` is enforced by browsers; a script can fake the `Origin` header. The per-IP and global caps are the real protection. Keep them low, and watch usage in the Cloudflare dashboard.
- **Provider terms.** NVIDIA's free API is governed by its *API Trial Terms of Service*, which allow testing and evaluation, not production use. A small, capped demo of an open-source project is your call to make; a busy public service on a trial key risks the key being revoked. The same caution applies to other free tiers.
- **Privacy.** Demo scans go through your relay to the upstream provider with your key: visitors should not send sensitive documents. The app says the demo is "for trying it out".
- **IP sharing.** A school network behind one IP shares one daily quota.

## Lock down the relay

Add hosts needed by custom models with `ALLOWED_HOSTS` (comma-separated). Never use a wildcard: that would turn the worker into an open proxy.

## Run locally

```bash
npx wrangler dev
```

The relay listens on `http://localhost:8787`. Secrets for local runs go in a `.dev.vars` file (git-ignored): `DEMO_API_KEY=…`.
