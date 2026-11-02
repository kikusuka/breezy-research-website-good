# Phase 2 changes

## Public site
- `/` landing page, `/privacy`, 404. The workspace lives at `/app` (hash routes: `/app#research`). It loads as a separate chunk, so public pages stay light.
- Cloudflare Pages serves `index.html` for unknown paths when there is no `404.html`, which is what `/app` and `/privacy` rely on. Confirm after the first deploy.
- PWA `start_url` is now `/app`.
- `PrivacyPage.tsx` describes what this version of the code does. Have it reviewed before public launch and add contact details.

## Sign-in
- Sign-in is **required by default**. For local work without Firebase set `VITE_BREEZY_REQUIRE_AUTH=false` in `.env.local`.
- The blurred guest preview is gone; signed-out visitors see a full-page sign-in (`AuthView` without `onClose`).
- Email/password signup sends a verification email; a banner with "Resend" shows until verified. This is not enforced on the server yet.
- Discord login removed (Firebase OIDC providers need Identity Platform, which needs billing).

### Before launch checklist
1. Firebase console → Authentication → enable Google and Email/Password.
2. Authentication → Settings → Authorized domains: add your Pages domain and custom domain.
3. Google Cloud console → Credentials: restrict the web API key to your domains.

## Storage quota (server)
- `migrations/0003_storage_quota.sql` adds a per-account byte counter (apply with `wrangler d1 migrations apply`). It backfills from existing rows.
- Default cap is 5 MB of message text per account; override with the `STORAGE_LIMIT_BYTES` variable.
- A new message over the cap gets `413 STORAGE_QUOTA_EXCEEDED`. A reply already in progress is still saved.
- `GET /api/chat/storage` (usage), `GET /api/chat/storage/conversations` (largest first), `DELETE /api/chat/conversations/:id` (now a hard delete that frees the bytes).
- Settings → Server storage shows the meter, a near-full and a full state, and a delete list. "Use my own storage" links to Account, where Google Drive is connected.

## Known gaps
- **The app does not yet sync chats to the server**, so usage reads 0 until client sync is built (phase 2b).
- The counter counts message text only; run records (`chat_runs.partial_output`) also take D1 space.
- Landing has no product screenshots yet.
- Server does not yet require a verified email for expensive endpoints.
