# 🚀 Breezy Research — Deployment Architecture

Breezy should use a **single edge entry point** for normal traffic, with a Node fallback rather than splitting ordinary requests across providers.

```text
                         BREEZY / SYNTHEXIS
                                │
                     Cloudflare Pages / Assets
                         Static React frontend
                                │
                                ▼
                     Cloudflare Workers API
                 Auth • rate limits • routing • SSE
                                │
                    ┌───────────┴───────────┐
                    │                       │
              Provider APIs          Render Node API
             Gemini / etc.        compatibility / fallback
                    │                       │
                    └───────────┬───────────┘
                                │
                         R2 / D1 / KV
                    only where actually needed
```

### Why this split

* **Cloudflare** handles the frequent, small, latency-sensitive work: API gatewaying, auth/session checks, rate limits, provider routing, search requests, and streaming.
* **Render** is a compatibility/fallback service for Node-specific work or when the edge runtime is not a good fit. It should not be the primary path for tiny requests because Free services spin down after 15 minutes of inactivity and can take about a minute to wake.
* **Cloudflare Workflows** is a future option for genuinely long-running asynchronous research jobs. Do not add it until Synthexis actually needs durable background execution.
* **Deno Deploy** is optional rather than a promised free-tier backup. Its current platform and limits have changed, so the project should not document a fixed "1M requests/month free" assumption.

## Free-tier planning

* **Cloudflare Workers:** 100,000 requests/day on Free, with 10 ms CPU per invocation. Waiting on external network I/O does not consume CPU time in the same way active JavaScript execution does.
* **Cloudflare static assets:** static asset requests are free and unlimited on the Workers static-assets model.
* **Cloudflare D1:** useful for structured metadata, but Free has daily read/write limits; do not put every token/stream event into D1.
* **Cloudflare KV:** good for small cached/configuration values, but Free has 100,000 reads/day and 1,000 writes/day.
* **Cloudflare R2:** use for larger artifacts/files. The current Free allowance is 10 GB-month storage, 1M Class A operations/month and 10M Class B operations/month, with no egress charge.
* **Render Free:** 750 instance hours/workspace/month, but services spin down after 15 minutes idle and local filesystem data is ephemeral. Treat it as fallback/compatibility infrastructure, not the source of truth.

## 1. Deploy the Static Frontend

The frontend is a pure static React 19 / Vite application with client-side routing.

### Build the Static Bundle
```bash
npm install
npm run build
```
The output is written to the `dist/` folder.

### Deploy to Cloudflare Pages
1. Connect your repository to **Cloudflare Pages**.
2. Set Build Command: `npm run build`
3. Set Build Output Directory: `dist`
4. Set Environment Variables:
   - `VITE_PRIMARY_API_URL`: `https://breezy-api.<your-subdomain>.workers.dev`
   - `VITE_SECONDARY_API_URL`: `https://breezy-api.deno.dev`
   - `VITE_FALLBACK_API_URL`: `https://breezy-api.onrender.com` (optional)

### Deploy to Vercel / Netlify
1. Point root to repository.
2. Build Command: `npm run build`
3. Output Directory: `dist`
4. For single-page app (SPA) routing, ensure all paths route to `index.html`.

---

## 2. Deploy Cloudflare Worker (Primary API)

The primary API runs on Cloudflare Workers using the lightweight handler in `workers/index.ts`.

### Steps:
1. Install Wrangler CLI (if not installed):
   ```bash
   npm install -g wrangler
   ```
2. Authenticate:
   ```bash
   wrangler login
   ```
3. Set your server-side Gemini API key (encrypted secret):
   ```bash
   wrangler secret put GEMINI_API_KEY
   ```
4. Deploy the worker:
   ```bash
   wrangler deploy
   ```
5. Note your Worker URL (e.g. `https://breezy-api.<subdomain>.workers.dev`) and set it as `VITE_PRIMARY_API_URL` in your frontend environment.

---

## 3. Deploy Deno Deploy (Secondary API)

The secondary fallback runs on Deno Deploy using `deno/main.ts`.

### Steps:
1. Go to [Deno Deploy Dashboard](https://dash.deno.com/).
2. Click **New Project** and link your GitHub repository.
3. Set **Entrypoint**: `deno/main.ts`
4. Set Environment Variables in Deno Deploy Settings:
   - `GEMINI_API_KEY`: your server Gemini key
   - `ALLOWED_ORIGINS`: `*` (or your frontend domain)
5. Deploy project. Copy the resulting `https://<project-name>.deno.dev` URL and set it as `VITE_SECONDARY_API_URL` in your frontend.

---

## 4. Run / Deploy Render (Emergency Fallback & Local Dev)

The `server.ts` Express server handles local full-stack development and can be deployed directly to Render as a Web Service.

### Local Development:
```bash
npm run dev
```

### Deploy to Render:
1. Create a **Web Service** on Render.
2. Build Command: `npm run build`
3. Start Command: `npm start`
4. Set `GEMINI_API_KEY` in Render Environment Variables.

---

Deno can still run the shared `deno/main.ts` handler as an additional deployment target, but it should be treated as optional. Do not hard-code a quota assumption into product behavior.

## 🔄 How Failover Operates

1. **Primary:** Cloudflare Worker.
2. **Fallback:** Render Node API when the Worker is unavailable or a request requires Node-specific behavior.
3. **No blind retry:** if an AI request has already started streaming, do not automatically replay it on another backend; that can duplicate LLM calls.
4. **Truthful UI:** expose which backend is actually serving the request when fallback occurs.
5. **Future async path:** long-running research can move to Cloudflare Workflows once the product needs durable background jobs.

The deployment layer should never decide which AI model to use. Provider/model routing belongs to Synthexis' model-control layer.