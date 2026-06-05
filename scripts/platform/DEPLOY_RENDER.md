# Render redeploy (Week 03 post-MVP)

Production must serve OpenAPI paths including `/oauth/device/code` and `/issues`.

## Steps

1. Push `master` (or `gfa2_wk6-final`) to the remote Render watches (GitLab `monicapeters/ship` triggers auto-deploy when `autoDeploy: true` in `render.yaml`).
2. If auto-deploy does not run, use [Render Dashboard](https://dashboard.render.com): **ship-api** and **ship-web** → **Manual Deploy** → latest commit on `master` or `gfa2_wk6-final`.
3. Wait for both services to reach **Live** (health check: `GET /health` → `{ "status": "ok" }`).
4. Verify locally:

```bash
node scripts/platform/verify-deploy.mjs https://ship-web-jyqh.onrender.com
node scripts/platform/run-prod-ttfe-smoke.mjs
```

Expected: all checks `OK`, exit code 0. Full TTFE loop additionally requires `SHIP_PROD_EMAIL` and `SHIP_PROD_PASSWORD`.

## Evidence

Save output to `deliverables/2026-W23-week-03/evidence/deploy-verify-YYYY-MM-DD.log` after a green run.
