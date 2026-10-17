# Vision UI presentation adaptation

The studio, administration screens (`/admin`, `/admin2`) and account dialogs
share the final tokens and controls in `web/src/vision.css`. The standalone
Google login page uses the same palette and self-hosted font; Google's own
sign-in button remains controlled by Google's SDK. The new default is
dark navy with blue primary actions. Existing light/dark/system preferences
remain in `serula-theme`; the light palette is supported as well.

Reference: [Vision UI Dashboard React](https://github.com/creativetimofficial/vision-ui-dashboard-react),
by Simmmple and Creative Tim. The supplied Figma frame (`1601-6525`) could not be
opened because this environment blocks the Figma network connection. This is an
adaptation of the accessible public theme, not a verified pixel-for-pixel copy
of that frame. A PNG/PDF export can be used for further comparison.

The Plus Jakarta Sans variable font is self-hosted, including Latin Extended
for Turkish characters. It is the Sans member of the reference's Jakarta font
family; the reference uses Plus Jakarta Display. Fontsource package version:
`@fontsource-variable/plus-jakarta-sans@5.3.0`. Font and reference licenses are
included under `web/public/fonts/plus-jakarta-sans` and `web/public/licenses`.
No MUI dependency, external font request or dashboard image was added.

Theme rules preserve destructive actions, CorelDRAW's green transfer controls,
selected/disabled/focus states, touch targets and reduced-motion preferences.
The nesting engine, material settings, import/export and account permissions
are unchanged. Administrative screenshots used local browser API fixtures and
do not represent production accounts or a live backend health check.
