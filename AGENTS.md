# Serula Nesting Pro — repository agent rules

## Non-negotiable
- Preserve DXF dimensions, geometry, toolpaths, quantities, clearance, rotation/mirroring and Rust/WASM nesting behavior.
- Preserve the positions, semantics, events, keyboard access and CAD interaction latency of functional controls.
- Do not introduce decorative theme, global palette, UI animation, glass styling, appearance editor or saved custom button CSS.
- Work on a feature branch and propose a PR; do not push to main, merge or deploy without explicit approval.
- Review concurrent PRs and avoid overwriting anyone else's work.
- Do not alter production databases, secrets or live Worker configurations as part of layout maintenance.

## Scope and validation
- Frontend: `web/src/App.tsx`, `web/src/Admin.tsx`, `web/src/components/`.
- Structural layout: `web/src/layout.css`; keep necessary responsive sizes, positions, hit targets and accessible focus affordances.
- Before integration run `cd web && npm ci && npm run typecheck && npm test && npm run build` plus maintained Playwright smoke, CAD, DXF/export and admin checks.
- Confirm desktop/tablet/390px layouts, canvas selection and zoom, import/export and keyboard shortcuts.
