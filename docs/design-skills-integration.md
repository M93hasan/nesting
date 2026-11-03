# Emil Kowalski skills — Serula Nesting Pro integration

Source: https://github.com/emilkowalski/skills (MIT License). The source `SKILL.md` files in `.agents/skills/` are preserved for local agent use. They are guidance documents, **not** Vite plugins, React components, or browser assets; no runtime install or new npm dependency is required.

## Integration map

| Skill | Relevant Serula surface | Use |
| --- | --- | --- |
| emil-design-eng | web/src/App.tsx, web/src/Admin.tsx, buttons, dialogs, inspectors, design editor | Review hierarchy, active/hover/disabled states, feedback, clarity. Keep frequent CAD actions immediate. |
| animation-performance | Web canvas, sidebars, overlays, lists, selection affordances | Prefer transform/opacity for nonessential animation, profile frame drops, avoid React re-rendering per frame. |
| break-ui | File import list, part names, counts, dimensions, errors, account/admin fields | Test empty, one, long Unicode DXF names, large numbers, invalid values, long localization labels; use dev-only fixtures and report before fixing. |
| mobile-native | Responsive UI and touch controls | Check taps, viewport/safe-area, overflow, pointer behavior; preserve precise desktop CAD interactions. |

## Recommended implementation sequence

1. Audit existing UI against `emil-design-eng` before editing styles. Explicitly record before/after and functional risk.
2. Verify high-frequency actions (pan, zoom, drag, select, rotate, keyboard commands, nesting progress) remain immediate; avoid animations that obscure placement or delay operations.
3. Exercise `break-ui` with realistic long DXF filenames, Turkish/non-Latin characters, zero/one/many parts, extreme dimensions, invalid inputs and empty project state.
4. Profile interactions under load and respect `prefers-reduced-motion`; only then apply scoped CSS or component changes.
5. Test mobile layouts separately if mobile support is in scope; do not replace the desktop CAD workflow with touch-oriented controls.

## Guardrails for PR review

- **Manufacturing invariants:** exported DXF dimensions, units, offsets, inner holes, spacing, quantity, orientation, and placement results must stay unchanged by visual work.
- **No animation for hot paths:** keyboard actions, per-part dragging, snapping and pointer-following must not introduce decorative transition lag.
- **No global CSS surprises:** avoid wide selectors or blanket `transition: all`; inspect existing themes and open design PRs before editing.
- **Accessibility:** keyboard focus, visible errors, contrast, reduced motion and explicit button states.
- **Performance:** avoid layout thrashing, blur-heavy overlays and paint costs over large nesting canvases.
- **Evidence:** attach before/after screenshots for future visual PRs, include typecheck/unit/build and targeted Playwright results; do not claim tests passed without executing them.

## How to use

Agents that discover project-local skills under `.agents/skills` can use these directly. For other tools, explicitly direct the agent to read the relevant `SKILL.md` and this guide. If your agent uses the upstream skills CLI, its documented optional installer is `npx skills@latest add emilkowalski/skills` — this repository already vendors a curated subset, so this command is **not required** for the present integration.

This PR adds agent guidance only. It deliberately does not change runtime styling, package dependencies, DXF exports, nesting logic or deployment.
