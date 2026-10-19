# Breezy — Stitch UI build

The AI Studio app (backend + services untouched) with the frontend rebuilt to the Google Stitch design system:
deep slate surfaces, restrained cyan, emerald for verified states, Plus Jakarta Sans / Inter / JetBrains Mono,
Material Symbols, tonal surfaces with hairlines, soft blue "splatter" washes.

## Run
    npm install        # .npmrc sets legacy-peer-deps
    npm run dev        # http://localhost:3000
    npm run build && npx vitest run

## Structure
- `tailwind.config.js` — Stitch tokens extracted verbatim from the Stitch export (Tailwind 3.4).
- `src/index.css` — base, icon font box, `.splatter`, `.coat`, `.hairline`, `.glow-primary`.
- `src/shell/Shell.tsx` — sidebar (≥1024px), header, mobile top bar, bottom nav + "More" sheet.
- `src/lib/researchStore.ts` — module-level research store: a run keeps streaming while you visit other screens.
- `src/components/*` — one file per screen. Services in `src/services`, API in `src/server-core` are unchanged.

## What was fixed beyond styling
- Research: 6-stage tracker driven only by real stream events; Deep sends `selectedRound: 4`; run survives navigation; failed/stopped runs are saved.
- Chat: text is selectable, Stop really cancels the request, per-message Copy, Regenerate.
- Models: removed an "Enable Ollama" checkbox that saved nothing; per-seat "Custom model ID" so stale catalogs don't block newer models; corrected Verifier copy (no DOI/arXiv claims).
- Build: Console/Preview/Agent were unreachable between 768 and 1279px — now a toggleable bottom panel (right column from 1536px); breakpoints shifted for the new sidebar; removed a hard-coded default repository; console text is selectable.
- Removed fake content: seeded Canvas cards, seeded Notes note, "Zero Cloud Retention", "zero tracking", DOI/arXiv verification claims, fake "LIVE" status (status now reflects a real health check).
- Landing rebuilt to the Stitch composition with only claims the app can back up; the demo window is labelled SAMPLE.

## Known gaps
- Stitch's hero/photo images are Google-hosted and not bundled; the brand mark is the existing local SVG.
- Landing, Research, Chat, Models, Docs, Settings, Profile, History, Notes use the Stitch language directly. Canvas and Build keep their AI Studio layouts, re-coloured with Stitch tokens (no structural redesign yet).
- Not testable offline here: Pyodide download, GitHub commits, Google sign-in, real model calls (verified with a mocked stream instead).
