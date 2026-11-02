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

The frontend is a static React/Vite app. Build output is `dist/`.

1. Connect the repository to Cloudflare Pages.
2. Set the build command to `npm install --legacy-peer-deps && npm run build`.
3. Set the build output directory to `dist`.
4. Set `VITE_PRIMARY_API_URL` to the deployed Worker URL, for example `https://breezy-api.<your-subdomain>.workers.dev`.
5. Leave `VITE_SECONDARY_API_URL` and `VITE_FALLBACK_API_URL` empty unless those backup services have actually been deployed and tested. Configuring a URL does not create a backend.
6. Set the frontend Firebase web-app configuration variables from the same Firebase project: `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_APP_ID`, `VITE_FIREBASE_STORAGE_BUCKET`, and `VITE_FIREBASE_MESSAGING_SENDER_ID`. These are client configuration values, not server provider secrets; restrict the API key to the intended services and web origins.

Vite variables are embedded at build time. Rebuild and redeploy Pages after changing them.

## 2. Deploy the Cloudflare Worker API

The primary API entry point is `workers/index.ts`, configured by `wrangler.jsonc`.

1. Confirm `FIREBASE_PROJECT_ID` matches the Firebase project used by the frontend.
2. **Before deploying, replace the localhost-only `ALLOWED_ORIGINS` value in `wrangler.jsonc` with the exact frontend origin(s)**, e.g. your Pages `.pages.dev` URL and custom domain, comma-separated with no paths or trailing slashes. Do not use `*` for production. The current committed localhost values are for local development; leaving them in place will block browser requests from the production frontend.
3. Authenticate Wrangler with `npx wrangler login`.
4. Deploy with `npx wrangler deploy`.
5. Set the resulting Worker URL as `VITE_PRIMARY_API_URL` in Cloudflare Pages and trigger a new frontend build.

Breezy supports users configuring their own provider keys in the app. A server-side provider key is only needed if you intentionally want to offer a server-managed provider; if so, add it as a Worker secret (never as a `VITE_*` variable), for example `npx wrangler secret put GEMINI_API_KEY`.

## 3. Firebase and production smoke test

- Add the deployed Pages domain (and any custom domain) to Firebase Authentication's authorized domains.
- Confirm `GET https://<worker-url>/api/health` returns a healthy response.
- Test sign-in, configure a research model, send one chat message, and run a short research question with search grounding both enabled and disabled.
- Confirm a failed provider request displays a real error rather than silently switching models.
- Test page refresh and mobile layout on the deployed site.
- Check Worker logs for unexpected 4xx/5xx responses. Do not expose provider keys in browser variables or logs.

Do not advertise Deno or Render as failover until those services are deployed, configured with the same Firebase project and allowed origins, and tested end to end.

The deployment layer should never decide which AI model to use. Provider/model routing belongs to Breezy's model-control layer.