# Shadcn Dashboard integration (single feature branch)

Source: https://github.com/shadcndashboard/shadcndashboard
MIT License, copyright (c) 2026 Shadcn Dashboard. Attribution: https://shadcndashboard.dev/

The design language is adapted into Serula; this is not a replacement for the existing React application. The upstream app's sample authentication, mock service worker, blog, notes, tickets, router and theme provider are deliberately excluded.

Initial stage (administrator, CAD shell and authentication):
- Scoped neutral styling in web/src/shadcn-dashboard.css. No imported Tailwind reset or global CSS.
- DashboardIcon.tsx adds accessible outline icon navigation for existing functional admin sections.
- Admin.tsx preserves authenticated backend/API logic, filters, user management and support.
- App.tsx retains the existing DXF, CorelDRAW, Rust/WASM and nesting handlers and canvas dimensions; only a scoped CSS class is introduced.
- AuthGate.tsx applies a scoped Shadcn card/form treatment while preserving server-side session and Google OAuth actions.
- web/src/layout.css remains the layout authority for CAD geometry.

Continue **on the same feature branch**: refine admin tables, forms, user/account dialog styling, then review the studio in all viewports. Before merge run npm ci, npm run typecheck, npm test, npm run build and Playwright regression including mobile overflow, DXF import/export, undo and keyboard/canvas behavior. Do not merge or deploy without approval.

License text: web/public/licenses/shadcn-dashboard-MIT.txt

## Administration improvements (stage 2)

The user table has an accessible semantic table structure, a scoped search control, filters for role and online status, deterministic sorting by name / last login / credits, a visible result counter, individual status badges and a reset action. All existing account mutations continue through authenticated Serula APIs; no client-side privilege changes or data rewriting are introduced. Browser tests cover interactions and the narrow-screen table.

## Dashboard activity and settings (stage 3)

The overview now requests the existing `/api/admin/logs` audit endpoint and renders up to five most recent action entries; the full logs page remains available. Backend connection text is derived from the existing health check instead of a hard-coded D1 success label. User/system defaults have semantic field groups and Shadcn-style form layouts, without changing any values, API endpoints or save handlers. Playwright covers the audit activity and navigation.

## Real data visualization (stage 4)

The admin overview includes a responsive, accessible seven-day user registration chart. It uses only the existing D1-backed `createdAt` timestamps already supplied by the admin-users endpoint; users without valid registration timestamps are not counted. No additional API, dependency, chart mock or tracking is added. Semantic roles are assigned to every cell in the user data grid.


## Studio control system (stage 5)

The separate studio-dashboard.css stylesheet styles the existing Serula workspace: navigation, save status, account dropdown, part rows and selected state, series multiplier, material settings, CAD snapping toolbar, canvas hints, empty state, placement result tabs, action footer, export buttons and modal controls. The style system follows the neutral Shadcn Dashboard visual direction. No new editor, simulated data or dependency is introduced.

The CAD column positions, part selection handlers, calculation and WASM/DXF/PLT/SVG/CorelDRAW processes, keyboard behavior, session security and Cloudflare Worker/D1 bindings are unchanged. Existing layout.css remains authoritative for structural dimensions and responsive geometry.

New Playwright coverage includes the desktop panel order, settings disclosure keyboard focus, contour toggle, 390/768/1440 viewport overflow, DXF/CorelDRAW controls and PR screenshots.

The upstream Shadcn Dashboard template remains MIT licensed, and this adaptation retains its source link and license notice.

## Visual QA findings and fixes (stage 6)

Screenshots from the GitHub Actions Serula layout artifact (run 41661450977) were reviewed against the Shadcn Dashboard reference. The first visual review exposed three problems that functional tests missed: black SVG fill in the empty CAD view, overlap between the floating CAD controls and the empty-project card on a 390px screen, and a sticky export footer visually covering the parts/settings in a full-page mobile capture.

The fix lives in the isolated `studio-dashboard.css` file: non-interactive SVG material masks now have explicit light-surface fills, mobile snapping controls and the empty card are vertically separated, duplicate canvas help text is hidden only for an empty project, and the export footer follows document flow on narrow screens. Existing App.tsx, Workspace.tsx, DXF export and placement logic are unchanged.

Visual regression tests now assert the SVG fill, mobile control/card bounding-box separation and that the bottom action bar follows the material panel. The CI artifact also captures /admin on mobile and desktop and attempts a reference screenshot from the public Shadcn Dashboard demo.

This aims at visual consistency with Shadcn Dashboard, not exact pixel equivalence between unrelated dashboard and CAD layouts. Final production publication requires user approval.

## Exact source screenshot comparison (stage 7)

Source capture: public Shadcn Dashboard React demo at https://shadcndashboard-demo.vercel.app/ (GitHub Actions run 41663696783). Serula admin screenshots at widths 1440px and 390px were checked against it. The Shadcn reference uses a mostly white content surface, dark/black active sidebar item, outlined cards and buttons and a compact copyright/footer link. Serula previously had a pale-gray selected menu item, a stronger gray main background, oversized empty registration bars and a status badge incorrectly showing a green dot even on server failure.

The correction restores the reference black active selection, white canvas, readable muted inactive links, truthful error/checking status colors, a graceful real-zero registration empty state, and a source attribution link in the admin footer. Non-empty registration data still produces the original live seven-day chart. The CAD ruler's remaining black SVG default fill is corrected without changing canvas geometry or hit areas.

Functional parity to Serula's CAD tools takes priority over pixel-perfect copying of the reference's unrelated demo marketing data, widgets and site structure.

## Slate ambience, compact parts and DXF foreground (follow-up)

The white-heavy Shadcn interface is refined with a scoped slate and graphite palette in `web/src/slate-ambience.css`. Only the interior of the **Parçalar** sidebar is compacted: part thumbnail and row padding, quantity input, production series, add/undo/clear controls and collapsed properties. Mobile action targets remain at least 40px. Positions of all three CAD columns, toolbar functions, export actions and Worker APIs remain unchanged.

DXF display bug: `Workspace.tsx` previously rendered the opaque `material-width-outside` SVG group after the shape groups, concealing imported geometry outside the material-width boundary. It now renders before all part shapes, preserving coordinate grid and material tint while keeping imported DXF geometry visually on top. DXF parsing, DXF layer data and exported geometry are untouched. Browser tests import a real DXF fixture, check SVG paint order, and check compact control accessibility.

## Mobile cancellation (follow-up)

At the user's request the new slate palette and compact Parçalar controls are **desktop/tablet only (min-width 700px)**. All new mobile-specific palette/compaction overrides have been removed; below 700px the previously published Shadcn/Serula mobile layout remains unchanged. The SVG DXF foreground layering bug fix stays global, because that is a drawing-order fix, not a mobile UI redesign. The PR remains unmerged and production stays unchanged.
