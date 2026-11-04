# QA pass (automated)

Checked in a headless browser: every page (Chat, Research, Library, Models, Build, Board, Settings, Account, Help) in Ocean and Paper (all four themes for the first run), plus all pages at 390px wide in Ocean and Paper.

## Fixed
- Chat helper text used the border colour (contrast 1.4 to 2.0). Now readable in every theme.
- Paper: primary and secondary text sat just under AA (4.2 vs 4.5). Darkened primary (#086a80) and outline (#5b6270).
- Hardcoded amber warnings (`#F59E0B`) were unreadable on Paper. Now a themed `warning` token (dark amber on Paper).
- Build's "Manage GitHub connection" link used a hardcoded light blue. Now uses theme tokens.

## Checked and fine
- No horizontal overflow on any page at 390px (Ocean, Paper).
- Remaining automated flags are disabled buttons (Start research, Test key, Discover models, Load) and decorative empty-state icons. Disabled controls are exempt from contrast rules.
- Console: the only errors in the sandbox were Google Fonts being unreachable and `/api/health` returning 404 on the static preview server (no backend there).

## Not covered
- Slate and Sage were checked on the first run only (before the final fixes); Paper and Ocean were re-checked.
- No keyboard-only walkthrough, screen reader test or real-device test.
- No live model, Firebase or D1 involved.
