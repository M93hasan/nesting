# Serula Design Studio — consolidated delivery

This directory contains the first, isolated phase of the Builder.io-style design editor.

## Entry point
Admin > Görünüm > Tasarım Editörünü Aç.

## Included
- Read-only import of existing Serula background/panel colors
- Editable demo heading, panel and button colors/spacing/typography
- Desktop/tablet/mobile preview
- Layer visibility/locks; root layer drag reordering and arrow controls
- Undo/redo, reset, validated browser-local draft storage
- Versioned JSON import/export (serula-design-v1)
- Allowlisted component registry and unit tests

## Explicitly NOT implemented
- Editing the actual production Nesting page component tree
- Persistent server drafts, revision history, shared collaboration
- Safe publish approval and production rollback
- Full Builder.io parity or Builder.io SDK/service integration

## Boundaries and verification
This is an admin-only prototype with no new Worker endpoints or D1 migrations. Do not equate GitHub green CI with validated real-production visual editing.
Before merge, run `cd web && npm run typecheck && npm test && npm run build`, then browser/Playwright review. Run a focused check of import/export, Ctrl+Z/Y, reset, layer visibility, nested button behavior and mobile preview.
Do not deploy to staging or production without separate authorization.

## Next architecture phase
1. Build an explicit registry mapping real app UI component IDs to allowed style tokens; reject executable JSX/HTML/JS from stored drafts.
2. Separate editable design schema from Nesting application state and calculation state.
3. Add a read-only preview of real application components via a controlled renderer, with no writeback.
4. Add authenticated draft and immutable revision APIs with per-admin audit and strict JSON validation.
5. Add manual publication gate, rollback, visual regression tests and accessibility review.
