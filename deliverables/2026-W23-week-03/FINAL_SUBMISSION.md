# Final Submission — Week 03 (PlugForge)

**Branch:** `gfa2_wk6-final` / `master` (PR #3 merged) · **Date:** 2026-06-04 · **Commit:** `a928807` (merge PR #3)

## Deploy

| Item | Value |
| --- | --- |
| Public URL | https://ship-web-jyqh.onrender.com/login |
| OpenAPI | https://ship-web-jyqh.onrender.com/api/v1/openapi.json |
| Deploy branch | `gfa2_wk6-final` |
| Verify script | `node scripts/platform/verify-deploy.mjs` |
| Grader OAuth app | README § Week 03 (`client_id` + portal secret handoff) |

Render redeployed 2026-06-04 (GitLab `master` push → auto-deploy). Post-MVP OpenAPI paths verified green.

## Demo video (3–5 min)

**Script:** [`DEMO_VIDEO_SCRIPT.md`](./DEMO_VIDEO_SCRIPT.md)  
**URL:** _Pending — record after `node scripts/platform/verify-deploy.mjs` passes (green 2026-06-04)_ → paste in [`SUBMISSION_URLS.md`](./SUBMISSION_URLS.md)

## Social post

**Draft:** [`SOCIAL_POST_DRAFT.md`](./SOCIAL_POST_DRAFT.md)  
**URL:** Paste after posting → [`SUBMISSION_URLS.md`](./SUBMISSION_URLS.md)

## Deploy (verified 2026-06-04)

```bash
node scripts/platform/verify-deploy.mjs
node scripts/platform/run-prod-ttfe-smoke.mjs
```

Evidence: [`deploy-verify-2026-06-04.log`](./evidence/deploy-verify-2026-06-04.log) · [`prod-ttfe-smoke-2026-06-04.log`](./evidence/prod-ttfe-smoke-2026-06-04.log)

## Human code review (early submission)

**Pass** with follow-up resolved 2026-06-03: wire `PERF_PROBE_URL` for measured query counts — [`run-perf-probe.mjs`](../../scripts/mvp/run-perf-probe.mjs) · [PR #3](https://github.com/monigarr/ship/pull/3).

## Evidence

| Artifact | Location |
| --- | --- |
| Full E2E regression | [`evidence/e2e-full-run-CONFIRM.log`](./evidence/e2e-full-run-CONFIRM.log) |
| Platform unit tests | [`evidence/platform-tests-CONFIRM.log`](./evidence/platform-tests-CONFIRM.log) |
| Perf regression | [`evidence/perf-regression-2026-06-03.log`](./evidence/perf-regression-2026-06-03.log) (measured query count via `run-perf-probe.mjs`) |
| Deploy verification | [`evidence/deploy-verify-2026-06-04.log`](./evidence/deploy-verify-2026-06-04.log) |
| Production TTFE smoke | [`evidence/prod-ttfe-smoke-2026-06-04.log`](./evidence/prod-ttfe-smoke-2026-06-04.log) |
| CI workflows | [`.github/workflows/mvp-gates.yml`](../../.github/workflows/mvp-gates.yml), [`.github/workflows/platform-gates.yml`](../../.github/workflows/platform-gates.yml) |

## Written deliverables

- [`PRESEARCH.md`](./PRESEARCH.md) + [`AI_CONVERSATION_REFERENCE.md`](./AI_CONVERSATION_REFERENCE.md)
- [`docs/architecture.md`](../../docs/architecture.md)
- [`AI_COST_ANALYSIS.md`](./AI_COST_ANALYSIS.md)
- [`DISCOVERIES.md`](./DISCOVERIES.md)
- [`epics/`](./epics/) E1–E7

## Grader quick path

Same as [`EARLY_SUBMISSION.md`](./EARLY_SUBMISSION.md) plus demo video and social post URLs above.
