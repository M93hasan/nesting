# Serula theme assets

The shared visual tokens and dashboard/authentication styles live in the repository-root `theme/` directory.

- `theme/serula.css` defines the core theme tokens, imports the screen-surface layer, and respects the operating-system light/dark preference.
- `theme/serula-surfaces.css` styles the admin and authentication views.
- `theme/serula-workspace.css` styles the main workspace header, controls, and canvas frame.
- `web/src/main.tsx` imports the core theme stylesheet for the web application.

The Cloudflare deployment workflow watches changes under `web/**`. When only files in the root `theme/` directory change, a web-path change or a manual workflow dispatch is needed to trigger a production deployment.

- Workspace follow-up: consistent import, run, and export button sizing; clearer left-panel action grouping; tighter material settings spacing and responsive footer wrapping.

- The empty-canvas DXF import action is capped at 220px to match the compact workspace action hierarchy.

- Narrow-phone pass: responsive header, workspace, result metrics, and export actions are stacked at widths of 420px and below.

- Explicit light/dark toggle added to the workspace, user sign-in overlay, and admin header; user preference persists in local storage.
- Canvas viewport sizing and overflow safeguards added for narrow screens.

- Follow-up verification fix: admin sign-in/loading cards expose the same persisted light/dark theme toggle; empty-canvas DXF button and wrapper both have explicit 220px width constraints.

- Empty-canvas DXF import button width is explicitly capped at 220px, with a viewport-aware max-width for narrow screens.

- Selective Liquid Glass is limited to dialogs, authentication cards, and the admin top bar. Canvas and dense editing controls stay opaque for legibility and performance; a non-blurred fallback and reduced-motion-safe entry animation are provided.
