# Breezy product and UX audit

**Purpose:** keep Breezy a coherent workbench instead of a collection of impressive-looking but disconnected demos.

**Assessment date:** 2026-10-20  
**Scope:** current repository implementation and visible workspace behavior, not a live browser usability study.

## Executive verdict

Breezy is not inherently a toy: the repository has real provider routing, research streaming, source/evidence presentation, local persistence, export, a GitHub editing workflow, and explicit model configuration. But it is currently **an ambitious prototype with several production gaps**, not yet a dependable all-in-one daily driver. A broad feature list is not the same as a coherent product.

The strongest product idea is the distinction between:
- **Chat:** fast, direct interaction with one deliberately selected model.
- **Synthexis Research:** slower, multi-stage investigation where sources, disagreement and synthesis matter.
- **Build:** a constrained repository editor/preview workflow, not a full hosted IDE.
- **Notes / Canvas / History:** personal organization around the work.

Every screen should justify its presence by doing one job better than the other screens. If two workspaces do the same job, consolidate them rather than adding more navigation.

## Why the current technology choices make sense — and where they do not

| Choice | Product reason | Honest limitation / decision |
|---|---|---|
| React + TypeScript + Vite | Fast iteration, typed UI, suitable for a responsive single-page workspace | Keep component boundaries and automated checks; do not let every new feature become one giant screen |
| Cloudflare Worker API | Edge delivery and a natural place for authenticated API routing | A Worker is not itself a durable database or job queue. Add persistent storage explicitly and verify deployment bindings |
| Firebase Authentication | Established identity providers and account IDs | Frontend auth state is not authorization. Every private server route must verify the token and derive the owner on the server |
| Bring-your-own-key providers | Lets users choose models and control provider costs; avoids pretending one bundled model is universally free | Explain where keys are stored and which services receive prompts. Local browser storage is not a server-side vault |
| Explicit provider/model selection | Prevents silent fallback and fabricated model status | Empty states must guide setup; model catalogs go stale, so custom IDs and real connection tests matter |
| Multi-stage Synthexis research | Separate analysis, criticism, verification and synthesis can make reasoning inspectable | More model calls cost more and can compound errors. Label evidence as model-assisted, show sources, and never equate stage count with truth |
| Browser storage for local drafts | Simple, fast and avoids sending every note to a server | It is device/browser-specific, can be cleared or quota-limited, and does not satisfy cross-device chat history. Treat it as a prototype/local cache, not account-backed persistence |
| IndexedDB for larger research sessions | Better suited than LocalStorage for structured, larger records | It is still browser-local. Keep one documented source of truth and test fallback behavior |
| Puter.js option | Can offer an alternative provider path without asking every user to bring an API key | Availability, account requirements, model access and provider terms are external dependencies; don't promise unlimited free inference |
| GitHub-backed Build | Uses a real repository as the user's source of truth and can commit real changes | A browser editor is not a secure sandboxed cloud IDE. Token scope, branch safety, preview limits and runtime limits must be visible |
| Markdown/PDF export | Users can keep their work outside Breezy | Make export and deletion discoverable. Do not imply server-side document retention or automatic Drive sync unless implemented |

## Purpose of every current workspace

- **Chat:** quick thinking, drafting, explanations and iteration with one explicitly selected model.
- **Research / Synthexis:** investigate a question with retrieved sources and multiple stages. This is the differentiator, so the evidence trail and run status must be trustworthy.
- **History:** find, reopen and export previous research runs. It currently should not be described as cross-device server-backed chat history.
- **Notes:** private scratchpad and working notes, stored locally.
- **Canvas:** collect and connect ideas, research excerpts and code snippets. It is a lightweight board, not collaborative whiteboarding.
- **Build:** browse/edit a GitHub repository, preview supported content and commit changes. The output panel is not a full shell or isolated hosted container.
- **Models:** manage credentials, connection tests, exact model IDs and research seat assignments.
- **Settings:** control research search/method behavior without mixing advanced settings into the main flow.
- **Docs:** explain how to start, which tool to choose, data ownership, model/provider behavior and limitations.
- **Profile:** account identity, external integrations and local data controls.

