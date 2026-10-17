# Global color controls

Admin → Görünüm provides native color pickers, three presets and a live preview
for the dark theme background and panels. The initial colors are #2F396B and
#192142. Text remains 12px / weight 500. Light theme colors retain their own
palette.

Picking colors previews them in the current document only. Restore saved
discards the preview; leaving the section also discards unsaved changes.
Previewing switches the editor to dark mode temporarily and restores the
previous theme on cancellation or exit.

Save for everyone writes validated six-digit hex colors to the appearance
record in system_settings. Only the separate authenticated admin session can
write /api/admin/appearance. Public /api/appearance exposes only these colors.
Nesting defaults, user settings and project documents are separate records.
The endpoint follows the existing origin validation and records an audit event.

The studio and admin load global colors at startup, on focus/visibility and
every 30 seconds while visible. The Google login page loads them at startup.
Failed requests retain the last colors; the editor has a retry for initial
loading and preserves drafts after failed saves. A request generation prevents
an older read from overwriting a successful save.

Validation includes real worker routes with in-memory SQLite, write authority,
invalid inputs, persistence and separation from material defaults. Browser
checks cover private preview, abandoning/reverting, save/reload, studio colors,
failure/retry, mobile keyboard use and a stale-read/save race. Preview fixtures
are local; they do not modify production colors or create real accounts.
