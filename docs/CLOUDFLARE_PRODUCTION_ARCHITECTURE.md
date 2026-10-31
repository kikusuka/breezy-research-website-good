# Breezy Cloudflare production architecture

Status: proposed deployment target; this document does not claim that production infrastructure is provisioned.

## Product constraints

- Keep Breezy local-first. Cloud sync is optional and user-controlled.
- Keep Chat provider-flexible, including browser-to-device local endpoints. A local endpoint is reachable only from the user's browser/device network; a Cloudflare Worker cannot reach the user's localhost.
- Keep Research single-model. Search/retrieval may use separate services, but one configured research model performs the synthesis call.
- Never silently substitute a model/provider or move user data to cloud storage without consent.
- Keep the product usable when optional cloud persistence or a third-party provider is unavailable.
- No paid API is assumed. Free-tier quotas are ceilings, not a promise of unlimited service.

## Current repository facts (checked on 2026-10-30)

- The frontend is a Vite/React PWA.
- `workers/index.ts` already exposes the shared Web-standards backend router as a Cloudflare Worker.
- `wrangler.jsonc` already points Wrangler at `workers/index.ts`, but it currently has no D1, R2, KV, Queue, or static-assets binding configured.
- `server.ts` remains the local/Node adapter and serves the Vite build in production for the existing Node deployment path.
- `src/server-core/types.ts` has a D1 binding interface.
- `src/server-core/chatPersistence.ts` explicitly returns 503 when `env.DB` is not bound. Therefore durable cloud chat history is not production-ready merely because the Worker entrypoint exists.
- The health endpoint reports whether a D1 binding exists; that is configuration presence, not a full database readiness check.
- The current Worker is a backend entrypoint, not yet a complete Pages + Worker deployment configuration.

## Target topology

1. **Cloudflare Pages — frontend**
   - Build the Vite SPA/PWA and publish only the static `dist/` assets.
   - Configure SPA fallback and immutable caching for fingerprinted assets; revalidate HTML and the service worker.
   - Keep public frontend configuration limited to non-secret values such as the API base URL and Firebase public project configuration.
2. **Cloudflare Workers — API**
   - Deploy the existing `workers/index.ts` entrypoint as the API service, ideally on a dedicated API hostname.
   - Configure an explicit production `ALLOWED_ORIGINS` allowlist for the Pages/custom domain.
   - Keep secrets in Worker secrets, never in `VITE_*` variables or committed Wrangler vars.
   - Add request IDs, bounded request bodies, consistent error envelopes, and health/readiness checks.
3. **Cloudflare D1 — structured cloud data**
   - Use D1 for account-owned records that need server-side queries (initially durable Chat conversations/messages/runs).
   - Add versioned SQL migrations, indexes, owner-scoped queries, retention/deletion rules, and backup/restore procedures.
   - Do not move local Research history, Notes, Canvas, or user files into cloud storage by default. Add cloud sync only as an explicit opt-in feature with conflict semantics.
4. **Cloudflare R2 — user files and large objects**
   - Use R2 only when a real opt-in cloud-file feature exists. Store object metadata/ownership in D1 and objects in R2.
   - Use short-lived, scoped upload/download authorization; enforce size/type limits; never expose bucket credentials in the browser.
   - Do not use D1 rows for large file contents.
5. **Workers KV — cache/config only**
   - Consider KV for non-authoritative cache data such as short-lived discovery metadata or public configuration. Do not use it as the canonical store for chat history or user-owned records.
6. **Cloudflare Queues — only for durable background jobs**
   - Add a queue when there is an actual asynchronous job with retry/idempotency semantics (for example, file processing or a long-running export).
   - Do not enqueue ordinary streamed Chat/Research generation just to use another quota. Preserve user cancellation and clear job state.
   - Make every job safe to retry and visible to the user. Free-tier retention is not a substitute for a durable job ledger in D1.

## Free-tier reality check

The current Cloudflare documentation (checked 2026-10-30) lists these relevant Workers Free allowances:

- Workers: 100,000 requests/day, 10 ms CPU per invocation, 50 subrequests per invocation, 128 MB memory.
- D1: 5 million rows read/day, 100,000 rows written/day, 5 GB total account storage; free database size is limited to 500 MB each.
- R2: 10 GB-month storage, 1 million Class A operations/month, 10 million Class B operations/month, no egress charge.
- Queues: 10,000 operations/day on Free, with 24-hour message retention.

