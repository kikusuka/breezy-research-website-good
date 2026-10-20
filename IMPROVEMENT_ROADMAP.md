# Breezy improvement roadmap

This roadmap starts from the current product direction and the screen/functionality checks supplied by the product owner. Those checks are treated as the owner's current assessment, not as a new independent verification report.

## Constraints that must not change

- Keep the existing Breezy layout for desktop and mobile.
- Use the Stitch repository for visual theme inspiration only: color, typography, surfaces, borders, and related styling. Do not transplant its layout.
- Keep authentication enabled by default; use the frontend bypass only for a private review deployment. See [AUTH_RESTORE.md](./AUTH_RESTORE.md).
- Store account-backed chat history on Breezy servers; let users control where generated files live. See [STORAGE_AND_DATA_OWNERSHIP.md](./STORAGE_AND_DATA_OWNERSHIP.md) and [CHAT_PERSISTENCE_AND_RUNS.md](./CHAT_PERSISTENCE_AND_RUNS.md).
- Do not invent models, citations, activity, metrics, or successful operations.
- Do not claim browser/device compatibility without testing it.

## Priority 0 — Make screen review possible

- [x] Add a reversible frontend review-mode switch (auth remains on by default; private review uses `VITE_BREEZY_REQUIRE_AUTH=false`).
- [ ] Deploy/build review mode and confirm all workspace screens can be opened without a login prompt.
- [ ] Check that review mode does not falsely imply account isolation or cloud backup.
- [ ] Keep the existing layout unchanged.

## Priority 1 — Screen purpose and overlap

For each screen, document its user goal, main action, saved artifact, dependencies, and empty/loading/error states.

| Screen | Distinct responsibility | Audit focus |
|---|---|---|
| Chat | General conversation and iterative work | Streaming, attachments, model/provider errors, persistence |
| Research / Synthexis | Structured, source-grounded research | Real retrieval, source-to-claim links, stage transparency |
| Build | Create and edit project files | Actual file operations, safe preview, truthful GitHub status |
| Canvas | Spatial thinking and arranging artifacts | Must be meaningfully different from chat and notes |
| Notes | Persistent user-authored notes | Search, edit, organize, export, persistence |
| Models | Provider/model connections and configuration | Connection tests, model IDs, honest disconnected state |
| History | Find and reopen previous sessions | Search, reopen fidelity, delete behavior |
| Docs | Explain implemented Breezy features | Documentation matches the shipped behavior |
| Settings | App preferences and privacy controls | Remove duplicate controls; verify each setting persists |
| Profile | Identity and account preferences | Keep account identity distinct from app configuration |
| Vault (currently rendered under Models) | Decide whether this is a true separate concept | Rename or consolidate if it duplicates Models/Notes/Projects |

Do not add a screen merely to fill the sidebar. Consolidate only after checking the actual actions and data each screen owns.

## Priority 2 — Data ownership and persistence

- [ ] Move chat history from browser-only storage to account-scoped server persistence so users can sign out and return on another device.
- [ ] Persist run status/checkpoints and recover gracefully after network loss, refresh, or logout; never imply a run is resumable unless it really is.
- [ ] Add database pagination, indexing, per-account quotas, retention/deletion policy, and cost monitoring before scaling.

- [ ] Make the local-only versus Drive-connected state explicit for generated files and workspace artifacts.
- [ ] Implement or verify a clear Connect Drive → consent → save selected files → sync-status flow; Drive must not be required for chat history.
- [ ] Verify a saved item can be reopened after reload and after a failed network request.
- [ ] Add explicit export/backup and delete guidance for browser-local data.
- [ ] Never sync provider API keys by default.
- [ ] Verify sync conflicts, token expiry, revoked permissions, retries, and duplicate-save behavior.
- [ ] Avoid storing full user documents on Breezy servers unless a documented feature requires it.

## Priority 3 — Provider and research truthfulness

- [ ] Audit provider configuration for preset values that may look connected before credentials exist.
- [ ] Ensure every request uses the selected provider/model or returns a clear error; no silent fallback.
- [ ] Verify every displayed citation corresponds to retrieved source data and opens the correct URL.
- [ ] Distinguish a completed research stage from an attempted or failed stage.
- [ ] Confirm API keys are not exposed through logs, URLs, or error messages.

## Priority 4 — Visual theme and usability

- [ ] Keep the existing responsive layout.
- [ ] Apply the approved Breezy theme consistently: color tokens, typography, borders, elevation, focus states, hover states, and spacing.
- [ ] Compare screens against the approved Stitch theme references without copying their layout.
- [ ] Test the current layout in real desktop and mobile browser sizes; testing is verification, not a redesign mandate.
- [ ] Check keyboard navigation, visible focus, readable contrast, overflow, and long-content behavior.

## Priority 5 — Reliability and release readiness

- [ ] Run typecheck, automated tests, production build, and backend build in CI.
- [ ] Add end-to-end smoke tests for navigation, Chat, Research, saving/reopening, and provider errors.
- [ ] Identify whether root and `breezy-ui/` are both active applications; establish one canonical source of truth or document their separate roles.
- [ ] Verify server-side authorization and rate limiting separately from the frontend authentication gate.
- [ ] Verify deployment environment variables, health checks, logs, and recovery behavior.
- [ ] Do not call the product production-ready until these checks have evidence.

## Definition of done for a screen

A screen is complete when its purpose is clear, its primary workflow succeeds, all visible controls work, empty/loading/error states are honest, saved data behaves as documented, and the screen respects the existing layout and shared visual theme.
