# AWS Consolidation Baseline

This document captures the pre-consolidation AWS deployment surface so migration can proceed without breaking existing operator workflows.

## Deployment Entry Points (Baseline)

| Script | Current Role | Environment Support | Notes |
| --- | --- | --- | --- |
| `scripts/deploy.sh` | API deploy (newer) | `dev`, `shadow`, `prod` | Canonical candidate for API deploys. |
| `scripts/deploy-web.sh` | Frontend deploy (newer) | `dev`, `shadow`, `prod` | Canonical candidate for frontend deploys. |
| `scripts/terraform.sh` | Terraform wrapper | `dev`, `prod` | Uses split logic and legacy prod root path. |
| `scripts/deploy-api.sh` | API deploy (legacy) | implicit/legacy defaults | Duplicates behavior with older packaging/deploy flow. |
| `scripts/deploy-frontend.sh` | Frontend deploy (legacy) | `dev`, `prod` | Duplicates `deploy-web.sh`. |
| `scripts/deploy-infrastructure.sh` | Terraform apply helper | implicit/legacy | Out of sync with env-aware Terraform sync script. |

## Terraform Layout (Baseline)

| Path | Status | Notes |
| --- | --- | --- |
| `terraform/environments/dev` | Active | Shared VPC via SSM params under `/infra/dev/*`. |
| `terraform/environments/shadow` | Active | UAT/migration environment. |
| `terraform/environments/prod` | Active | Dedicated VPC, modular stack. |
| `terraform/` root | Legacy but active in tooling/docs | Contains monolithic resources and extra behaviors (WAF/realtime logging). |

## Runtime Config Contract (Baseline)

### SSM parameters loaded by API startup

- `/ship/{env}/DATABASE_URL`
- `/ship/{env}/SESSION_SECRET`
- `/ship/{env}/CORS_ORIGIN`
- `/ship/{env}/CDN_DOMAIN`
- `/ship/{env}/APP_BASE_URL`

### Gap identified

- API file upload path in `api/src/routes/files.ts` requires `S3_UPLOADS_BUCKET` in production, but Terraform/SSM baseline did not consistently propagate it into runtime env loading.

## Consolidation Target

1. Canonical API deploy: `scripts/deploy.sh <dev|shadow|prod>`
2. Canonical frontend deploy: `scripts/deploy-web.sh <dev|shadow|prod>`
3. Canonical Terraform interface: `scripts/terraform.sh <dev|shadow|prod> <terraform args...>`
4. Legacy scripts preserved as wrappers for compatibility window.
5. `terraform/environments/*` becomes the source of truth; root monolithic path becomes compatibility-only.
