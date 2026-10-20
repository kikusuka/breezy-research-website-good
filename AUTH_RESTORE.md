# Authentication: temporary review access

## Current review behavior

The frontend sign-in gate is **off by default** so reviewers can open the real workspaces without creating an account.

To restore the frontend sign-in gate, set this Vite build variable to the literal string `true`:

```dotenv
VITE_BREEZY_REQUIRE_AUTH=true
```

Unset the variable, or set it to any value other than `true`, to keep review access enabled. Vite variables are embedded at build time, so rebuild and redeploy the frontend after changing the setting.

## Important security boundary

This flag controls the frontend gate only. It does **not** disable authentication on the backend API, and it does not make the backend safe to expose without authorization. Protected API routes continue to require a valid Firebase ID token. As a result, review mode lets a person inspect and navigate the UI, but server-backed chat/research features may still reject unauthenticated API calls. Do not solve that by weakening the production API's token verification.

During review mode, data saved in browser storage is local to that browser profile. It is not cross-device history, and an unscoped browser profile is not a secure multi-user account boundary.

## Before production

- [ ] Set `VITE_BREEZY_REQUIRE_AUTH=true` if sign-in should gate the frontend.
- [ ] Rebuild and redeploy after changing the Vite variable.
- [ ] Verify signed-out visitors see the sign-in gate when enabled.
- [ ] Verify sign-in and sign-out work.
- [ ] Verify account-scoped data is restored before workspaces mount.
- [ ] Verify server routes reject missing, expired, malformed, and wrong-project tokens.
- [ ] Verify two accounts cannot read or mutate one another's data.
- [ ] Verify Google Drive consent remains separate from Breezy account sign-in.
- [ ] Keep production API authorization enabled regardless of frontend mode.
