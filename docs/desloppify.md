# Desloppify — initial code-quality baseline

This integration is **diagnostic only**. It never modifies nesting geometry, DXF exports, Cloudflare Workers, production databases, or deployment settings. It does not run auto-fixes or merge changes.

## Scope

- `web/` is scanned as TypeScript (React UI, TypeScript utilities and Worker-related source). Desloppify may not deeply inspect plain JavaScript Worker files; those require a separate review.
- `web/wasm/` is scanned separately as Rust (Sparrow/WASM nesting integration).
- Generated `node_modules`, `dist`, Rust `target`, `pkg*`, and test reports are not source. They are excluded from version control; confirm Desloppify excludes generated folders before interpreting results.

## How to use

On Python 3.11+:

```sh
python -m pip install --upgrade "desloppify[full]"
desloppify --lang typescript scan --path web --profile ci --no-badge
desloppify status --json
desloppify --lang rust scan --path web/wasm --profile ci --no-badge
desloppify status --json
```

For interactive remediation, scan **one language and project path at a time** without `--profile ci`, then use `desloppify next`. Keep `.desloppify/` untracked. Do not optimize scores by suppressing legitimate findings. Review each suggested change and run existing TypeScript, Vitest, Playwright, and WASM tests before proposing merges.

## CI

`.github/workflows/desloppify.yml` runs a non-blocking baseline on its own PR changes or manually, uploads logs and JSON snapshots as an artifact, and has read-only repository permissions. Scores are **not yet established**; use the first completed workflow results as the baseline. The two scans are intentionally independent.

Desloppify quality scores do **not** verify polygon non-overlap, boundary containment, clearance, DXF production accuracy, or geometric correctness. Maintain dedicated geometry/WASM acceptance tests.
