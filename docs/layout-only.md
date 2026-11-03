# Layout-only interface after removing themes (03-11-2026)

Old custom themes, stored appearance controls, button-style editor and decorative CSS were removed.

The new `web/src/layout.css` retains structural declarations (position, size, flex/grid, overflow, spacing, hit targets and responsive layout), with system colors restricted to readable document defaults and functional CAD SVG tokens. There are no selectable light/dark themes, saved button CSS overrides, theme presets, gradients, glow, box shadows or custom typography. Functional controls, canvas geometry, nesting and DXF export remain in React and Rust/WASM code.

Existing historical `appearance` records in production D1 are **not deleted**; the APIs that read or write them are removed. No production database or deployment is modified by this change.

Do not publish without verifying `npm ci && npm run typecheck && npm test && npm run build` and relevant Playwright suites at widths 390, 768, and 1440, especially login, DXF import/export, nesting, admin and keyboard/canvas interactions.
