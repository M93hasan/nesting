# Final route and presentation extraction checklist

Stacked Draft PR #313, based on #312 and the earlier Clean Architecture PRs.

## Server-side structure

`web/worker/serula-worker.js` remains the canonical Cloudflare request entry and keeps:
- schema initialization, D1 table definitions and credit-charging database trigger
- session/cookie/crypto helpers, login and admin session verification
- asset routing and scheduled maintenance

All significant HTTP route groups now have separate modules:
- `account-routes.js`: registration, login, logout, OTP and preferences
- `cloud-project-routes.js` / `cloud-project-repository.js`: cloud autosave and D1 data access
- `export-routes.js`: authenticated DXF authorization, export history and deletion
- `admin-overview-routes.js`: user list, deletion, admin chat and audit records
- `admin-settings-routes.js`: license, credit, global and per-user settings, password reset, transfer permissions
- `support-routes.js`: user and admin remote support and screen-sharing signaling
- `design-routes.js`: published appearance, admin versions, approval and rollback
- `user-chat-routes.js`: authenticated chat and disabled historic nesting endpoint
- `transfer-routes.js`: Corel ticket flow and test-DXF access

Each route handler uses explicitly injected Worker helpers; route body logic and order of authentication, validation, D1 operations, audit and responses are preserved.

## App and application boundaries

- `App.tsx` now calls use cases for nesting normalization, off-thread layout preparation, CAD import/export, paid DXF authorization, and auto-save.
- Presentation-only side effects reside in `useProjectAutosave`, `useDesignStudioAppearance`, `useCadAccess` and `useSolverWarmup`.
- Pure manufacturing and production policies are in Domain modules.
- The editor's DOM event handlers, keyboard interactions, selection and view state intentionally remain in the React presentation layer. Removing them from React is **not** a Clean Architecture goal.

## Mandatory acceptance

1. `npm run architecture:check`, `npm run typecheck`, `npm test`, `npm run build`
2. Browser regression on Chromium, Firefox and WebKit including CAD import/export and 390px responsiveness
3. Credits: no charge for unverified geometry or anonymous requests, exactly one D1 trigger debit on authorized export, valid admin permission for credits/licenses
4. Local recovery, login/OTP/logout, admin records and support sessions
5. DXF curve/holes/splines, mm units and sheet offsets unchanged

## Release caution

Keep this PR as Draft until CI and reviewer acceptance. The runtime `web/package.json` baseline is currently `0.1.16`; a target of `0.0.17` is a SemVer **downgrade**, not the next patch from `0.1.16`. Version release and production deployment should be handled only after verifying this exact intended version and integration order. Neither publishing nor merging is performed by this PR.
