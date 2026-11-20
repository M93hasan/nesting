# Clean Architecture implementation and acceptance review

Stacked branch: `refactor/clean-architecture-completion-20261120`; PR #312 on top of PR #311 and the earlier incremental architecture PRs.

## Dependency direction

```text
App.tsx (presentation and composition)
 ├── useSolver.ts (React subscription -> engine snapshot)
 │    └── NestingSession (application port)
 │         └── WorkerNestingEngine (infrastructure)
 │              ├── solver + validator + live-preview Workers
 │              ├── Sparrow candidate projection + result scoring
 │              ├── deadline, cancellation + progressive diagnostics
 │              └── final off-thread candidate validation
 ├── useProjectAutosave (presentation lifecycle)
 │    └── Application autosave -> HTTP/D1 & IndexedDB adapters
 ├── CAD use cases -> geometry Worker and native DXF serializer adapter
 └── Domain editor rules: manufacturing limits and series reconciliation

Cloudflare API
 ├── serula-worker.js (entry, session/crypto helpers, remaining routes)
 ├── account-routes.js (auth, preferences)
 ├── transfer-routes.js (one-use transfer tickets, test DXF access)
 └── cloud-project-routes.js (autosave GET/PUT)
      └── cloud-project-repository.js (D1)
```

## Refactor invariants

- No changes to Rust/WASM/Sparrow/Jagua solver implementation, source DXF geometry, sheet-pitch spacing, clipping, placement transforms or quantity rules.
- The same solver, preview and validator Workers process the same message envelopes, ordered initialization and run ID/document-revision guards.
- The 30-second initialization watchdog, hard wall-clock budget, 12-second final validation timeout and 100ms polling interval remain unchanged.
- React is a subscriber to an external Worker session; Worker state is owned by infrastructure. Original useSolver named exports are preserved.
- DXF is rendered by the existing native serializer, then its existing chargeable authorization endpoint is called; failed geometry is never charged and failed authorization is never downloaded.
- IndexedDB schema, cloud autosave request shape/credentials, and Cloudflare D1 SQL are preserved.
- Auth/admin and transfer route bodies are moved mechanically; original crypto, cookies, license checks, audit helpers, billing trigger and DB still live in the canonical Worker.
- Architecture guard blocks domain/application backward imports and infrastructure->presentation coupling.

## Required checks before merge

```sh
cd web
npm ci
npm run architecture:check
npm run typecheck
npm test
npm run build
npm run test:e2e
```

Review browser/CAD acceptance on desktop, tablet and 390px. Validate actual nesting with holes, rotations, reflection rejection, multiple sheets, live preview, stop, timeout, restoring a saved project, exported DXF dimensions/source arcs/splines and the 50mm multi-sheet export gap. Review account/password flows, admin settings, credit charge-once and cloud D1 recovery without live data mutation.

## Scope/limitations

This completes the requested *architectural wiring* as a stacked feature branch, but should not be treated as certified production readiness until CI, peer review, manual heavy DXF fixtures, authentication/billing and browser tests pass. The multi-thousand-line CAD editor and canonical Worker still have additional presentation/route handlers; further component decomposition and administrative D1 repository extraction can be considered after functional sign-off. Do **not** merge, deploy or change production D1/secrets without explicit approval.
