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
