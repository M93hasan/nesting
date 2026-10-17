# First-use guided tour

New email and Google accounts receive a pending row in `user_onboarding`.
The studio checks `/api/onboarding` after authentication and opens the tour.
Existing accounts have no row and do not receive an unsolicited tour.
Admin login and permissions are unchanged.

The eight steps explain the workflow: welcome, import, parts and quantities,
roll/sheet dimensions, rotation/spacing/start direction, nesting, results,
and DXF download/history. Highlighting and scrolling do not edit the document,
start the solver, download files or consume credits.

Users can go back, continue, skip or press Escape. Help contains a replay
button for signed-in users and guests. The dialog uses native modal focus
management, restores focus after closing, supports small screens, and has
Turkish, English, Arabic and Persian copy. Shared 12px / 500 typography applies.

Completion and dismissal are stored against the authenticated account. The
API does not accept a target user ID or allow resetting the state to pending.
A per-account browser marker prevents a repeated automatic tour if the save
request fails; local storage is optional. Guests can replay without a save.

Verification covers real worker routes against in-memory SQLite, email and
Google enrollment, old-account behavior, authentication/origin validation,
account isolation and persistence. Browser tests cover registration, all
steps, replay, dismissal, focus, unchanged documents, mobile, RTL and blocked
local storage. API fixtures in browser tests do not create real accounts.
