# Deployment Evidence

## Deployment Runbook Source

- `DEPLOYMENT.md`
- `DEPLOYMENT_CHECKLIST.md`
- `scripts/deploy-infrastructure.sh`
- `scripts/deploy-api.sh`
- `scripts/deploy-frontend.sh`

## Environment Notes

- Deployment architecture and operational checklist are documented and reproducible from repository scripts.
- Security and compliance controls are documented in `DEPLOYMENT.md` (encryption, secret management, logging, network isolation).

## Public Accessibility Evidence

- **Status:** Pending operator-provided public URL confirmation in this branch package.
- **Required final artifact to attach:** production/staging URL + timestamped health check output + screenshot.

## Verification Command Examples

- API health check:
  - `curl -i <PUBLIC_API_URL>/health`
- Frontend check:
  - Open `<PUBLIC_APP_URL>` and capture a timestamped screenshot.
