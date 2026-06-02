# Early Submission — Week 03 (PlugForge)

**Branch:** `gfa2_wk6-final` · **Date:** 2026-06-02

## Grader quick path

1. Deployed app: https://ship-web-jyqh.onrender.com/login (redeploy `gfa2_wk6-final` for latest platform routes).
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

6. CI: `.github/workflows/platform-gates.yml` + `mvp-gates.yml`

## Evidence

- Platform unit tests: `api/src/platform/oauth-device.test.ts`, `oauth-refresh.test.ts`, `webhooks-deliverer.test.ts`
- TTFE drill (with env): `pnpm drill:ttfe` — set `TTFE_BASE_URL`, `TTFE_CLIENT_ID`, optional `TTFE_DEVICE_CODE`

See [DELIVERABLES.md](./DELIVERABLES.md) for checklist status.
