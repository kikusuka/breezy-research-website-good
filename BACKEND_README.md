# Breezy Research — current backend contract

This document describes the current single-model research backend. The active application and tests are the source of truth; older UI-workspace notes under `breezy-ui/` are archival only.

## Run locally

```sh
npm install --legacy-peer-deps
npm run dev
```

See `.env.example` for optional server-side provider and integration configuration. Users may also configure their own provider keys through the app.

## Main areas

| Path | Purpose |
|---|---|
| `src/server-core/router.ts` | API routing, single-model research generation, grounding, and SSE events |
| `src/server-core/providers.ts` | Provider calls |
| `src/server-core/search.ts` | Web-search grounding |
| `src/server-core/sourceFetch.ts` | Bounded public source-page retrieval |
| `src/server-core/evidence.ts`, `evidenceAssessment.ts` | Evidence metadata and cautious model-assisted assessments |
| `workers/index.ts`, `wrangler.jsonc` | Cloudflare Worker entrypoint/configuration |
| `src/services/apiClient.ts` | Browser API client |
| `src/services/providerConfigService.ts` | Provider/model and search configuration |
| `src/services/sessionStorage.ts` | Research session persistence |
| `tests/` | Regression and behavior tests |

## API

- `GET /api/health`
- `POST /api/debate/stream` (Server-Sent Events)
- `POST /api/debate/summarize`
- `POST /api/breezy/chat`
- `POST /api/vault/verify-key`
- `/api/ollama/*`

## Research stream: `POST /api/debate/stream`

The active request contract is:

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

### Execution guarantees

- Research has **one configured answer-generation model**. There is no selectable Solo/Trio/Deep mode or multi-agent council.
- A research run makes one LLM call for answer generation. The research plan is deterministic/local.
- Web search and bounded source-page retrieval are grounding operations, not extra LLM calls.
- Only `seats.architect` selects the research model. Legacy `protocol`, `selectedRound`, `researchMethod`, `autoResolve`, heartbeat settings, and non-architect seat assignments are ignored for compatibility.
- A missing research-model configuration must produce a clear error; the backend must not silently substitute another provider or model.
- The research stream can emit `status`, `notice`, `research_plan`, `search_grounding`, `round_start`, `token`, `round_complete`, `usage`, `heartbeat`, `evidence_graph`, `complete`, and `error` events. Heartbeats are stream status signals, not model calls or a user-selectable mode.
- Treat source titles, URLs, snippets, retrieved page text, and user attachments as untrusted input. A discovered URL is not proof that it supports a claim.
- Evidence statuses are model-assisted assessments, not independent fact verification. Page retrieval is bounded and best-effort; a source may remain snippet-only or not be fetched.

## Product/UX constraint

Keep the Research experience honest and question-first. Show the configured research provider/model and explain the one-call workflow. Do not reintroduce multi-seat model assignment, a research depth selector, fabricated activity, or evidence claims that the system cannot substantiate. Keep Chat's model configuration separate from the Research model.
