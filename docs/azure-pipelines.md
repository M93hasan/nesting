# Azure Pipelines integration

This repository can run its CI on Azure Pipelines without changing its Cloudflare deployment.

## Connect Azure DevOps to GitHub

1. Install the [Azure Pipelines GitHub App](https://github.com/marketplace/azure-pipelines) for the GitHub account that owns `M93hasan/nesting`. Grant access to this repository only if possible.
2. Open [Azure DevOps](https://dev.azure.com/), select or create an organization and project.
3. Open **Pipelines > New pipeline > GitHub**, authorize the GitHub connection, and select `M93hasan/nesting`.
4. Choose **Existing Azure Pipelines YAML file**, branch `main`, path `/azure-pipelines.yml`, then save and run.
5. Check the first build, including Microsoft-hosted agent availability and the GitHub status check.

The pipeline checks pushes and PRs targeting `main`. It uses Node.js 22, installs npm dependencies, verifies or rebuilds the pinned Rust/WASM assets when necessary, runs TypeScript and Vitest checks, performs a production build, and runs maintained Chromium Playwright tests. Successful builds upload `web/dist` as a pipeline artifact. The artifact is **not** automatically deployed.

## Deployment safety

- Production remains at `https://serula.site`, deployed by the existing Cloudflare/GitHub integration.
- There is no Azure-to-Cloudflare deployment step and no Azure credential is required for CI.
- The existing GitHub Actions workflows are left untouched.
- Pull requests from forks must not receive production credentials; this configuration does not use credentials.
- If the organization has no free Microsoft-hosted parallel jobs, configure suitable Azure agent capacity before expecting a build to run.

## Troubleshooting

If the pipeline is not triggered, confirm the Azure Pipelines GitHub App is installed with repository access and that the YAML pipeline was created in Azure DevOps. The YAML file alone does not create an Azure DevOps pipeline.

If WASM validation fails, confirm pinned Rust toolchain availability and that all four prebuilt WASM directories or source dependencies are available.

If Playwright fails, inspect the test job logs and the `playwright-test-results` artifact (when generated).
