# Phase 2b + Canvas

## Chat threads and server sync
- Chat now has multiple conversations (`src/services/chatStore.ts`). The old single history moves into a thread automatically on first load.
- Switcher and sync status at the top of Chat. "Delete" removes the thread here and on the server.
- `src/services/chatSyncService.ts` sends finished turns to `POST /api/chat/sync`: one request per turn (debounced 1.5 s), never per token. Only changed messages are sent; the server upserts by message id, so retries are safe.
- Server (`chatPersistence.ts`): quota-checked (413 `STORAGE_QUOTA_EXCEEDED`), owner-checked, idempotent. On a conflict the client retries once with `replace: true` (this device wins).
- Chats saved from another device are restored on load (only threads missing locally are fetched).
- When the quota is full the Chat header says so and links to Settings → Server storage.

## Canvas panel
- Models can write documents and code into a side panel: `<breezy-canvas id title kind lang>…</breezy-canvas>`.
- Hack to know about: a short formatting note is appended to the LAST USER MESSAGE in the request (not stored or shown), because the existing providers have no common system-prompt path. Toggle "Canvas for documents and code" in the thread menu.
- Fallback for models that ignore the format: "Open in Canvas" on any long reply.
- Panel: edit, preview (Markdown or sandboxed HTML), version history with restore, copy, download. Full-screen sheet on phones.
- Canvas documents are stored on this device only (not synced to the server yet).
- The old "Canvas" page is now "Board" (research pinboard). Route id is still `canvas`.

## Known gaps
- HTML preview runs with `sandbox="allow-scripts"` and no same-origin access; scripts inside can still make network requests.
- Running code (Python/JS) is not in Canvas yet; that arrives with the Build sandbox.
- No "Open in Canvas" button on individual fenced code blocks yet (whole replies only).
- Not tested against live providers: the tag format depends on each model following the note.

## Build sandbox update
- Python now runs in a Web Worker (`src/services/sandboxRunner.ts`) instead of the main thread: Stop button, 30 s run timeout, .py files you have open can be imported.
- Canvas code documents in Python or JavaScript get a Run button and an output pane, using the same engine as Build.
- NOT verified end to end: the sandbox I work in cannot reach the Pyodide CDN, so loading and running real Python was not tested here. Helpers and types are tested; the worker itself needs a run in a real browser.
- Build still commits straight to the repo's default branch when you save. A "save to new branch / open PR" option is a good change before launch.
