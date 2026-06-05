# Early Submission — Week 03 (PlugForge)

**Branch:** `gfa2_wk6-final` · **Date:** 2026-06-03

## Grader quick path

1. Deployed app: https://ship-web-jyqh.onrender.com/login (ensure Render deploys branch **`gfa2_wk6-final`**, commit `1a23ea8`+ for measured perf probe).
2. Public OpenAPI: https://ship-web-jyqh.onrender.com/api/v1/openapi.json
3. Developer portal (session): `/developer` after login
4. Device verify UX: `/oauth/device`
5. CLI (local):

```bash
export SHIP_API_URL=https://ship-web-jyqh.onrender.com
export SHIP_CLIENT_ID=<your_app_client_id>
pnpm install
pnpm --filter @ship/cli build
ship login
ship docs create --title "hello"
ship webhooks tail
```

6. CI: `.github/workflows/platform-gates.yml` + `mvp-gates.yml` (perf probe after build, before Playwright)
7. Perf: `node scripts/mvp/run-perf-probe.mjs` → [`evidence/perf-regression-2026-06-03.log`](./evidence/perf-regression-2026-06-03.log)

## Evidence

- Platform unit tests: `api/src/platform/oauth-device.test.ts`, `oauth-refresh.test.ts`, `webhooks-deliverer.test.ts`
- TTFE drill (with env): `pnpm drill:ttfe` — set `TTFE_BASE_URL`, `TTFE_CLIENT_ID`, optional `TTFE_DEVICE_CODE`

See [DELIVERABLES.md](./DELIVERABLES.md) for checklist status.
