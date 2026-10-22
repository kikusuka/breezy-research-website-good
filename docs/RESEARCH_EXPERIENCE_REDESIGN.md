# Research Workspace Redesign — Experience and Implementation Scope

Status: proposed implementation plan. This document describes the intended experience; it does not claim the proposed behavior is already implemented.

## 1. Product intent

Replace the current stage-first, debate-shaped Research screen with a question-first investigation workspace. Keep the hybrid direction:

- A clean, readable workspace is the default.
- An interactive evidence map is a secondary view, useful when claims and sources have meaningful relationships.
- Research progress reflects real events and real saved data only.
- Advanced model/depth controls remain available without dominating the first-use experience.
- The workspace explains what Breezy actually did, what it found, and what it could not establish.

This is a Research experience redesign, not a marketing page and not a cosmetic reskin.

## 2. What repository inspection found

Inspected the current default-branch implementation, including `src/components/ResearchWorkspace.tsx`, `src/lib/research.ts`, `src/lib/researchStore.ts` (referenced by the workspace; the exact store path must be verified against the active tree before edits), `src/services/apiClient.ts`, `src/server-core/router.ts`, `src/server-core/evidence.ts`, `src/App.tsx`, `src/index.css`, `PRODUCT_PLAN.md`, and `package.json`.

Observed behavior and constraints:

- The active screen is `ResearchWorkspace`; it currently leads with “Inquiry formulation,” depth controls (Solo/Standard/Deep), method selection, attachment, a stage stepper, final synthesis, claim/source lists, stage outputs, and a run log.
- Research uses the existing `/api/debate/stream` SSE path through `apiClient.streamDebate`. Its event handling, abort signal, backend failover behavior and terminal-event correctness must be preserved or explicitly tested.
- Research history/state is managed by the existing research store and session types. It is stored locally in the current product path; do not imply cross-device sync.
- Existing result actions include copy, Markdown export, pin to Canvas, Google Docs action and rerun. Keep them functional; if any action is currently incomplete, surface that honestly rather than silently removing it.
- Attachments are read by the existing attachment service and passed into a run. Preserve this path.
- Model/depth/method configuration comes from existing model/provider services. Do not introduce a second configuration source.
- The current evidence graph is model-assisted. Its code checks whether cited URLs/snippets match discovered search results; that does **not** prove the cited page supports a claim. The current pipeline largely relies on search-result snippets rather than systematically fetching full source pages.
- Current stage outputs and event log expose implementation machinery. The redesign should make these available as an optional “Activity” detail view rather than the primary narrative.
- Existing global styles use a dark navy/cyan base. The redesign should use Breezy's dark-neutral surfaces with restrained cyan/blue accents and clearer surface contrast, not add another unrelated visual system.