These limits are independently metered. They cannot be treated as one pooled unlimited quota, and splitting traffic across accounts to evade limits is not an architecture. We should minimize reads/writes, cache carefully, batch D1 mutations, and make optional cloud features degrade gracefully when limits are reached. Recheck the official pricing/limits before launch because Cloudflare can change them.

## Runtime boundaries

- Workers have a 10 ms CPU limit on Free. Keep the request router lightweight; network wait for provider APIs is different from CPU execution, but provider timeouts, stream disconnects, and response cancellation still need explicit handling.
- Do not attempt to run LLM inference inside a Worker. Call the configured hosted provider, or call a browser-local model directly from the browser for Chat.
- Browser-local Chat requests must remain browser-to-device. Handle HTTPS/mixed-content, CORS, LAN permissions, mobile background suspension, and explicit timeouts in the UI.
- Hosted Research cannot use a phone's `localhost` endpoint. Keep local models excluded from hosted Research readiness until a deliberate and secure browser-to-Research execution design exists.
- Do not use an in-memory Worker Map as a durable/global rate limiter. Use a Cloudflare-supported coordination/storage mechanism if a globally consistent limit is required; otherwise label the current limiter as best-effort and isolate it from security-critical controls.

## Deployment sequence

### Phase 0 — freeze the contract
- Treat this document as the deployment target.
- Inventory every API route, environment variable, persistence path, upload path, and provider call.
- Identify any Node-only imports or APIs in the shared router and its transitive imports.
- Confirm the production frontend API URL strategy and the intended custom domains.

### Phase 1 — make the Worker independently deployable
- Add a reproducible Wrangler dev/build/deploy workflow without changing the current Node adapter.
- Add local and preview environment configuration with no production secrets.
- Add Worker runtime tests for health, auth, CORS, streaming, cancellation, and provider failure.
- Verify the uncompressed Worker bundle stays under the current plan's size limit.
- Do not deploy automatically from this PR.

### Phase 2 — make D1 real
- Add migrations for the existing chat persistence schema.
- Add a checked-in example binding with a placeholder database ID and exact setup instructions; never invent a real database ID.
- Add a migration command and a smoke test that checks schema version and required indexes.
- Test owner isolation, pagination, idempotency, concurrent writes, deletion, and behavior when D1 is missing or over quota.
- Only mark cloud Chat persistence ready after the actual D1 binding and schema are verified.

### Phase 3 — Pages + API integration
- Add the Pages build/output and SPA fallback configuration.
- Set the frontend API base URL per environment; avoid hard-coded production URLs.
- Verify CORS from the deployed Pages origin and ensure credentials are not broadly enabled.
- Test PWA update behavior, deep links, and API streaming through the chosen hostname.
- Keep the existing Node adapter available until the Cloudflare path has passed smoke tests.

### Phase 4 — optional cloud files and background work
- Add R2 only alongside a user-visible opt-in cloud-file feature.
- Add Queue consumers only for durable asynchronous jobs with idempotency and a D1 job ledger.
- Add per-user quotas, abuse controls, retention, deletion, and export/restore before opening these features to public users.

### Phase 5 — production readiness
- Add rate limiting that is appropriate to the threat model, abuse protection, request-size caps, and secret rotation instructions.
- Add structured operational logs without prompts, API keys, file contents, or unnecessary personal data.
- Add service-level health checks and a deploy rollback procedure.
- Run end-to-end tests against a Cloudflare preview deployment before switching the public domain.
- Document exact free-tier usage dashboards and thresholds; alert before quotas are exhausted.

## Launch blockers

- A real D1 database and migrations are not currently configured in `wrangler.jsonc`.
- No R2 or Queue bindings are currently configured; they are intentionally not launch blockers until corresponding product features exist.
- The Pages output/API-origin configuration has not yet been established in the checked-in deployment config.
- The production origin allowlist and Worker secrets must be configured in the Cloudflare dashboard.
- Cloudflare preview deployment and live smoke tests have not been performed.

## Official references

- Workers pricing: https://developers.cloudflare.com/workers/platform/pricing/
- Workers limits: https://developers.cloudflare.com/workers/platform/limits/
- D1 pricing: https://developers.cloudflare.com/d1/platform/pricing/
- D1 limits: https://developers.cloudflare.com/d1/platform/limits/
- Queues limits: https://developers.cloudflare.com/queues/platform/limits/
