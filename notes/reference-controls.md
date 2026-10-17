# Supplied control examples

The seven examples in the user's `butonlar.zip` are adapted in
`web/src/reference-controls.css`, `components/ReferenceControls.tsx`, and
`components/GlassSelect.tsx`.

| Example | Application |
| --- | --- |
| Settings | Settings actions and solver-options disclosure use the violet pill and rotating gear. |
| Waiting | Nine animated rails/balls indicate actual pending import/solver/export/admin work; sizes fit status controls. |
| Download | Supplied cloud SVG on DXF and installer downloads; the sample contained no CSS, so its finish uses the violet family. |
| Text/number | Native inputs retain their handlers, ranges, validation and accessible names, with floating wave captions and underline. Compact/unlabelled inputs retain compact sizing. |
| Select | Two or three short choices get a glass glider. Long, dynamic, empty-placeholder and multi-option lists keep a native dropdown with the glass finish. |
| Start nesting | Rocket icon, dark gradient and hover movement; the existing start/restart handler is unchanged. |
| Permitted rotations | Silver pill finish; persistent pressed state and focus distinguish the selected rotation. |

The native select is the single keyboard/screen-reader/form control. Pointer
shortcuts dispatch its normal change event. Decorative choices are hidden from
screen readers and add no extra tab stops. Disabled options remain disabled.
Wave captions use an explicit accessible label and translate with the current
locale. Arabic and Persian remain joined text rather than isolated letters.
Reduced-motion preferences disable continuous animations and glider movement.

No `styled-components` dependency was added. All styles are scoped to avoid
renaming generic classes such as `.main` or `.loader` throughout the application.
Original UI text, material/copy/rotation rules, engine and permission checks are
preserved. Red destructive controls and green CorelDRAW transfers remain distinct.
