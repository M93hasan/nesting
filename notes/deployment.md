# Production deployment

Production Cloudflare Worker: `nesting` — serves https://serula.site/.

## Automatic checks and production release

A push to `main` launches two **independent** processes:

1. **Validate Serula Web** (GitHub Actions) runs the full web production
   build (source integrity, JS worker syntax, WASM fingerprint, TypeScript,
   Vite) and the Vitest suite. The workflow also runs on pull requests and
   can be triggered manually. If prebuilt WASM is stale, CI rebuilds it.
2. **Workers Builds: nesting** (Cloudflare Git integration) builds and
   deploys the same repository branch using Cloudflare's own credentials.
   The Cloudflare build script checks source integrity, WASM binaries,
   TypeScript and Vite before deploying. It does **not** run Vitest.

**Important:** GitHub validation does not automatically block Cloudflare's
independent production deployment. Confirm both the GitHub Actions result
and the Cloudflare production build/deployment before announcing a release
as fully verified. A successful GitHub commit or live HTTP response alone
does not prove the latest commit is deployed.

## Cloudflare build configuration

Repository root: `/`

- Build: `bash web/scripts/build-cloudflare.sh`
- Deploy: `cd web && npx --yes wrangler@4 deploy`
- Non-production version: `cd web && npx --yes wrangler@4 versions upload`

No GitHub Actions Cloudflare token is required. The older deployment job
failed with API error 9109 because the token rejected the GitHub runner's
IP address; keep that network restriction and use Cloudflare Git integration.

The static `web/public/deploy-version.txt` is **not** a dynamic deployed
commit identifier. For exact release verification, inspect the commit
listed in Cloudflare Workers Builds against the GitHub `main` SHA.

## Windows/RDWorks release

The web Bridge installation command is distributed at
`web/public/downloads/Serula-Kur.cmd`; its contents must match the
source copy `integrations/windows/Serula-Kur.cmd`. The command pins the
PowerShell installer by immutable commit and Git blob hash. The installer
must retain newer installed bridge versions; the Windows bridge quality
workflow enforces these invariants. The separate Windows PC installer
has its own build workflow and versioned GitHub releases.

Treat an RDWorks import as **submitted, not cut-ready**, until the user
confirms the drawing, dimensions and layers within RDWorks. Bridge success
alone cannot prove a laser job will be correct.

Historical CI runs may show account billing locks before any build starts;
those are account-level conditions, not compilation failures.
