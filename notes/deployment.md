# Production deployment

Production Worker: `nesting` (serves https://serula.site/).

Two checks run for commits to `main`:

1. **Validate Serula Web** in GitHub Actions builds all four WASM variants,
   typechecks the application, builds Vite assets, and runs the unit tests.
2. **Workers Builds: nesting** uses Cloudflare's existing GitHub connection to
   build, test, and deploy the same commit. The build script exits immediately
   on a failing command, so failed builds or tests cannot reach deployment.

Cloudflare build settings (repository root `/`):

- Build: `bash web/scripts/build-cloudflare.sh`
- Deploy: `cd web && npx --yes wrangler@4 deploy`
- Non-production version: `cd web && npx --yes wrangler@4 versions upload`

GitHub Actions does not need a Cloudflare token. The previous deployment step
failed with API error 9109 because the stored token rejected the GitHub runner's
IP address. Keep that restriction; deployment uses Cloudflare's own build token.

Older Actions runs may also report an account billing lock before any steps
start. That is an account-level condition, not a source-code compilation error.
Historical failures remain in the run history; check the latest commit's checks.

## Account and credit baseline

`web/migrations/0001_accounts_and_exports.sql` is an idempotent baseline for an
empty D1 database. It also accepts existing tables without replacing user data.
The canonical Worker creates the same missing tables and export billing trigger
before handling API requests; the legacy entry point forwards to that Worker.
No default admin password or privileged user is seeded. Existing admin credentials
and the `ADMIN_PASSWORD` secret continue to work.

Local nesting previews are free in the current product. The removed
`POST /api/nesting/start` endpoint returns 410 and cannot charge an extra credit.
Only a saved DXF export consumes one credit. The insert trigger checks the current
balance, writes history and debits it inside the same D1 batch as the file chunks.
Any failed statement rolls back the entire export, including the charge.
Unlimited users remain uncharged. Install this trigger with the corresponding
Worker change, since older Workers performed a separate debit.

New password hashes use 100,000 PBKDF2-SHA256 iterations to fit Workers' native
Web Crypto limit. Existing 210,000-iteration hashes are verified with the same
PBKDF2 algorithm using native HMAC; passwords do not need to be reset. This legacy
path consumes more CPU and should be checked against the deployed plan's budget.
The account/credit tests execute real Worker queries against SQLite, including
transaction rollback; they do not replace a production Worker smoke test.

These controls protect the hosted API and stored exports. The browser still
receives the solver and export generator, so a modified client can run them
locally. A strict paid-computation boundary requires moving those operations to
an authenticated server; a client-side API call cannot provide that boundary.
