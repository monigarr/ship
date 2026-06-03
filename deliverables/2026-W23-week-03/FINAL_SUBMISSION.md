# Final Submission — Week 03 (PlugForge)

**Branch:** `gfa2_wk6-final` · **Date:** 2026-06-03 · **Commit:** `24d964b47d63ec81425a28112c25873db5ab5cea`

## Deploy

| Item | Value |
| --- | --- |
| Public URL | https://ship-web-jyqh.onrender.com/login |
| OpenAPI | https://ship-web-jyqh.onrender.com/api/v1/openapi.json |
| Deploy branch | `gfa2_wk6-final` |
| Verify script | `node scripts/platform/verify-deploy.mjs` |
| Grader OAuth app | README § Week 03 (`client_id` + portal secret handoff) |

Redeploy Render from `gfa2_wk6-final` if post-MVP OpenAPI paths (`/webhooks`, `/oauth/device/*`) are missing on live.

## Demo video (3–5 min)

**Script:** [`DEMO_VIDEO_SCRIPT.md`](./DEMO_VIDEO_SCRIPT.md)  
**URL:** Paste after recording → [`SUBMISSION_URLS.md`](./SUBMISSION_URLS.md) (then copy into this file)

## Social post

**Draft:** [`SOCIAL_POST_DRAFT.md`](./SOCIAL_POST_DRAFT.md)  
**URL:** Paste after posting → [`SUBMISSION_URLS.md`](./SUBMISSION_URLS.md)

## Deploy (post-implementation)

Redeploy Render from `gfa2_wk6-final` per [`scripts/platform/DEPLOY_RENDER.md`](../../scripts/platform/DEPLOY_RENDER.md), then:

```bash
node scripts/platform/verify-deploy.mjs
```

## Evidence

| Artifact | Location |
| --- | --- |
| Full E2E regression | [`evidence/e2e-full-run-CONFIRM.log`](./evidence/e2e-full-run-CONFIRM.log) |
| Platform unit tests | [`evidence/platform-tests-CONFIRM.log`](./evidence/platform-tests-CONFIRM.log) |
| Perf regression | [`evidence/perf-regression-2026-06-03.log`](./evidence/perf-regression-2026-06-03.log) (measured query count via `run-perf-probe.mjs`) |
| Deploy verification | [`evidence/deploy-verify-2026-06-02.log`](./evidence/deploy-verify-2026-06-02.log) |
| CI workflows | [`.github/workflows/mvp-gates.yml`](../../.github/workflows/mvp-gates.yml), [`.github/workflows/platform-gates.yml`](../../.github/workflows/platform-gates.yml) |

## Written deliverables

- [`PRESEARCH.md`](./PRESEARCH.md) + [`AI_CONVERSATION_REFERENCE.md`](./AI_CONVERSATION_REFERENCE.md)
- [`docs/architecture.md`](../../docs/architecture.md)
- [`AI_COST_ANALYSIS.md`](./AI_COST_ANALYSIS.md)
- [`DISCOVERIES.md`](./DISCOVERIES.md)
- [`epics/`](./epics/) E1–E7

## Grader quick path

Same as [`EARLY_SUBMISSION.md`](./EARLY_SUBMISSION.md) plus demo video and social post URLs above.