The repository also has a research-query retrieval PR (#45) that was open at inspection time. Do not assume it is merged or rely on its code without checking current status before implementation.

## 3. Proposed information architecture

### A. Start / empty state

Primary hierarchy:
1. Heading: **Research** with a concise explanation of what the workspace does.
2. Large question composer with attachment affordance.
3. A compact depth selector: Quick / Research / Deep (labels may map to existing Solo / Standard / Deep internally; do not silently change backend semantics).
4. Advanced controls collapsed by default: provider/model routing, method, search configuration, and other existing options.
5. Optional recent investigations sourced from real local history only. If there is no history, show an honest empty state rather than sample projects.

Suggested starter prompts may use the existing `RESEARCH_STARTERS` constant. Label them as prompts, not as completed research or user data.

### B. Active investigation workspace

Desktop layout:
- Header row: investigation title/question, real run state, elapsed time only while meaningful, stop/resume actions where supported.
- Main column: readable findings / streamed output, then source-backed findings as data becomes available.
- Secondary panel: sources and investigation activity, switchable without losing context.
- A view switch: **Findings | Evidence map | Activity**. Do not show the evidence map as populated until real graph data exists.
- Keep the current shell/sidebar unchanged in this phase.

Mobile layout:
- Single-column flow; question and current state first.
- Findings, sources, map and activity become tabs/drawers or stacked sections; no forced desktop split panel or horizontal page overflow.
- Stop, navigation, citation opening and source details must remain reachable at narrow widths.

### C. Completed investigation

- Show the final answer first, with readable Markdown and meaningful headings.
- Provide explicit source count only from actual retrieved/discovered source records, and distinguish discovered links from pages actually fetched/read.
- Show a small set of high-value findings and source links.
- Show evidence statuses only with accurate labels and provenance. Until source-passage support is validated, use cautious language such as “model-assessed” or “needs review”; do not claim “verified” based only on URL matching.
- Keep Copy, Export, Pin to Canvas, Google Docs and Run again actions if each remains wired to its existing real implementation.
- Make stage-by-stage model output available under Activity / Advanced details, not the default content hierarchy.

### D. Evidence map

The map is a view of actual evidence records, not a decorative graph. Initial node types:
- Question
- Claim / finding
- Source
- Passage (only once passage-level retrieval exists)
- Contradiction / unresolved question (only when represented by actual data)

Interactions:
- Selecting a claim highlights its linked source nodes and reveals its text/status and the evidence currently attached.
- Selecting a source opens its URL in a new tab and shows the locally stored title/snippet/metadata when available.
- Selecting an unresolved question offers a targeted follow-up investigation only if the backend can actually execute it.
- Provide a list/table fallback for keyboard and screen-reader users.
- Never infer relationships from layout or invent nodes to make the map look complete.
- Empty/unsupported graph state explains that no structured evidence is available for this run and offers Findings / Activity instead.

The first implementation may use a simple responsive SVG or CSS relationship view with no new dependency. Do not add a graph library until the data model and interaction tests justify it.

## 4. Interaction and state requirements

Represent at least these distinct states honestly:
- No model configured
- Ready / empty
- Running
- Stopping / cancelled (if the store can distinguish it)
- Completed
- Completed with warnings / incomplete retrieval
- Failed
- Restored historical run (not currently running)

Rules:
- Running indicators derive from the real store/SSE state.
- Stage progress derives from actual events and configured depth. A skipped stage must not look completed.
- Do not display fabricated percentages, token counts, live source counts, confidence scores, or progress milestones.
- A stream ending without its terminal event must not be reported as a successful completion.
- Stop must cancel the active request and keep the resulting state truthful.
- Navigating away and returning must not create duplicate runs or discard persisted history.
- Failed source fetches, missing evidence and disconnected providers must be visible in plain language.

## 5. Functionality to preserve

Before implementation, map and regression-test these existing paths:
- `/api/debate/stream` request shape and SSE events
- Depth/protocol mapping and selected model/provider routing
- Search-engine and research-method settings
- File attachments and their supported formats
- Start, streaming updates, cancellation, errors and terminal completion
- Research history persistence, account switching and save-category preferences
- Copy, Markdown export, Canvas pin, Google Docs action and rerun
- Existing research metrics and evidence graph data (with honest labels)
- Responsive shell, navigation, accessibility and reduced-motion support

Do not rewrite the backend pipeline, provider configuration, authentication, storage schema or global app shell as part of the initial UI redesign. Any necessary backend work should be a separate, focused PR with tests.

## 6. Implementation sequence

### Phase 0 — baseline and plan (this PR)
- Record the design, state model, functionality-preservation requirements and acceptance criteria.
- Confirm current open research PRs and the authoritative files before implementation.
- No behavior changes in this phase.

### Phase 1 — workspace shell and composer
- Refactor the Research screen into explicit Start / Active / Completed views while retaining existing store and API contract.
- Introduce a small set of focused components; keep the existing shell and sidebar.
- Keep advanced controls available and preserve attachments, depth and method selection.
- Add tests for state-to-view mapping and basic interactions.

### Phase 2 — findings and source panel
- Recompose the existing final output, sources, claims, activity and actions into the new hierarchy.
- Do not invent passage-level evidence. Label the current model-assisted evidence accurately.
- Add tests for empty sources, absent graph, errors, warnings, and completed output.

### Phase 3 — interactive evidence map
- Implement only from normalized real evidence-graph records.
- Add accessible list fallback and selected-node details.
- Test graph relationships, missing/duplicate URLs, empty graph, and keyboard interaction.
- Keep map optional and avoid a new runtime dependency unless justified.

### Phase 4 — quality and polish
- Verify desktop and narrow/mobile widths, keyboard/focus, reduced motion, long questions, large outputs and long source titles.
- Run typecheck, tests and production build; report exactly which checks passed.
- Do not deploy or merge without explicit user approval.

## 7. Acceptance criteria

The redesign is ready for review when:

1. The first-use screen has one clear primary action and does not lead with agent roles.
2. A user can start a real run using the existing backend and configured provider.
3. Streaming, stop/cancel, errors, history, account isolation and save preferences remain intact.
4. Attachments and all existing result actions remain functional.
5. Findings are the default completed view; activity details remain accessible.
6. The evidence map contains only data returned by the run and never implies that URL matching proves claim support.
7. No placeholder metrics, fake sources, demo history, fabricated live states or fake confidence are introduced.
8. No horizontal overflow at mobile widths; keyboard navigation and a non-graph evidence view are supported.
9. Tests, typecheck and build are run and their actual results recorded.
10. The PR is focused and reviewable, with no merge or deployment performed by the assistant.

## 8. Out of scope for this redesign

- Replacing the research backend or provider architecture
- Adding multi-agent roles or changing their semantics
- Claim-level verification engine or safe full-page retrieval (separate research-engine work)
- Cross-device research sync or research database migration
- New graph/visualization dependencies without demonstrated need
- Changes to app-wide navigation, authentication, billing, deployment or other workspaces

These may be future projects, but should not be bundled into a UI redesign unless a concrete dependency makes it necessary.
