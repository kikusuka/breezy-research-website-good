# Storage and data ownership

## Product decision

Breezy should store **chat history in Breezy's account-backed database** so users can sign out, return later, and find their conversations on another device. Generated files and user-owned research artifacts are different: Breezy should let the user download them or explicitly save them to a destination they control, such as Google Drive. Do not make Breezy's servers the default long-term file cabinet.

## Data ownership and location

| Data | Default location | Notes |
|---|---|---|
| Chat conversations and messages | Breezy database, scoped to authenticated account | Required for cross-device history; enforce server-side authorization on every read/write |
| Chat run state and checkpoints | Breezy database / durable run store | Persist status, timestamps, and safe resume metadata; never assume a browser tab owns the job |
| Generated PDFs, research papers, PPTs, DOCX and other exports | User downloads or explicitly selected destination | Do not silently retain copies on Breezy servers |
| Research sources and intermediate artifacts | Keep only what is required for a chat/run to work; expose export when appropriate | Avoid turning the server into a permanent research-file store |
| Notes and other user-created workspace data | Local until the user chooses export/sync | Clearly label local-only data; offer export/backup |
| Provider configuration | Browser storage or secure provider-specific flow | Treat API keys as secrets; do not sync them by default or log them |
| Operational records | Minimal server-side records needed for security, billing/cost control, and debugging | Minimize content retention and redact secrets |
| Authentication identity | Identity provider | Identity alone is not storage and does not grant Drive access |

## Chat history requirements

- Save each user message before starting the model request, then persist assistant output incrementally or at safe checkpoints.
- Each conversation and message must be owned by an authenticated account on the server. Never trust a client-supplied UID as authorization.
- Store stable conversation/message IDs, ordering, created/updated timestamps, model/provider metadata when useful, and explicit run status.
- Support list, search, reopen, rename, delete, and export. A deleted conversation should be removed according to a documented deletion policy, including any applicable backups/retention window.
- Use pagination and indexed queries. Do not load a user's entire history just to open the latest conversation.
- Add per-account quotas/rate limits and monitor database size, backup size, and query latency.
- Keep provider API keys and unnecessarily large raw provider payloads out of chat records.
- Explain retention and privacy to users before launch. Do not promise end-to-end encryption unless it is actually implemented.

## Interrupted chat and research runs

A browser tab closing, network dropping, or user signing out must not silently erase the conversation. Persist the user prompt and a run record before work begins. Model execution should be managed by a server-side request/job where feasible, not solely by a component's lifetime.

Use honest states such as `queued`, `running`, `completed`, `interrupted`, `failed`, and `cancelled`. Save safe checkpoints as output arrives. On reconnect/sign-in, show the last known state and partial output. Resume only if the provider/API and execution design support it; otherwise offer an explicit retry from the saved prompt and context. Do not claim that an in-flight provider request survived a server restart if it did not.

Logout should detach the UI and clear account-scoped in-memory state. It should not delete already-saved history or imply that a remote job was cancelled. If cancellation is requested, send a real cancellation signal where supported and persist the resulting status. If a provider cannot be interrupted, explain that the request may finish remotely, and prevent duplicate retries from accidentally charging twice where possible.

## Google Drive and user-owned files

1. Breezy works without Drive connected.
2. The user chooses **Connect Google Drive** only when they want to save/sync files there.
3. Explain requested permissions and what Breezy will create before consent.
4. Save only the files the user selects, in a clearly named Breezy folder if the user approves.
5. Show sync/save status, last successful save, retry/error states, disconnect, and export/delete guidance.
6. Handle token expiry and revoked access honestly; never pretend a save succeeded.
7. Request the narrowest scope that supports the feature. Do not require Drive just to use chat history.
8. Drive has its own quotas and policies; never promise unlimited storage.

## Why not store generated files on Breezy servers?

Server-side file storage increases storage, bandwidth, backup, retention, and incident-response costs. The user should control where large outputs live. If a future feature genuinely requires Breezy-hosted files, introduce it intentionally with per-user quotas, encryption, strict authorization, deletion/export, monitoring, and a documented cost model.

## Review mode warning

The temporary no-login review mode uses browser-local data and is for private UI review only. It does not provide account-backed chat history, cross-device sync, or backend security. Keep authentication enabled by default and use the bypass only in a private preview environment.
