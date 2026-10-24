# Breezy Research — backend only

All UI has been removed. What remains is everything non-visual. `src/App.tsx` is an empty placeholder so the
project still builds (`npm run build` and `npx tsc --noEmit` pass, 9/9 tests pass).

## Run
```
npm install --legacy-peer-deps
npm run dev          # Express + Vite on :3000
```
Env: see `.env.example` (optional `GEMINI_API_KEY` on the server; users can also bring their own keys).

## What's here
| Path | Purpose |
|---|---|
| `server.ts` | Express dev/prod server, mounts the API router |
| `src/server-core/` | The actual research engine: `router.ts` (routes + SSE debate pipeline), `providers.ts` (model calls), `search.ts` (web search), `evidence.ts` (claims / sources / contradictions) |
| `workers/index.ts`, `wrangler.jsonc` | Cloudflare deployment of the same router |
| `src/types.ts` | Shared types (`DebateSession`, `DebateStep`, `Attachment`, evidence graph, ...) |
| `src/services/apiClient.ts` | Browser client for the API: `streamDebate`, `chatBreezy`, `getHealth`, Ollama, key verify |
| `src/services/providerConfigService.ts` | Provider keys, per-seat models (architect / skeptic / verifier / arbiter), search engine, research method; stored in localStorage |
| `src/services/effectiveProviderService.ts` | "What can I actually route to right now?" — `getActiveRoutableModel()`, server-Gemini status |
| `src/services/sessionStorage.ts` | Save/load research sessions + active session (`createNewSession`, `loadSessions`, `saveSessions`) |
| `src/services/gitHubService.ts`, `workspaceService.ts` | GitHub repo connect, tree, read/write/commit files |
| `src/services/puterService.ts`, `aiProviderService.ts`, `ollamaService.ts` | Puter chat, provider abstraction, local Ollama |
| `src/services/googleDocsService.ts`, `googleDriveService.ts`, `authService.ts` | Google sign-in, Docs/Drive export |
| `src/services/pdfService.ts` | PDF text extraction for attachments |
| `src/services/userProfileService.ts`, `storageQuotaService.ts` | Profile + storage helpers |
| `src/utils/exportTranscript.ts` | Markdown/PDF export of a session |
| `tests/` | Provider config + router tests |

## API
`GET /api/health` · `POST /api/debate/stream` (SSE) · `POST /api/debate/summarize` · `POST /api/breezy/chat` ·
`POST /api/vault/verify-key` · `/api/ollama/*` · `POST /api/webhook/test`

### Research stream (`/api/debate/stream`)
Request: `{ prompt, protocol, selectedRound, tone, searchEngine, keys, seats, enableSearchGrounding, researchMethod }`. Seat assignments are explicit and validated for the selected mode.

- **Solo** (`selectedRound: 1`): one answer-generation model call; only the Analyst seat is required. This is the lower-usage option.
- **Trio** (`selectedRound: 3`, legacy value `2` accepted): Analyst → Critic → Synthesizer.
- **Deep** (`selectedRound: 4`): Analyst → Critic → Verifier → Synthesizer.

The backend does not silently substitute missing seat assignments. Each stage streams real progress and uses the provider/model assigned to that seat. Source search and bounded page retrieval are separate from model calls. Multi-stage runs also invoke the configured synthesis model for evidence-graph extraction; token usage from reported provider usage events is included in the run total. Provider cancellation is best-effort and depends on provider support.

SSE events: `status`, `notice`, `research_plan`, `search_grounding`, `round_start`, `token`, `round_complete`, `usage`, `heartbeat`, `evidence_graph`, `complete`, `error`. Rounds are 1-indexed; Deep uses rounds 1–4.



## Prompt to paste into AI Studio (first UI pass)
> This project is a finished backend for "Breezy Research" (read `BACKEND_README.md` first). Do not modify anything in
> `server.ts`, `src/server-core/`, `workers/`, or `src/services/`. Build a clean, normal frontend in `src/` that uses those services.
> Screens: Research (question box, depth Solo/Standard/Deep, live streaming of each step's output, final answer, sources and claims),
> Chat, Models/Providers (add keys, assign a model per seat, show "No model assigned" when empty), History, Settings.
> Rules: never show fake data — no invented models, stats, statuses or sample runs; empty states must be honest.
> Mobile-first and responsive. Dark theme. Keep it simple; I will refine the design with follow-up prompts.
