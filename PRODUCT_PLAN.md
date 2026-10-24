# Breezy — Original Product Plan

**Status:** Product direction and engineering acceptance criteria  
**Purpose:** Preserve the intended product before further UI or feature work. This document is the product source of truth for planning and review; it does not claim that every described capability is already implemented.

## 1. Product vision

Breezy is a coherent AI workspace for people who want to research, think, build, and create with AI without being locked into one model or one rigid workflow.

The ambition is a customisable, practical environment — “Linux for LLMs” and “Codex for online people who want unlimited customisability” — while remaining understandable to ordinary users. The interface should feel deliberately engineered and human, not like a generic AI-generated dashboard.

Breezy is the product and user-facing identity. **Synthexis is the research engine underneath Breezy**, not a separate public product or a visible mode switcher. Names, logos, model labels, and navigation must be consistent.

The app should be useful to real testers, not presented as a casual mock-up. Free-to-use is a product goal; provider and infrastructure limits must be stated honestly rather than hidden.

## 2. Product principles

1. **Every screen earns its place.** Each screen must have a clear purpose, primary action, expected result, meaningful states, and explicit boundaries. If it has no useful job, simplify or remove it.
2. **Truth over theatre.** No fabricated models, model versions, provider connections, live indicators, token counts, alignment scores, node counts, citations, verification claims, progress, or success messages.
3. **No silent provider fallback.** If a selected provider or model fails or is disconnected, explain the actual problem. Never silently route a Groq request to Gemini or imply a model is available when it is not.
4. **The interface is not the backend.** A visual control must have real behavior. If functionality is not wired up, mark it as unavailable or omit it; do not make it look complete.
5. **Preserve working capabilities.** Before changing a screen, identify the code paths and services it depends on. UI work must not quietly remove authentication, persistence, research execution, model calls, or other working backend behavior.
6. **Customisation without confusion.** Offer sensible defaults and progressively reveal advanced controls for providers, models, prompts, and workflows.
7. **One Breezy experience.** Use a consistent navigation model, design language, terminology, and project context across the app.
8. **User control and privacy.** Users should understand what context is available to a task and choose what to attach or exclude. Never imply stronger privacy or retention guarantees than the implementation can prove.
9. **No placeholder product.** No seeded demo records presented as the user's real work, dead-end buttons, fake charts, or sample data masquerading as live data. Clearly label any deliberate sample/demo.
10. **Responsive, accessible, and calm.** Desktop is the first design target, but mobile must remain usable. Avoid cramped layouts, overflow, decorative noise, and generic AI-dashboard styling.

## 3. Information architecture

The app should share one shell and a clear navigation hierarchy. The exact labels can evolve, but each area must have a distinct responsibility.

### Chat

The everyday conversational workspace. It should be the default destination when a signed-in user opens the app, and clicking Breezy in the app sidebar should return to Chat rather than a marketing landing page.

Expected basics include conversation history, readable/selectable responses, copy, regenerate, stop/cancel where supported, and clear model/provider status. Controls should reflect actual capabilities.

### Research

The evidence-oriented workflow powered by Synthexis. The production sequence is:

**Question → Search → Retrieve → Analyze → Answer**

Research should make the process and evidence inspectable without overwhelming the user. Research offers three explicit budgets: **Solo** uses one answer-generation call; **Trio** runs Analyst, Critic and Synthesizer; **Deep** adds a Verifier before synthesis. Each stage uses its configured seat model; missing assignments are surfaced rather than silently substituted. Search and bounded source-page retrieval are separate from model calls, and retrieved evidence is not treated as proof by itself.

Show progress only from real execution events. Surface sources and citations honestly; distinguish retrieval from verification. A run should remain coherent if the user navigates elsewhere, and stopped or failed runs should be represented truthfully.

### Build

A code/build workspace for working on projects and repositories. The interface should make the relationship between editor, files, console, preview, and agent actions clear. Repository edits, commits, execution, and preview must report actual results and permissions. Do not imply that a repository is connected or writable unless it is.

### Create

A creative workspace for image generation and related outputs. Generation must be connected to a real supported provider/tool. If no image-generation provider is available, explain that state instead of showing a fake result or a button that cannot work. Generated assets should be clearly associated with the relevant conversation or project when the user chooses.

