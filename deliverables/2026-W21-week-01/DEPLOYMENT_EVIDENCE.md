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

- **Status:** Documented.
- **Public app URL:** `https://ship-web-jyqh.onrender.com/`
- **Public API URL:** `https://ship-api-ejok.onrender.com/`
- **Evidence references in this branch:** `FLEETGRAPH_EVIDENCE_INDEX.md`, `QUICKSTART.md`, `render.yaml`
- **Access note:** authenticated FleetGraph runtime endpoints intentionally return `401` when no session is present.

## Verification Command Examples

- API health check:
  - `curl -i <PUBLIC_API_URL>/health`
- Frontend check:
  - Open `<PUBLIC_APP_URL>` and capture a timestamped screenshot.
