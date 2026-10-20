# Authentication: temporary review mode

## Safe default

Authentication is **required by default**. The existing sign-in implementation remains in place.

For a **private, temporary review deployment only**, set this Vite build variable to the literal string `false`:

```dotenv
VITE_BREEZY_REQUIRE_AUTH=false
```

Unset the variable, or set it to any value other than `false`, to restore the sign-in gate. Rebuild and redeploy after changing the build environment. Do not use the bypass on a public deployment that handles private user data.

## Safety notes

This flag controls the frontend gate only. It is **not** a security boundary and does not add authentication to API endpoints. Before enabling public user accounts or handling private data, verify server-side authorization, account isolation, provider-secret handling, quotas, and rate limits independently.

During review mode, data saved in browser storage is local to that browser profile and is not protected by a Breezy sign-in boundary. Review mode does not provide cross-device history or secure multi-user storage.

## Restoration checklist

- [ ] Unset `VITE_BREEZY_REQUIRE_AUTH` or set it to a value other than `false`.
- [ ] Rebuild and redeploy the frontend.
- [ ] Verify signed-out visitors see the sign-in gate.
- [ ] Verify sign-in and sign-out work.
- [ ] Verify account-scoped data is restored before workspaces mount.
- [ ] Verify server-side routes independently reject unauthorized access.
- [ ] Verify two accounts cannot read or mutate one another's data.
- [ ] Verify Google Drive consent remains separate from Breezy account sign-in.