### Projects and connected knowledge

Projects are the organizing layer across Breezy. A project may group:

- chats and conversation history;
- repositories and code/build work;
- research runs, papers, sources, and notes;
- generated images and other files;
- explicitly connected knowledge or documents.

A project is not permission for every task to read everything in it. Users must be able to decide which files, repositories, conversations, or sources a specific task can use. Show what is attached or in scope, make adding/removing context understandable, and respect access boundaries.

### History

A reliable record of the user's actual prior work. It must not be populated with fake sample entries. Distinguish saved conversations, research runs, and other artifacts when useful, and allow users to return to the relevant item.

### Docs

In-product documentation should explain how to use Breezy and Synthexis, configure providers/models, choose research modes, manage projects/context, and understand limitations. Documentation should match shipped behavior and be updated as features change.

### Models and Settings

A single understandable place for model/provider setup and app preferences. Advanced configuration should be available without making disconnected providers look ready to use. Keep profile/account controls understandable and separate from model configuration where that improves clarity.

## 4. Model and provider strategy

Breezy should support both a low-friction onboarding path and user-controlled provider configuration.

- **Puter.js:** Intended as a default/onboarding route where supported, subject to real runtime availability and the provider's current model catalogue. Puter is infrastructure, not the Breezy brand.
- **BYOK:** Users may configure their own provider credentials and model IDs. Preserve this as a first-class advanced option.
- **Custom models:** Permit custom model identifiers so stale built-in catalogues do not block supported newer models. Validate and explain configuration errors.
- **Future local providers:** Ollama or similar integrations can be considered when they can be implemented and tested honestly.
- **Future Breezy model:** Breezy may eventually offer its own model, but that is a separate research/training effort and must not be simulated by relabeling another provider.

Model status must distinguish at least: available, connected/configured, unavailable, and requires credentials. The exact states should match real checks. If no provider is configured, say so plainly. Never invent model names or versions, including a model that looks plausible but is not actually present.

Use a shared, type-safe provider/model routing layer so Chat and Research apply consistent configuration and error handling. Do not create separate inconsistent provider logic in each screen. Provider failures should explain the actionable cause when known and must not trigger a silent switch to another provider.

## 5. Research quality and evidence

- Search/retrieval should be a real service, not decorative UI.
- Distinguish discovered sources, retrieved passages, and independently verified claims.
- Display citations only when they refer to actual source material.
- Any confidence, agreement, score, or verification badge must have a defined calculation and a real data source. Otherwise omit it.
- Make execution stages and errors visible in plain language.
- Keep model configuration, selected research depth, and actual backend execution in agreement.
- Preserve streaming, cancellation, persistence, and error handling when updating the UI.
- A “heartbeat” or reminder is useful only if its schedule and action are real and user-controlled.

## 6. Privacy, identity, and data boundaries

Authentication and account isolation are product behavior, not merely visual screens.

- Keep one user's private data isolated from another user's data at the server/API boundary.
- A UI check alone is not authorization.
- Be precise about what is stored, where it is stored, and what deletion does.
- Do not claim “zero retention,” “zero tracking,” or complete deletion unless the actual architecture and providers support that statement.
- Before a future Breezy model is trained using user-provided data, obtain explicit, informed consent. Explain what data would be used, for what purpose, and what the user can opt out of. Do not assume that using Breezy means consenting to training.
- Provide understandable account, profile, and data-erasure paths, backed by real server-side behavior.
- Guest/demo mode, if present, must be clearly distinguished from a persistent authenticated account.

## 7. Design direction

The UI should take inspiration from the project's own Breezy Labs site and the approved Stitch UI work, but the product's actual functionality remains the authority.

- Dark-neutral surfaces with restrained blue/cyan accents; avoid a generic all-navy AI dashboard.
- Strong typography, deliberate spacing, clear hierarchy, subtle borders, and meaningful states.
- Use the approved Breezy mark consistently; do not substitute temporary logos or inconsistent Synthexis branding.
- Keep the shell coherent across screens. Do not layer new styling over an incompatible layout and call it a redesign.
- Make the primary action obvious, keep advanced settings discoverable, and use motion only when it communicates state or supports a task.
- Clearly label screenshots, seeded previews, or demo examples as samples.
- Landing/marketing and the working app have different jobs. Breezy Labs can own the public project/marketing presentation; inside the app, the signed-in user should arrive at Chat.
- Review screens against the actual Stitch reference, not merely against token/color similarity. A visually similar palette does not establish layout fidelity.

