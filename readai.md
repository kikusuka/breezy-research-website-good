# Breezy — Read This First (Project Handoff)

> Living handoff document for future AI assistants and human contributors. Read this before proposing architecture changes or editing the app. Update it when decisions change.
>
> Last updated: 2026-10-20. This document records the current direction and proposed architecture; it is **not** proof that every feature, deployment, quota, or backup is implemented or verified.

## 1. Project identity and working rules

- **Repository:** [kikusuka/breezy-research-website-good](https://github.com/kikusuka/breezy-research-website-good)
- **This is the owner's favourite candidate so far.** They specifically like this repository's UI design and want to make the product useful and dependable rather than replacing its design.
- **Frontend hosting:** Cloudflare is the preferred/required direction.
- **Budget constraint:** design around free tiers first. Do not assume a paid plan, credit card, paid API, or future upgrade will be available. Be honest that provider quotas and free-tier terms can change; no cloud provider promises unlimited free production capacity forever.
- **Product philosophy:** the AI can generate code, but a human must review, test, and engineer it. Do not treat generated code or an AI audit as verified merely because it sounds confident.
- Keep the current layout on desktop and mobile. The Stitch repository is theme inspiration only (colour, typography, borders, surfaces), not a layout to transplant.
- Every screen must have a clear purpose. Prefer consolidating duplicate functionality over adding more tabs.
- No fake models, fake connected states, fake citations, fabricated metrics, or success messages for operations that did not succeed.
- No silent provider fallback. If the selected provider/model is unavailable, explain the real error.
- Do not deploy, merge into `main`, or make destructive changes without explicit approval. Work on a separate branch and make changes reviewable.
- Be direct about tradeoffs, hacks, and uncertainty. Do not claim a build, test, browser check, backup, or deployment passed unless it actually ran and its result is known.

## 2. Product direction and workspace responsibilities

Breezy should be a coherent workbench, not a collection of impressive-looking disconnected demos.

- **Chat:** quick conversation and iterative work with one deliberately selected model.
- **Research / Synthexis:** structured investigation with retrieval, visible sources, disagreement/verification and synthesis. More stages do not automatically mean more truth.
- **Build:** a constrained GitHub repository editing/preview workflow, not a full hosted IDE or secure arbitrary-code sandbox.
- **History:** find, reopen, export and delete previous sessions/runs. Do not imply cross-device persistence until implemented and verified.
- **Notes:** user-authored working notes.
- **Canvas:** arrange/connect ideas and selected artifacts; it must be meaningfully different from Notes and Chat.
- **Models:** provider credentials/configuration, exact model IDs, connection tests and research-seat assignments.
- **Settings:** app preferences and research/search controls; avoid duplicated controls.
- **Docs:** explain what actually ships.
- **Profile:** account identity, not a duplicate of app configuration.
- **Vault:** currently associated with Models in the audit; decide whether it represents a distinct user task or should be consolidated.
- Inspect actual behavior before changing navigation. A screen should state its goal, main action, saved artifact, dependencies, and empty/loading/error states.

## 3. Preferred data model: local-first, optional cloud sync

The owner's explicit preference is **local-first with optional cloud sync**.

### Default experience
- Users should be able to use local workspace features without being forced to create an account or enable cloud sync, where the feature/provider permits it.
- Keep local drafts and workspace data on the user's device/browser by default where practical.
- Use IndexedDB for larger structured browser-local data; use LocalStorage only for small settings/preferences. Document a single source of truth for each data type.
- Clearly tell users when data exists only in this browser/device. Browser-local storage can be cleared, quota-limited, or lost with device/browser failure. It is not a backup.
- Do not silently upload local content.

### Optional sync
- Cloud sync must be an explicit opt-in with a clear explanation of what data leaves the device, where it is stored, and how to turn sync off.
- Sync should be account-scoped and use authenticated server routes. Every private server route must validate the auth token and derive the user/owner ID server-side; never trust a client-supplied owner ID.
- Do not sync provider API keys by default. Prefer keeping credentials local and warn users which provider receives prompts/files.
- Build conflict handling, retries, idempotency, token expiry/revocation handling, and clear sync status before calling it reliable.
- Local-only mode must remain useful if the cloud service is down or the user reaches a quota.
- Optional user-owned Google Drive storage may be explored for user-selected generated files, but Drive must not be required for chat history and must not be described as implemented until verified.

### Data ownership
- Users should own their work and be able to leave Breezy with it.
- Explain what is local, what is synced, what a provider receives, and what can be deleted.
- Avoid retaining full documents on Breezy servers unless a documented feature requires it.
- Provide deletion controls that distinguish local deletion from cloud deletion and explain any retention limits.

## 4. Backup, export, and restore are requirements

A backup is not complete merely because data is present in a database.

Build a **portable user export and restore** flow. Suggested approach:

1. Export a versioned archive (for example, a `.breezy-backup.zip`) containing a manifest plus JSON/Markdown and any included user-owned attachments.
2. Include schema/version metadata, export timestamp, and documented record types. Do not include provider secrets/API keys by default.
3. Validate archive structure, size and types on import. Handle unsupported versions, malformed files, duplicates and partial failure without silently corrupting existing data.
4. Preview what will be imported and whether it will merge with or replace local data. Never overwrite data without a clear user choice.
5. Verify round-trip fidelity: export → clear/use a clean profile → restore → compare record counts, content, timestamps and attachment links.
6. Make export possible while cloud sync is unavailable. Restore must work without requiring Breezy's servers.
7. Test large exports and low-storage devices; report progress and useful errors.
8. Keep backup/export separate from cloud sync. Sync mirrors data; a backup must help recover from accidental deletion or corruption.

Potential future feature: scheduled cloud backups, but only after the user chooses a destination and the backup/restore lifecycle is tested. Do not promise automatic backups before they exist.

## 5. Hosting and storage discussion — free-first, no false “unlimited”

### Current preference
- Host the frontend on **Cloudflare Pages** (or the appropriate current Cloudflare frontend product).
- If server-side API routes are needed, evaluate **Cloudflare Workers**.
- Evaluate **Cloudflare D1** for relational/account metadata and sync records, and **Cloudflare R2** for larger binary attachments/backups. These are candidates, not a decision to migrate blindly.
- Cloudflare Queues or another durable job mechanism may help with asynchronous work if the free plan supports the required usage; verify current availability, quotas and retention before relying on it.
- Check the actual current free-plan limits and billing/credit-card requirements directly with official documentation before implementation. Do not hardcode quota assumptions from old articles.

### Storage separation
Do not put everything in one database. Separate:
- **Browser-local workspace:** drafts, local history, notes, local artifacts.
- **Small cloud database (if sync is enabled):** account-scoped metadata, sync versions/conflict records, settings, and indexes.
- **Object storage (if enabled):** larger attachments and versioned backup archives.
- **Provider inference:** user-selected model provider, with honest provider errors and cost/quota boundaries.
- **Operational telemetry:** minimal, privacy-conscious diagnostics; never log secrets or full private prompts by default.

Use pagination, indexes, request-size limits, per-account quotas, rate limiting, retention/deletion rules, idempotency keys, and cost/usage monitoring before inviting large numbers of users. Apply backpressure and return clear retryable errors when capacity is reached. Do not make a free-tier system look unlimited by silently dropping data.

### Important free-tier reality
“Always free” means a provider currently offers some ongoing free allowance under its terms, not infinite storage or guaranteed unlimited requests. Limits, eligibility, abuse policies and products can change. Build graceful degradation and portable exports so Breezy can move providers without holding user data hostage.

### Database candidates to compare before choosing
- **Cloudflare D1:** attractive because the frontend/API direction is Cloudflare and it reduces moving parts. Check database size, query, row, request and backup/export limits against actual expected workload.
- **Turso/libSQL:** worth comparing for SQLite-style sync data, but it adds a provider and another operational dependency.
- **Neon or Supabase Postgres:** stronger conventional relational options, but compare free compute/storage/pausing/auth/backup limits and whether a second provider is worth the complexity.
- **Oracle Cloud / AWS DynamoDB:** can offer generous allowances for particular workloads but increase setup/operational complexity and lock-in. Do not choose only by a headline GB figure.
- A relational database is not a substitute for object storage when users attach large files.

**Provisional direction to investigate first:** Cloudflare Pages + Workers + D1 for opt-in sync metadata, and R2 only if/when larger cloud files/backups are actually needed. Keep the local-first experience independent of these services. Confirm quotas and the repository's existing server/API architecture before committing.

## 6. Discord bot storage idea — explicitly not the primary database

The owner proposed that when the main database is near capacity, Breezy could push data into a private Discord server through a bot.

Do **not** implement this as automatic overflow storage without a separate review. Discord messages are not a dependable database or backup system:
- API rate limits and platform policies apply; private does not mean unlimited or guaranteed permanent storage.
- Messages are awkward to query, index, update transactionally, deduplicate and restore consistently.
- Bot tokens and private-channel permissions create a serious secret/access-control risk.
- Message deletion, account/server access changes, API changes or moderation can break retrieval.
- This would mix user data with a chat platform and make privacy, deletion, export and incident response harder.
- It is not an acceptable way to bypass hosting limits or provider terms.

If Discord is ever used, treat it only as an optional, explicitly disclosed **notification or human-operated emergency copy** for non-sensitive operational artifacts—not as the canonical user database, not as a hidden overflow bucket, and never store API keys or private user content there by default.

When storage fills up, Breezy should instead: stop accepting writes safely, preserve local data, queue/retry only if a real durable queue is configured, show a clear status/error, allow export, and request user action. Never report a save as successful until the durable write has succeeded.

## 7. Security and reliability requirements

- Auth is enabled by default. The existing reversible review-mode switch is for private review deployments only; never use it as a production auth substitute.
- Server routes verify Firebase tokens (or the chosen auth system) and enforce ownership for every record read/write/delete.
- Treat browser-stored API keys as device-local credentials, not a secure server vault. Never expose secrets in URLs, logs, errors, analytics or client bundles.
- Restrict CORS, validate request schemas and content types, cap request bodies and attachment sizes, and rate-limit expensive endpoints.
- Avoid arbitrary code execution in Build previews. Clearly disclose GitHub token scope, branch/commit effects and preview limitations.
- Do not silently fallback between providers. Show the actual selected model/provider and the real failure state.
- For research, every citation must map to a retrieved source and correct URL; distinguish attempted, failed and completed stages.
- For cloud persistence, design for duplicate requests, retries, network loss, partial writes, schema migrations and deletion propagation.
- Add monitoring for errors, latency, quota use, storage growth and provider failures without collecting unnecessary private content.
- Test restoration from backup, not just backup creation.
- Keep an incident/recovery note: what happens if the database or object store is unavailable, corrupted or deleted?

## 8. Traffic and graceful degradation

Plan for bursts, but do not claim to handle a traffic level until load-tested.

- Cache only public/static or safely cacheable responses. Never publicly cache private account data or personalized responses without correct cache isolation.
- Keep model inference and long-running research away from latency-sensitive UI paths where practical.
- Use bounded concurrency and request timeouts; cancel work when users cancel it; do not retry non-idempotent writes blindly.
- If background jobs are needed, use a durable queue with bounded retries, deduplication and dead-letter/error handling—not Discord messages as a queue.
- Add per-user and global rate limits before opening access widely.
- Paginate history and large lists; avoid loading an account's entire dataset into memory.
- Test simultaneous sign-ins, large histories, network disconnects, rate-limit responses, provider timeouts, full storage and restore failures.
- A free tier can be a launch constraint. If demand exceeds it, preserve local use and export while clearly communicating cloud-sync/service limits rather than losing user data.

## 9. Repository and engineering notes

- Product audit: [PRODUCT_UX_AUDIT.md](./PRODUCT_UX_AUDIT.md)
- Improvement roadmap: [IMPROVEMENT_ROADMAP.md](./IMPROVEMENT_ROADMAP.md)
- Main frontend/package path: `breezy-ui/`
- Package scripts currently declared in `breezy-ui/package.json`:
  - `npm run dev` — `tsx server.ts`
  - `npm run build` — Vite production build and bundle server
  - `npm run typecheck` — `tsc --noEmit`
  - `npm test` — `vitest run`
- Script definitions do not prove they pass. Run them and record results before claiming verification.
- Current audit describes React + TypeScript + Vite, an Express server entry, Firebase auth, provider integrations, local browser persistence, research streaming and GitHub-backed Build. Verify actual implementation and deploy bindings before assuming a route or capability exists.
- The repo already contains separate auth, storage/data ownership, and chat persistence/run documents according to the prior project handoff; inspect the actual files before editing or duplicating their decisions.

## 10. Recommended implementation order

Do not start by wiring Discord or adding a giant database. First establish what works.

1. **Baseline:** inspect current branch and repository state; install dependencies; run build, typecheck and tests; record failures accurately.
2. **Data inventory:** list every record type and its current source of truth (LocalStorage, IndexedDB, Firebase, server, GitHub or provider). Identify which are local-only and which are truly synced.
3. **Reliability audit:** inspect every read/write/delete path, auth ownership checks, provider secret handling and error behavior.
4. **Portable backup/restore:** define a versioned format, implement export/import, and write round-trip tests before relying on cloud persistence.
5. **Local-first correctness:** ensure data survives reload, is clearly labeled as local, and survives app errors; provide export and sensible storage/quota handling.
6. **Optional cloud sync:** prototype a minimal account-scoped sync vertical slice for one data type. Add conflict, retry, deletion and auth tests before expanding to other data.
7. **Choose hosting/storage:** verify current free-tier limits, backups, region/latency, request limits, data export and migration path; then choose D1/R2 or an alternative based on real workload.
8. **Traffic safeguards:** add pagination, rate limits, bounded concurrency, request caps and clear quota errors; test load and recovery.
9. **Screen-by-screen product polish:** preserve the UI the owner likes; make Chat, Research, Build, History, Notes, Canvas and Models useful and reliable. Functionality first; documentation updated after behavior stabilizes.
10. **Private review and deployment:** test the review build without weakening production auth; verify deployment and rollback; only merge/deploy after owner approval.

## 11. Decisions vs open questions

### Decisions already stated by the owner
- This repository is the favourite UI candidate and should be improved, not replaced wholesale.
- Cloudflare is the frontend host direction.
- Work within free tiers first; be candid about limits and never assume a paid upgrade.
- Local-first with optional cloud sync.
- Portable user export and restore are required.
- Make Breezy dependable for real users, including backups, graceful failures and traffic handling.
- Human review and engineering are mandatory.

### Still open — do not invent answers
- Which records should sync (chat, research runs, notes, canvas, settings, attachments)?
- Is account sign-in optional for local-only mode, or required for particular cloud features?
- Should cloud sync be Cloudflare D1 + R2, Firebase-backed, or another system? Inspect current implementation and compare before migrating.
- What is the acceptable per-user storage and request budget under free quotas?
- How long should synced data, deleted items and backup versions be retained?
- Should user-owned Drive be offered for selected files?
- Which data, if any, may be included in optional diagnostics?
- What measurable initial traffic target should be load-tested?

## 12. Instructions for the next assistant

1. Read this file and the current product audit/roadmap before suggesting architecture.
2. Verify repository files and actual current branch; do not assume old PRs or earlier repositories match this repo.
3. Do one small, reviewable engineering step at a time, preferably on a dedicated branch.
4. Preserve the existing UI and functionality unless a change is justified by a specific user problem.
5. Do not implement Discord as a database or claim unlimited free storage.
6. Do not claim cloud sync, backups, security, scalability or tests are complete without implementation and verification.
7. Report exactly what changed, what was tested, what failed, and the next concrete step.
