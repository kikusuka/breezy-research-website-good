# Decision record: Discord is not Breezy's primary database

**Status:** Do not use Discord message history as the canonical store for private user data. A disposable proof of concept may test the API, but must not contain real user conversations.

## Why the idea is attractive

A private Discord channel is easy to create, message IDs are addressable, and a bot can be written quickly. It could be useful for a small internal experiment or an operational notification sink.

## Why it is not production-grade database storage

- **Rate limits are real.** Discord applies route/global rate limits and can return HTTP 429. It is not an unlimited ingestion endpoint; bursts need backoff and a durable queue.
- **No database semantics.** Message history does not provide transactions, indexed queries, joins, owner-scoped access checks, uniqueness constraints, or reliable pagination across application entities.
- **Privacy and access control are fragile.** A bot token is a powerful secret. Channel permissions, accidental invites, audit visibility, token compromise, and Discord account/server administration become part of Breezy's security boundary.
- **Deletion and retention are harder to guarantee.** Application-level deletion must also find and delete every related Discord message. Backups, caches, and retention behavior need explicit handling.
- **Availability and portability.** Breezy's data durability would depend on a third-party chat product, its API, account standing, service availability, and platform policy. Discord can change limits or access rules.
- **Message format is a poor fit.** Large payloads, edits, attachments, search, schema changes, and concurrent writes need custom workarounds. A message ID is a pointer, not a database transaction or ownership guarantee.
- **Compliance and user trust.** Users expect private chat history to live in a documented application data store with clear export and deletion behavior, not in a hidden Discord server.

## If we run a proof of concept

1. Use a separate test server and synthetic data only.
2. Keep the bot token in server-side secrets; never ship it to Vite/client code or commit it.
3. Use a dedicated channel, strict bot permissions, payload versioning, request IDs, bounded payload sizes, retry/backoff for 429s, and duplicate detection.
4. Test message ordering, concurrent writes, API outages, rate limits, deletion, restore, and token rotation.
5. Treat it as an experiment, not as a source of truth. Do not migrate real conversations into it without a separate privacy/security review.

## Recommended production direction for Breezy

Use a real database for canonical chat metadata, messages, run states, ownership, pagination, and deletion. The current backend is already a Cloudflare Worker, so prototype Cloudflare D1 behind authenticated Worker routes after confirming the actual deployment and bindings. D1 is not unlimited; define per-account quotas, measure growth, and plan migration if it stops fitting. Use object storage only for suitable blobs, and keep generated papers/PDFs/PPTs user-owned via download or an explicit Google Drive save.

The browser must never choose an arbitrary owner ID. Derive the owner from the verified Firebase ID token on the server. Never publicly cache authenticated chat responses. Save the user prompt before generation, checkpoint partial assistant output, and label interrupted runs honestly.

## Decision

**No Discord-backed primary chat database in production.** If useful, build a short isolated benchmark to learn about Discord API limits, but spend the production implementation effort on the existing authenticated API and a proper database.
