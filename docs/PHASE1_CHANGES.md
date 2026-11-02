# Phase 1 changes

- Colors are CSS variables (`src/styles/themes.css`); Tailwind reads them. Themes: Ocean (default), Slate Ink, Paper, Sage, Match system.
- Settings → Appearance picks the theme; `index.html` applies it before first paint.
- Navigation: Chat, Research, Library (history + notes), Models. Labs: Build, Canvas. Profile menu: Account, Settings, Help.
- Phone: bottom tab bar with a More sheet. Desktop: Ctrl/Cmd+K quick switcher.
- Old `#history` / `#notes` links redirect to Library.
- Removed: 30-second backend health polling (health is checked on load and when the connection returns).
- Removed: blur, glow and gradient backgrounds (old class names remain as flat no-ops).
- Removed from repo: duplicate `breezy-ui/`, `.aistudio/`, `manus-routes.json`, loose logo. Root docs moved to `docs/`.

## Known gaps
- Canvas is still the old board page; it becomes a chat side panel in the Canvas phase.
- Guest preview still exists; the real sign-in page and landing page are phase 2.
- Library tabs still show the old page titles ("History", "Notes").
- Server storage quota and the "delete or connect your own storage" flow need the history API (phase 2).
