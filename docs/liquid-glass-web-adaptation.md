# Liquid Glass-inspired Serula Web UI

Source review:
- https://developer.apple.com/documentation/technologyoverviews/liquid-glass
- https://developer.apple.com/documentation/technologyoverviews/adopting-liquid-glass
- https://developer.apple.com/design/human-interface-guidelines/materials

## What is applied
A web-platform interpretation of Apple's material hierarchy. Glass is reserved for the **floating canvas toolbar, snapping control, and project-menu trigger**. The content layer (DXF drawing, nesting render, parts, numerical fields, sidebar and work surfaces) stays opaque. This preserves geometry visibility and CAD performance.

The effect uses modest `backdrop-filter: saturate(...) blur(10px)`, a nearly opaque tint, fine borders and inner highlights. This is **not** Apple's native Liquid Glass optical/refraction implementation (which comes from SwiftUI, UIKit or AppKit on Apple platforms).

## Accessibility and compatibility
- Existing light/dark preference and stored appearance settings remain unchanged.
- Focus indicators, text color and selected state remain explicit.
- `prefers-contrast: more`, `forced-colors: active`, and `prefers-reduced-transparency: reduce` (where supported) disable blur and use solid backgrounds.
- Reduced-motion settings disable decorative transitions.
- Unsupported `backdrop-filter` has an opaque fallback.
- Browser support for an operating system's Reduce Transparency setting can vary. It is not possible to reproduce Apple's native material adaptation exactly using CSS.

## Non-goals
No rework to the Worker, D1, geometry, Rust/WASM, DXF input/output, selection coordinates, editor sizing, or CAD pointer/keyboard logic.

## Verification
Run `cd web && npm ci && npm run build && npm test && npx playwright test tests/liquid-glass.spec.ts tests/visible-studio-theme.spec.ts tests/premium-theme.spec.ts --project=chromium` plus the maintained browser suite. Review screenshots in light, dark, mobile, keyboard focus, and forced-colors configurations.
