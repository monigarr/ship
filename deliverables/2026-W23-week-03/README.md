# Week 03 — PlugForge (Developer Platform)

**Branch:** `gfa2_wk6-final` · **PRD:** [`PRD.md`](./PRD.md)

## Reviewer entry points

| Document | Purpose |
| --- | --- |
| [`DELIVERABLES.md`](./DELIVERABLES.md) | Status tracker + grader checklist |
| [`EARLY_SUBMISSION.md`](./EARLY_SUBMISSION.md) | Friday checkpoint quick path |
| [`FINAL_SUBMISSION.md`](./FINAL_SUBMISSION.md) | Sunday submission handoff |
| [`docs/architecture.md`](../../docs/architecture.md) | Canonical architecture (PRD path) |

## Live proof

- App: https://ship-web-jyqh.onrender.com/login
- OpenAPI: https://ship-web-jyqh.onrender.com/api/v1/openapi.json
- Developer portal: `/developer` (after login)
- Device verify: `/oauth/device`

## Verify deployment

```bash
node scripts/platform/verify-deploy.mjs
```

## Perf regression (PRD MVP item 9)

```bash
pnpm build:api && pnpm build:web
pnpm --filter @ship/api db:migrate && pnpm --filter @ship/api db:seed
node scripts/mvp/run-perf-probe.mjs
node scripts/mvp/perf-regression-check.mjs
```

Evidence: [`evidence/perf-regression-2026-06-03.log`](./evidence/perf-regression-2026-06-03.log) · measured `queryCountPerRoute=4` via live `PERF_PROBE_URL` probe.

## CLI five-line story

```bash
export SHIP_API_URL=https://ship-web-jyqh.onrender.com
export SHIP_CLIENT_ID=<your_app_client_id>
pnpm install && pnpm --filter @ship/cli build
ship login
ship docs create --title "hello"
ship webhooks tail
```
