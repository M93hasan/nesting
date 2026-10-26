# Serula theme styles

The main application loads its presentation layer through `/theme/index.css`, linked once from `index.html`. Do not import theme styles individually from React components or TypeScript entry points.

## Structure

- `index.css` — single entry point and import order for the main app.
- `tokens.css` — shared design tokens, final theme overrides, Liquid Glass surfaces and accessibility fallbacks.
- `vision.css` — typography/font-face setup and shared visual component styles adapted under the included MIT license.
- `admin.css`, `admin-buttons.css` — administration layout and its button system.
- `auth.css` — login/account screens.
- `reference-controls.css` — custom workspace controls.
- `typography.css` — shared UI type scale.
- `components/` — styles for appearance settings, workspace, and shape library.
- `base.css` — shared layout/reset styles used by the main application and the separate browser-bridge page.
- `google-login.css` — standalone static Google login page stylesheet, linked directly by `google-login.html`.

## Rules

1. Add new main-app theme CSS to this folder and register it in `index.css`.
2. Keep component behavior in TypeScript/React; CSS here must only control presentation.
3. Keep shared tokens owned by `tokens.css`; avoid redefining the same global tokens in other files.
4. Keep the bridge isolated from the main application stylesheet entry point.
5. Run the source check, typecheck, unit tests, production build and browser theme regression tests before merging.