## 8. Engineering and change-management rules

1. **Keep the repositories' roles distinct.** This repository is the current product candidate. The former Research Main 1 repository is a functionality reference; the Stitch UI repository is a design reference. Neither should be copied wholesale without review.
2. **Work in a separate branch.** Do not make broad, unreviewed changes directly on main.
3. **Inspect before changing.** Map screens to components, services, API routes, state, persistence, and tests. Identify the authoritative source tree before deleting duplicated structures.
4. **Small, reviewable changes.** Group changes by purpose; do not combine an unrelated redesign, provider rewrite, and data-model migration in one change.
5. **Verify the real behavior.** Run type checks, tests, and production build. Exercise important routes and error states. CI passing proves only the checks it actually runs.
6. **Integration claims need integration tests.** Google sign-in, model calls, repository commits, image generation, browser execution, and other external flows are not verified merely because the UI renders or a mock passes.
7. **No secrets in the client or repository.** Keep credentials out of committed code and logs; enforce sensitive operations on the server.
8. **Do not remove functionality just to make the design easier.** If a capability is broken or incomplete, document it and repair it deliberately.
9. **Do not claim completion without evidence.** Record what was tested, what was mocked, and what remains unverified.

## 9. Definition of done for any screen

Before calling a screen ready, answer:

- What user problem does it solve?
- What is its primary action, and what result should follow?
- What are its loading, empty, success, error, disconnected, and permission-denied states where applicable?
- Does every visible control do what its label promises?
- Is all displayed data real, user-owned, and current—or explicitly labelled as sample?
- Which services, API routes, and persisted data does it depend on?
- What can this screen access, and what must remain out of scope?
- Does it work at desktop and mobile widths and with keyboard/accessibility basics?
- Which automated and manual checks were actually run?

## 10. Delivery order

Use this order to reduce regressions and avoid building on an unclear foundation.

1. **Establish the baseline:** inventory the current source tree, backend/API paths, state stores, tests, auth, providers, and deployment assumptions. Resolve duplicate or ambiguous source directories only after proving which copy is authoritative.
2. **Create a functionality map:** compare the current candidate against the known-good Research Main 1 behavior. Mark each capability as working, partially working, missing, or unverified, with file/service evidence.
3. **Stabilize the app shell:** consistent branding and navigation, Chat as the signed-in default, reliable mobile behavior, no accidental return to a marketing landing page.
4. **Make core paths honest and dependable:** provider configuration and errors, Chat streaming/cancel/history, Research execution/evidence/persistence, account isolation.
5. **Complete the workspace model:** Projects and explicit context selection across conversations, code, research, files, and generated assets.
6. **Review screen-by-screen design fidelity:** use Stitch as a visual reference while retaining real functionality and purposeful information hierarchy.
7. **Wire and verify integrations:** test real sign-in, model calls, research retrieval, repository actions, image generation, and other integrations individually. Clearly label anything not available in the test environment.
8. **Finish documentation and release checks:** docs must describe current behavior; run CI, build, responsive smoke tests, and integration checks before promoting changes.

## 11. Explicit non-goals and guardrails

- Do not treat a visual prototype as a finished product.
- Do not replace working backend code with mock services to simplify the UI.
- Do not make Breezy and Synthexis appear to be competing public products.
- Do not expose every advanced option to beginners by default, but do not remove customisation.
- Do not promise unlimited usage, permanent free infrastructure, or provider capabilities that Breezy cannot control.
- Do not train on user data without explicit consent.
- Do not add a screen, metric, badge, or workflow unless it helps a real user complete a real task.

## 12. How to use this plan

Use this document during repository audits, UI reviews, implementation planning, pull-request reviews, and release decisions. When a proposed implementation conflicts with the plan, either correct the implementation or explicitly record and justify a product decision to change the plan. Do not silently drift away from it.

**Important:** This is the intended product direction, not a claim that all items above are currently implemented. Track implementation status separately with evidence.
