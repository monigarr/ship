# Final Submission — Week 03 (PlugForge)

**Branch:** `gfa2_wk6-final` · **Date:** 2026-06-02 · **Commit:** _update after push to Render_

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

**URL:** _Add after recording (YouTube/Loom unlisted)_

## Social post

**Draft:** [`SOCIAL_POST_DRAFT.md`](./SOCIAL_POST_DRAFT.md)

**URL:** _Add after posting (@GauntletAI + webhook tail screenshot)_

## Evidence

| Artifact | Location |
| --- | --- |
| Full E2E regression | [`evidence/e2e-full-run-CONFIRM.log`](./evidence/e2e-full-run-CONFIRM.log) |
| Platform unit tests | [`evidence/platform-tests-CONFIRM.log`](./evidence/platform-tests-CONFIRM.log) |
| Perf regression | [`evidence/perf-regression-2026-06-02.log`](./evidence/perf-regression-2026-06-02.log) |
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