## Current UX findings

### Improvements in this branch
- Chat's empty state now explains why no model is available and offers a direct path to Models or the optional Puter route.
- Failed Puter responses keep the user's prompt in the conversation instead of silently removing it.
- Chat, Notes and Canvas now show a visible warning when browser storage writes fail, rather than silently implying that changes were saved.
- The Models workspace now has a three-step first-run path: connect a provider, choose the exact Chat model, then test the connection. It explicitly distinguishes a saved key from a verified connection and warns that credentials stay in this browser.
- Research seat cards now say **Not assigned** instead of rendering a blank model label.
- Docs now include a practical guide to choosing the right workspace and clarify that prompts can go through different provider integrations, including Puter.

### Issues that still need implementation or validation
1. **Sign-in review mode is not production authentication.** The frontend gate can be disabled for review, but server-backed routes still require a valid token. Verify the deployed site after merge/redeploy; do not weaken API auth just to make the UI appear open.
2. **History is not yet durable across devices.** Chat and research records still rely on browser storage. A D1 schema/spec is groundwork, not a live API.
3. **Account separation needs end-to-end tests.** Test two users, sign-out, browser refresh, storage migration and account deletion before calling data account-safe.
4. **Interrupted work needs a durable lifecycle.** Save the prompt and partial output; show completed, failed, cancelled or interrupted accurately. Offer resume only if the execution system really supports it.
5. **Provider setup needs a clear first-run path.** Show configured / tested / selected states separately. Never imply that a key is valid just because it exists.
6. **Advanced options need progressive disclosure.** Keep the main path simple and reveal seat-level, search-engine and protocol controls when useful.
7. **Data ownership must be obvious at the point of action.** Say whether something is saved locally, downloaded, or explicitly exported to Drive. Never claim zero retention.
8. **Build needs safety rails.** Explain commit destination, show diffs before writes, and be explicit about the lack of a full sandbox/terminal.
9. **Mobile and accessibility require manual validation.** Test keyboard focus, screen-reader labels, long output, reduced motion, offline/network loss and small screens, not only screenshot appearance.

## Data and Discord decision

Do not use Discord as canonical storage or as a silent archive. A batch-copy pipeline from a real database to Discord does not reduce the correctness burden; it adds a second store that must be reconciled. It also creates retention, deletion, rate-limit and privacy problems.

If we want to test the concept, use synthetic data in an isolated server and measure real throughput and failure recovery. Production should keep the canonical chat/run records in a database behind authenticated API routes. Archive only data that has a concrete retention need, and prefer a storage system designed for archival. Never delete the canonical copy until the archive has been verified and the retention policy allows deletion.

## Product quality gate

A feature is not done because it renders. Before release it needs:
- a clear user problem and a reason it belongs in this workspace;
- real behavior, not decorative/fake status;
- loading, empty, error, cancellation and recovery states;
- explicit data location and ownership;
- tests for the core path and likely failure modes;
- mobile and keyboard checks;
- a short docs entry describing the feature and its limits.

## Recommended sequence

1. Fix and verify review access without weakening server-side authentication.
2. Finish first-run UX: provider setup, no-model state, clear Chat vs Research choice.
3. Implement authenticated, account-scoped chat persistence and real run status APIs.
4. Add interruption-safe checkpoints and honest retry/resume behavior.
5. Improve History search/export and data deletion/ownership controls.
6. Add tests for auth isolation, provider errors, storage failure, streaming cancellation and mobile flows.
7. Only then evaluate extra storage/archive systems and add features.

**Principle:** fewer promises, stronger workflows. Breezy should feel powerful because its tools are dependable and connected—not because it has the most screens.
