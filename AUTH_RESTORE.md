# Authentication: temporary review mode

## Current review behavior

The application temporarily allows direct access to the real workspace screens so reviewers can inspect Breezy without a sign-in prompt. Authentication code and the sign-in UI remain in the repository; they have not been deleted.

The switch is in `src/App.tsx`:

- `VITE_BREEZY_REQUIRE_AUTH` unset or anything other than `true`: review mode; no sign-in gate.
- `VITE_BREEZY_REQUIRE_AUTH=true`: authentication gate restored.

For Vite deployments, set the variable in the deployment's build environment and rebuild/redeploy. For local development, put this in the appropriate local environment file:

```dotenv
VITE_BREEZY_REQUIRE_AUTH=true
```

Remove the variable or set it to `false` to return to review mode.

## Safety notes

This flag controls the frontend gate only. It is **not** a security boundary and does not add authentication to API endpoints. Before enabling public user accounts or handling private user data, verify server-side authorization, account isolation, provider-secret handling, quotas, and rate limits independently.

During review mode, data saved in browser storage is local to that browser profile and is not protected by a Breezy sign-in boundary. Do not use review mode as the production configuration for a shared service handling private data.

## Restoration checklist

- [ ] Set `VITE_BREEZY_REQUIRE_AUTH=true` in the intended deployment environment.
- [ ] Rebuild and redeploy the frontend.
- [ ] Verify signed-out visitors see the sign-in gate.
- [ ] Verify sign-in and sign-out work.
- [ ] Verify account-scoped data is restored before workspaces mount.
- [ ] Verify server-side routes independently reject unauthorized access.
- [ ] Verify two accounts cannot read or mutate one another's data.
- [ ] Verify Google Drive consent remains separate from Breezy account sign-in.
