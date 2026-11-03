# Liquid Glass — coverage map

Guiding principle: Apple's Liquid Glass is a distinct **navigation / controls layer**, not a blanket blur on data and content. https://developer.apple.com/design/human-interface-guidelines/materials

Coverage:
- Serula studio: top header, bottom action/navigation bar, floating canvas tools, snap menu, project menu
- Admin panel: sticky topbar, active/hover side-navigation, toolbar controls, settings actions
- Authentication: login dialog/surface, auth tabs, account-menu trigger and popup
- Overlays: modal dialogs, support window header, transient controls
- Settings: appearance and action controls, selection states, focus rings

Purposely opaque:
- SVG CAD workspace and dimension readouts
- Part rows / numeric inputs / material editing
- Admin user tables, statistics, logs, data cards
- Account form inputs and chat messages

Compatibility:
- High contrast, reduced transparency when exposed by the browser, reduced motion
- Light and dark themes, fallback solid backgrounds
- Accessible keyboard focus, no changes to app functionality

Apple native Liquid Glass rendering and dynamic refraction cannot be replicated exactly by CSS. This is a cohesive web interpretation. Avoid glass on every data surface: that contradicts Apple HIG and would reduce CAD legibility.

Regression: `npx playwright test tests/liquid-glass.spec.ts tests/liquid-glass-coverage.spec.ts tests/premium-theme.spec.ts --project=chromium` plus whole CI.
