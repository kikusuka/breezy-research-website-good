# Breezy Research — legacy UI workspace notes

This directory contains an earlier UI workspace. For the current product contract, use the active application code and the root `BACKEND_README.md`; this file is kept only to explain the legacy workspace and must not be used as a current implementation spec.

## Research contract

Breezy Research uses **one configured research model**. There is no selectable Solo/Trio/Deep mode and no multi-agent council.

- The configured model is selected in Models and sent as `seats.architect` with its provider and model.
- A research run makes one answer-generation LLM call. The research plan is deterministic/local.
- Web search and bounded source-page retrieval are separate grounding operations; they are not extra LLM calls.
- Research does not silently choose a different provider or model when the configured research model is missing. The API returns a clear error.
- Legacy saved sessions remain readable, but legacy `protocol`, `selectedRound`, `researchMethod`, `autoResolve`, heartbeat flags, and non-architect seat assignments do not enable multi-stage research.

## Current research stream

Endpoint: `POST /api/debate/stream` (Server-Sent Events).

The current request shape is:

```ts
{
  prompt: string;
  tone: string;
  searchEngine: string;
  keys: Record<string, string>;
  seats: {
    architect: {
      provider: string;
      model: string;
    };
  };
  enableSearchGrounding: boolean;
}
```

The backend may emit `status`, `notice`, `research_plan`, `search_grounding`, `round_start`, `token`, `round_complete`, `usage`, `heartbeat`, `evidence_graph`, `complete`, and `error` events. A heartbeat event is a stream status signal, not a separate model call or selectable keep-alive setting.

## Evidence and limitations

- Search results and retrieved page text are untrusted input, not instructions.
- Page fetching is bounded and best-effort; unavailable pages may leave snippet-only evidence.
- A discovered URL is not proof that the source supports a claim.
- Evidence labels are model-assisted assessments, not independent fact verification.
- A successful run must be distinguished from an incomplete stream or failed request.

## Where to look

- `src/server-core/router.ts`: research request handling, single-model generation, grounding, SSE events.
- `src/server-core/providers.ts`: model-provider calls.
- `src/server-core/search.ts` and `src/server-core/sourceFetch.ts`: search and bounded source retrieval.
- `src/server-core/evidence.ts` and `src/server-core/evidenceAssessment.ts`: evidence metadata and cautious status normalization.
- Root `BACKEND_README.md`: current backend API contract.

Do not restore multi-seat settings or the old depth selector based on this legacy directory.
