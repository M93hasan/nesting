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
