# Security Policy — Breezy Research

## Threat Model & Security Architecture

Breezy Research implements a **zero-trust, privacy-first client proxy model**:
- **Client-Side BYOK (Bring Your Own Key):** Provider keys entered by users are stored strictly in local browser storage (`localStorage`) and forwarded solely over encrypted HTTPS directly to proxy endpoints. They are never logged or persisted on external storage servers.
- **Fail-Closed Edge Backend:** Edge routes (`/api/*`) validate incoming headers and enforce strict CORS origin filtering in production.
- **No Third-Party Analytics / Telemetry:** No user queries, transcripts, or personal access tokens are shared with telemetry aggregators.

## Supported Versions

| Version | Supported          | Status |
| ------- | ------------------ | ------ |
| 2.5.x (main) | :white_check_mark: | Active Development & Production |
| < 2.5.0 | :x:                | Deprecated / Unsupported |

## Reporting a Vulnerability

If you discover a security vulnerability or potential credential exposure issue:
1. Open a **Private Security Advisory** on the GitHub repository, or report directly via email.
2. Please provide a clear reproduction script or packet trace.
3. Vulnerabilities will be triaged and addressed within 48 business hours.
