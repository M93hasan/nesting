# Serula Nesting Pro — AI agent working rules

These instructions apply to this repository. Follow existing project conventions and the instructions below when working on the UI.

## Non-negotiable production constraints
- Never change DXF dimensions, geometry, toolpaths, quantity semantics, nesting clearance, rotation/mirroring, or Rust/WASM placement logic as part of a visual design task.
- Never trade geometric correctness or CAD interaction latency for decoration.
- Work on a feature branch and propose a PR; do not push to main, merge, or deploy without explicit approval.
- Respect concurrent PRs, including any active design/theme work. Avoid broad CSS rewrites without reviewing current changes.
- Avoid added runtime UI dependencies solely to implement animation. Honor accessibility and reduced-motion settings.

## Installed design-engineering skills
The following skills are vendored from https://github.com/emilkowalski/skills (MIT licensed; source files preserved) and are intended for AI coding agents, not runtime execution:
- `.agents/skills/emil-design-eng/SKILL.md` — UI polish and purposeful interaction.
- `.agents/skills/animation-performance/SKILL.md` — animation frame-budget and rendering costs.
- `.agents/skills/break-ui/SKILL.md` and its `CATALOG.md` — adversarial UI stress-testing.
- `.agents/skills/mobile-native/SKILL.md` — mobile web ergonomics.

Use the relevant skill when reviewing or changing the UI. For Serula-specific constraints and a review checklist see `docs/design-skills-integration.md`.

## Scope and verification
- UI entrypoints: `web/src/App.tsx`, `web/src/Admin.tsx`, `web/src/components/`.
- Styles: `web/src/styles.css`, `web/src/theme.css`, `web/src/premium-theme.css`, and other stylesheets in `web/src/`.
- Do not assume a design skill changes application appearance by itself: skills guide future work.
- For actual UI changes run `cd web && npm ci && npm run typecheck && npm test && npm run build`; run relevant Playwright tests where feasible.
- Verify DXF/nesting operations remain intact after any UI work, including canvas interactions, input values, export and keyboard shortcuts.
