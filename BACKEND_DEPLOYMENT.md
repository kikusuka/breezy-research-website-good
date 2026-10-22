# Cloudflare Worker backend deployment checklist

This repository's canonical API entry point is `workers/index.ts`; Wrangler uses it from `wrangler.jsonc`. The chat persistence handlers are implemented, but **the repository does not currently have a D1 binding**, so deploying the Worker as-is will still return `CHAT_PERSISTENCE_UNAVAILABLE` for cloud chat history.

## 1. Create or confirm the canonical D1 database

Use the Cloudflare dashboard (Workers & Pages → D1 SQL Database) or run:

```sh
npx wrangler d1 create breezy-chat-prod
```

Keep the returned database ID private to the deployment configuration. Do not commit a fake ID or a placeholder that looks deployable.

## 2. Apply the schema to the remote database

After confirming the database name and account:

```sh
npx wrangler d1 migrations apply breezy-chat-prod --remote
```

Wrangler applies pending migrations in filename order and tracks which ones have run. Check the command output and verify the tables and `conversations.next_sequence` column exist before deploying the Worker. Do not run a local-only migration and assume production is updated.

## 3. Add the real D1 binding

Add the database returned in step 1 to `wrangler.jsonc` using the actual ID:

```jsonc
"d1_databases": [
  {
    "binding": "DB",
    "database_name": "breezy-chat-prod",
    "database_id": "<REAL_DATABASE_ID_FROM_CLOUDFLARE>"
  }
]
```

This is an instruction example, not a valid production config until the placeholder is replaced. The binding name must be exactly `DB`, matching `BackendEnv` and the persistence handler.

## 4. Configure production origin and authentication

- The committed `wrangler.jsonc` currently lists only localhost origins. Before a production deploy, replace that value with the exact production frontend origin(s), comma-separated, including the scheme and any non-default port. Do not rely on a dashboard-only override while the Wrangler config still declares a conflicting value.
- Confirm `FIREBASE_PROJECT_ID` matches the Firebase project used by the deployed website. The Worker verifies Firebase ID tokens server-side.
- Configure only the provider secrets actually needed by the backend using Wrangler secrets. Never commit API keys or ID tokens.
- Confirm the production frontend's Firebase authorized domains and OAuth redirect setup before testing authenticated routes.

## 5. Deploy and verify

First run locally:

```sh
npm ci
npm run typecheck
npm test
npm run build
npx wrangler deploy --dry-run
```

Then, after the real D1 binding has been added to `wrangler.jsonc` and the production origin list has replaced the localhost-only value:

```sh
npx wrangler deploy
```

Verify `GET /api/health` reports `chatPersistenceConfigured: true`. Then sign in through the real frontend and test list/create/rename/delete, message pagination, run creation/checkpoints, and cross-account isolation. A successful health response alone does not prove that authentication, the migration, or owner-scoped queries work.

## Important release boundary

The current Chat UI still uses browser-local history and the existing provider chat endpoint. Do **not** announce cross-device chat history until the UI has been integrated with the persistence routes and a real two-account/two-browser test passes. Existing local history must remain available; cloud history should be an explicit, recoverable migration/sync step rather than a destructive replacement.

## Current blockers to deployment

- A real Cloudflare account/database ID is not available in this repository.
- The remote migration has not been verified as applied.
- The exact production frontend origin has not been confirmed in Worker configuration.
- No live deployment or authenticated production smoke test has been performed from this workflow.
