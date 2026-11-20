# Clean Architecture integration — review checkpoint

This stacked PR builds on #310, #309, #308, #306, #305, #304 and #303.

## Wired to the running application

- **Application use cases:** autosave, CAD import preview, CAD export preparation, and document normalization before solving.
- **Infrastructure adapters:** existing geometry Worker, native DXF serializer, same-origin autosave endpoint and IndexedDB recovery.
- **Domain policies:** rotation/quantity rules formerly declared in App.tsx.
- **Worker event boundary:** the three Worker event listeners are now installed by Infrastructure code; current React hook still handles event processing.
- **Architecture test:** Domain and Application cannot import React or concrete Worker/Infrastructure/storage/export code; build runs the guard.
- **Regression tests:** CAD request shape and native DXF byte-for-byte parity, cloud JSON payload/status, normalization, event wiring and domain policies.

## Still outstanding — do not treat as completed

1. **Full NestingEngine implementation:** the React hook still owns run state, validator/preview handlers and cancellation sequencing. Moving this into a stateful engine/controller is a separate high-risk migration.
2. **Full React presentation split:** App.tsx still owns editing interactions, other geometry calls, several API fetches and UI workflows.
3. **Cloudflare backend modules:** the server's `serula-worker.js` routes, auth and D1 access remain unchanged. They require a separate security review and Worker SQLite tests before extraction.
4. **Full production acceptance:** CI browser suites and CAD/DXF fixtures must pass. A green CI does not replace manual testing of large DXF contour imports, holes, sheet indexing, source curves, lossless export, credit charges, login, project recovery, and browser/pagehide races.
5. **Architecture:** the historical model.ts and geometry contracts remain shared. The dependency guard prevents new regressions in domain/application but does not certify all legacy files.

## Compatibility decisions

- CAD import/export still uses geometry.worker.ts with its original request identity and no main-thread parsing.
- Export data is fully prepared before calling existing authorization; charging, login gates and ticket workflow are not moved.
- Cloud autosave sends the same `PUT /api/project/autosave` request body, credentials and status handling.
- IndexedDB database/object-store layout remains exactly as before.
- DXF is serialized through the original exportDXF implementation with the same options; sheet gap and units are not modified.
- No Rust/WASM, Cloudflare production data, infrastructure settings, deploy, merge or billing changes.

## Verification

```sh
cd web
npm ci
npm run architecture:check
npm run typecheck
npm test
npm run build
npm run test:e2e
```

All CI suites need to pass before merging. Stacked PRs should be merged in order, after explicit authorization.
