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
