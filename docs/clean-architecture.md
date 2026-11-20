# Clean Architecture migration (incremental)

The first step introduces boundaries without changing any Rust/Sparrow/Jagua placement or DXF implementation.

## Dependency direction

- `src/domain/`: pure domain policies and computations, no React or browser/Cloudflare/WASM APIs.
- `src/application/ports/`: TypeScript contracts for solver, persistence and CAD export. They depend only on shared types.
- `src/infrastructure/` (future PRs): adapters for Web Workers/WASM, Cloudflare/D1 and import/export.
- `src/presentation/` (future PRs): React views and hooks, calling application use cases.

## First extraction

`productionTotals` now lives in `src/domain/production/productionTotals.ts`. The original `src/geometry/production.ts` remains a re-export so all callers and tests retain their imports. The calculation and its result shape are unchanged.

The new application ports are **contracts only**. Existing `useSolver`, DXF serialization, cloud storage and Worker code are not yet wired through them. Do not swap a functioning path for a stub.

## Next PRs

1. Add characterization tests for solver progress/cancel/deadlines, candidate validation, multi-sheet DXF offsets and recovery.
2. Move solver run lifecycle into an Infrastructure adapter, preserving incremental progress, validation, run IDs, timeouts, thread behavior and error states.
3. Introduce use cases and inject adapters into React hooks; retain current component behavior and latency.
4. Split Cloudflare route handlers, authentication/application services and D1 persistence in a separate backend PR.

## Non-negotiable regression gates

```sh
cd web
npm ci
npm run typecheck
npm test
npm run build
npm run test:e2e
```

Review DXF dimensions (mm), holes, arcs/splines, rotation/mirroring, clearance, sheet boundaries, 50mm sheet export gap, UI keyboard/canvas operations and account security. Run against reference DXF fixtures. Do not modify production database/config/secrets or merge/deploy without explicit approval.
