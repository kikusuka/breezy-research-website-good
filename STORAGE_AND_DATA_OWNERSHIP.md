# Storage and data ownership

## Decision

Breezy should be **local-first and user-owned by default**. Do not make Breezy's own server the default repository for every user's chats, research transcripts, notes, and files.

Offer Google Drive as an explicit opt-in for people who want their work to follow them across devices. A user who does not connect Drive can still use browser-local storage, with a clear explanation that browser-local data is not a backup.

## Where data lives

| Data | Default location | Optional sync |
|---|---|---|
| Chat history and drafts | Browser IndexedDB / local storage | User's Google Drive |
| Research sessions and evidence records | Browser IndexedDB / local storage | User's Google Drive or a user-owned Google Doc export |
| Notes and workspace metadata | Browser storage | User's Google Drive |
| User-uploaded documents | Browser until the user chooses a destination | User's Drive |
| Provider configuration | Browser storage; secrets should be treated as sensitive | Prefer not to sync API keys |
| Breezy operational data | Minimal server-side records only when needed | Not applicable |
| Authentication identity | Identity provider | Not a substitute for workspace storage |

## Google Drive flow

1. Breezy works without Drive connected.
2. The user chooses **Connect Google Drive** only when they want cloud storage or cross-device sync.
3. Explain the requested permissions and what Breezy will create before consent.
4. Store user documents in a clearly named Breezy folder in the user's Drive.
5. Store only the minimal sync metadata required by Breezy. Do not upload user content silently.
6. Provide sync status, last successful sync, retry/error states, disconnect, and export/delete guidance.
7. Handle token expiry and revoked access honestly; never pretend a save succeeded.
8. Do not request broad Drive access if a narrower scope supports the feature.

Google Drive is still subject to the user's own account quotas, policies, and available space. Breezy should not promise unlimited storage.

## What happens without Drive?

Data remains in that browser profile on that device. It can be lost if the user clears site data, uses a different browser/device, or the browser evicts data. Show a visible local-only status and offer export/backup options. Do not describe IndexedDB or localStorage as unlimited or as a durable cloud backup.

## Why not store everything on Breezy servers?

Server-side file storage grows with total user data, creates ongoing storage/egress/backup costs, and makes Breezy responsible for retention, deletion, access control, and incident response. For a free product with limited infrastructure budget, this should not be the default.

If a future feature genuinely requires server-side storage, introduce it intentionally with per-user quotas, retention limits, encryption, strict server-side authorization, deletion/export, monitoring, and a documented cost model. Never rely on a client-side user ID alone for access control.

## Review mode warning

The temporary no-login review mode uses the browser's unscoped local namespace when no account is active. It is appropriate for private UI review, not for treating a shared public deployment as a secure multi-user service. The frontend review switch does not secure the backend.
