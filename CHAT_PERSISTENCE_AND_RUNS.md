# Chat persistence and interrupted runs

## User promise

A user can sign out, close the tab, lose their connection, or return on another device and still find previously saved conversations after signing in to the same Breezy account. A disconnect must not silently erase a prompt or make partial output look complete.

## Proposed data model

- **Conversation:** stable ID, authenticated owner ID, title, created/updated timestamps, archived/deleted state.
- **Message:** stable ID, conversation ID, role, content, sequence/order, created timestamp, optional provider/model metadata, completion/partial marker.
- **Run:** stable ID, conversation ID, initiating message ID, status, start/update/end timestamps, cancellation request, safe checkpoint or partial output, retry lineage, error category.
- **Usage metadata:** only what is needed for quotas, abuse prevention, and cost monitoring; avoid retaining large raw provider responses unnecessarily.

## Initial database recommendation

The current primary backend is a Cloudflare Worker, so **Cloudflare D1 is the first candidate to prototype**, rather than introducing InfinityFree PHP or a Telegram/Sheets storage workaround. D1 is accessed through a Worker binding and supports prepared SQL statements and transactional batches. It fits the existing deployment path, but it is not unlimited: the current Free plan documents a 500 MB maximum per database and 5 GB total account storage. Workers Free also has a 100,000-request/day limit. Treat these as prototype/early-beta ceilings, not a promise of unlimited scale.

Before implementation, confirm the actual production account, current plan, database bindings, and deployment path. If the app continues to fail over chat API requests to Deno/Render, those backends must reach the same durable database safely or chat persistence must stay pinned to the canonical Worker. Do not accidentally create separate histories on separate failover backends. A later move to PostgreSQL or another shared SQL service is reasonable if measured size, query patterns, portability, or multi-runtime access justify it.

Put owner-scoped indexes on conversation listing and message ordering. Store the verified UID returned by `verifyFirebaseIdToken` on the server, not a UID supplied by the browser. Use prepared statements for all user-supplied values. Never cache authenticated conversation/message/run responses in a shared public cache.

## Run lifecycle

1. Persist the conversation and user message before invoking a provider.
2. Create a run record with status `queued` or `running`.
3. Persist assistant output at safe intervals/checkpoints; mark partial output as partial until completion is confirmed.
4. Persist one terminal state: `completed`, `interrupted`, `failed`, or `cancelled`.
5. When the user returns, load saved history and the last run state. Offer resume only when the backend/provider supports it; otherwise offer a retry that clearly starts a new attempt.
6. Use idempotency keys or retry lineage where feasible so reconnecting does not accidentally create duplicate paid provider calls.
7. Treat logout as a UI/session transition, not an instruction to delete saved messages. A remote run continues or stops according to the documented server policy. A cancel button must invoke real cancellation and report its result.

## What "resume" can honestly mean

A model API stream usually cannot be reattached to after the original request has ended. Breezy can reliably restore saved conversation history and partial output, but continuing the exact same generation requires a durable execution layer and provider support. Until that exists, label the run as interrupted and offer **Retry from saved prompt** rather than promising exact continuation.

## Security and privacy requirements

- Every conversation/message/run read or write must be authorized server-side against the signed-in account.
- Enforce limits for message size, conversation count/size, concurrent runs, provider calls, and request rate.
- Never expose API keys in persisted messages, logs, URLs, or client-visible errors.
- Support conversation deletion and export, with documented backup-retention semantics.
- Add retention/privacy copy before release; avoid claiming end-to-end encryption without implementation.
- Keep generated papers, PDFs, PPTs, and documents user-owned: browser download or explicit Google Drive save. Do not store these as permanent Breezy server files by default.

## Implementation sequence

1. **Audit existing backend and deployment:** identify the canonical API, database availability, auth-token verification, and any existing durable run infrastructure. Do not assume a client-side Firebase session protects arbitrary API endpoints.
2. **Define API contract:** list/create/rename/delete conversations; list messages with pagination; create run; append/checkpoint output; fetch run status; request cancellation; retry interrupted run.
3. **Implement schema and server authorization:** migrations, owner-scoped queries, indexes, request validation, quotas, and tests for cross-account isolation.
4. **Integrate Chat UI:** persist before generation, incremental saves, loading/reconnect states, history list/search/open, and clear errors when persistence fails.
5. **Add interruption tests:** refresh during streaming, network loss, sign out/in, second-device login, server restart, cancellation, provider error, duplicate retry, and account-isolation tests.
6. **Measure cost:** record bytes/messages per account, database growth, backup size, query latency, and provider usage; choose limits from measured data.

## Acceptance criteria

- A saved chat survives reload and sign-out/sign-in on a second browser/device.
- Account A cannot read, update, or delete account B's conversations or runs.
- A network interruption never marks a partial answer as completed.
- A returned user can see the last known run state and either resume when supported or retry explicitly.
- Logout does not erase saved history.
- Generated files are not silently retained server-side.
- Pagination, deletion, quotas, and persistence failures have tested behavior.

## Implementation checkpoint (2026-10-21)

The first server-side persistence slice now exists on the review branch:

- Authenticated, owner-scoped conversation listing, creation, rename, and soft deletion.
- Owner-scoped message pagination.
- Run creation that stores the user prompt and queued run in a D1 batch before the generation request should begin.
- Owner-scoped run status reads and output checkpoints, with terminal-state checks and partial output kept distinct from completed output.
- Explicit `CHAT_PERSISTENCE_UNAVAILABLE` responses when the D1 binding is missing; no fallback to a different backend database.

The binding name expected by the code is `DB`. The current `wrangler.jsonc` does not declare a D1 database binding or database ID, and no production D1 database ID has been confirmed. **Do not deploy this as active cloud persistence yet.** Create/confirm the canonical D1 database, apply `migrations/0001_chat_persistence.sql`, add the real binding to the deployment configuration, and verify that the deployed Worker is the canonical API before connecting the Chat UI.

The current Chat UI is not yet wired to these routes. The existing provider request still uses the existing chat endpoint, and its response is not incrementally checkpointed. The next implementation slice must integrate the UI with the new API, save the user prompt before generation, checkpoint output safely, record interruption/failure states, and ensure persistence requests are pinned to the canonical Worker rather than the generic backend failover path. Until then, existing browser-local chat history remains the active user experience.
