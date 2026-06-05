# Render redeploy (Week 03 post-MVP)

Production must serve OpenAPI paths including `/oauth/device/code` and `/issues`.

## Steps

1. Push branch `gfa2_wk6-final` to the remote Render watches (GitLab/GitHub connected to Render).
2. In [Render Dashboard](https://dashboard.render.com): open **ship-api** and **ship-web** → **Manual Deploy** → deploy latest commit on `gfa2_wk6-final`.
3. Wait for both services to reach **Live** (health check: `GET /health` → `{ "status": "ok" }`).
4. Verify locally:

```bash
node scripts/platform/verify-deploy.mjs https://ship-web-jyqh.onrender.com
```

Expected: all checks `OK`, exit code 0.

## Evidence

Save output to `deliverables/2026-W23-week-03/evidence/deploy-verify-YYYY-MM-DD.log` after a green run.
