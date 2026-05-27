# 7. Build and Deploy

### 7.0 Area overview

- Status: [X] Complete
- Prompt: Build/deploy deep-dive summary for sections 7.1-7.4.
- Findings:
  - Deployment shape is hybrid:
    - Containerized API build artifacts via Docker.
    - Frontend static hosting/CDN patterns and AWS infrastructure via Terraform.
  - Local development supports both native and Dockerized workflows.
- Evidence (build/deploy root references):
  - `d:\GFA_Cohort_5\Week_Four\ship\README.md`
  - `d:\GFA_Cohort_5\Week_Four\ship\package.json`
  - `d:\GFA_Cohort_5\Week_Four\ship\terraform\`
- Open Questions:
  - Should a single canonical deployment path be enforced (EB vs ECS) to reduce ops divergence?
- Next Actions:
  - Add one authoritative deployment runbook that maps environment -> exact commands/artifacts.

### 7.1 Dockerfile output understanding

- Status: [X] Complete
- Prompt: Read the Dockerfile. What does the build process produce?
- Findings:
  - Primary `Dockerfile` produces a production API runtime image from pre-built monorepo artifacts:
    - Base: `public.ecr.aws/docker/library/node:20-slim`.
    - Installs production dependencies via pnpm workspaces.
    - Copies `shared/dist` and `api/dist`.
    - Exposes port `80`.
    - Starts with `node dist/db/migrate.js && node dist/index.js`.
  - `Dockerfile.dev` is a development API image that builds from source and runs migrations + seed + server.
  - `Dockerfile.web` is a development web image that runs Vite dev server with host binding.
- Evidence (build stages, final artifact image):
  - `d:\GFA_Cohort_5\Week_Four\ship\Dockerfile`
  - `d:\GFA_Cohort_5\Week_Four\ship\Dockerfile.dev`
  - `d:\GFA_Cohort_5\Week_Four\ship\Dockerfile.web`
- Open Questions:
  - Should production builds shift to a fully reproducible multi-stage Docker build (including compile in-image) rather than relying on pre-built `dist` copy?
- Next Actions:
  - Decide and document artifact provenance policy for prod image builds.

### 7.2 `docker-compose.yml` service topology

- Status: [X] Complete
- Prompt: Read the `docker-compose.yml`. What services does it start?
- Findings:
  - `docker-compose.yml` starts a single local PostgreSQL service:
    - `postgres:16`, DB `ship_dev`, user `ship`, password `ship_dev_password`, port mapping `5432:5432`, persistent volume, healthcheck.
  - `docker-compose.local.yml` starts full local stack:
    - `postgres` on host port `5433`,
    - `api` on `3000` (depends on healthy postgres),
    - `web` on `5173` (depends on api),
    - with environment wiring for DB URL, CORS, and API base URL.
- Evidence (services, ports, volumes, dependencies):
  - `d:\GFA_Cohort_5\Week_Four\ship\docker-compose.yml`
  - `d:\GFA_Cohort_5\Week_Four\ship\docker-compose.local.yml`
  - `d:\GFA_Cohort_5\Week_Four\ship\package.json` (`docker:up`, `docker:down`)
- Open Questions:
  - Should one compose file be designated as canonical to reduce confusion between DB-only and full-stack variants?
- Next Actions:
  - Add a quick “choose your compose mode” section in developer docs.

### 7.3 Terraform infrastructure expectations

- Status: [X] Complete
- Prompt: Skim the Terraform configs. What cloud infrastructure does the app expect?
- Findings:
  - Terraform requires v1.6+ with AWS and Random providers; state backend is S3 with encrypted state.
  - Expected AWS building blocks include:
    - VPC/networking and security groups,
    - Aurora Serverless v2 database,
    - Elastic Beanstalk app environment,
    - CloudFront + S3 frontend delivery,
    - SSM parameter distribution, plus WAF support.
  - Environment strategy:
    - `prod` creates its own VPC stack.
    - `dev` consumes shared VPC/subnet IDs from SSM and deploys app resources into that shared network.
- Evidence (modules/resources/backends):
  - `d:\GFA_Cohort_5\Week_Four\ship\terraform\versions.tf`
  - `d:\GFA_Cohort_5\Week_Four\ship\terraform\environments\prod\main.tf`
  - `d:\GFA_Cohort_5\Week_Four\ship\terraform\environments\dev\main.tf`
  - `d:\GFA_Cohort_5\Week_Four\ship\terraform\modules\`
- Open Questions:
  - Are all documented Terraform paths actively maintained, or are some legacy/deprecated?
- Next Actions:
  - Add a “supported Terraform targets” matrix (dev/shadow/prod) with ownership and status.

### 7.4 CI/CD pipeline overview

- Status: [X] Complete
- Prompt: How does the CI/CD pipeline work (if configured)?
- Findings:
  - No repository-local CI workflow definitions were found in common locations (`.github/workflows` absent; no CI YAML workflow files discovered).
  - CI expectations are implied via scripts/docs rather than in-repo pipeline config:
    - `package.json` provides build/test/type-check commands.
    - `CONTRIBUTING.md` references ensuring tests pass and CI checks.
  - Deployment automation appears to rely primarily on external infrastructure/process orchestration plus Terraform/IaC modules.
- Evidence (workflow files, pipeline stages):
  - `d:\GFA_Cohort_5\Week_Four\ship\package.json`
  - `d:\GFA_Cohort_5\Week_Four\ship\CONTRIBUTING.md`
  - Search evidence: no `.github` workflow files present in this checkout.
- Open Questions:
  - Is CI managed in a separate repository/service (e.g., organization-level pipelines) that should be linked in onboarding docs?
- Next Actions:
  - Document the canonical CI system location and required pipeline stages (type-check, unit, e2e, build, security scans).
