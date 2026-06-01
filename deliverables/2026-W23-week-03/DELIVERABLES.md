# Week 03 Deliverables (High Level)

Source of truth: `deliverables/2026-W23-week-03/PRD.md`

## Required Deliverables

- **Architectural Defense checkpoint** delivered by Monday 1:00 PM CT.
- **MVP checkpoint** delivered by Tuesday 11:59 PM CT (all MVP hard-gate items complete).
- **Early Submission checkpoint** delivered by Friday 11:59 PM CT.
- **Final Submission checkpoint** delivered by Sunday 11:59 AM CT.

- **GitHub repository submission** that is public, preserves per-slice branches, and includes PR descriptions mapped to acceptance criteria with fitness-test confirmation.
- **Demo video (3-5 minutes)** showing the five-line developer story (`pnpm install @ship/sdk` -> `ship login` -> `ship docs create` -> `ship webhooks tail`) plus replay in the developer portal.
- **Pre-Search document** with all three phases completed, including attached AI conversation artifact.
- **Architecture document** (`docs/architecture.md`, 1-2 pages) covering module layout, SOLID rationale, composition root, boundary/flow diagrams, SDK surface, failure modes, and agent-as-citizen design.
- **OpenAPI specification deliverables**: live spec at `/api/openapi.json` on current deployed instance (transition target: `/api/v1/openapi.json` once public API rollout is deployed) and static copy at `docs/openapi.json`, validated against OpenAPI schema.
- **AI cost analysis** including development spend, production projections table, and explicit assumptions (webhook fanout, agent active rate, storage retention).
- **Per-epic write-up** using before -> fix -> after -> proof format, including TTFE CI proof for Epic 6 and OAuth app audit-log proof for Epic 7.
- **Three discoveries** documented from implementation learnings.
- **Deployed application** with public URL, pre-registered read-only OAuth app for graders, README credentials, reachable dev portal, and resolvable OpenAPI spec.
- **Social post** tagging `@GauntletAI`, with screenshot of verified signed event in `ship webhooks tail`.

## Build/Scope Completion Expectations Tied to Submission

- **Implement all MVP hard-gate requirements** (OAuth + PKCE, token middleware, scoped `/api/v1` routes, consistent ApiError shape, generated OpenAPI, SDK skeleton, regression/perf guardrails, public deployment).
- **Implement at least 5 integration/flow items** from the PRD list, including the **CLI device-flow tool as must-ship**.
- **Pass required testing scenarios**, including negative OAuth cases, route/spec/SDK fitness checks, webhook retry/DLQ/replay behavior, and TTFE drill outcomes.

## Reviewer Proof URLs + Actions

- **Repository and branch evidence**
  - **URL:** `https://labs.gauntletai.com/monicapeters/ship`
  - **Action:** Verify all Week 03 deliverable files exist in `deliverables/2026-W23-week-03/`, check commit history for MVP slices, and confirm final branch/MR contains implementation + tests + docs.

- **Merge request evidence**
  - **URL:** `https://labs.gauntletai.com/monicapeters/ship/-/merge_requests/new?merge_request%5Bsource_branch%5D=gfa2_wk6`
  - **Action:** Open/inspect the Week 03 MR and confirm description maps code/test artifacts to PRD acceptance criteria and hard-gate checklist items.

- **Deployed application evidence**
  - **URL:** `https://ship-web-jyqh.onrender.com/login`
  - **Action:** Log in as grader user, verify dev portal/UI loads, and confirm public platform paths are reachable from the deployed environment.

- **Live public OpenAPI contract evidence**
  - **URL:** `https://ship-web-jyqh.onrender.com/api/openapi.json`
  - **Action:** Confirm deployed OpenAPI document loads (current deployment path), then re-verify `/api/v1/openapi.json` after public API rollout to validate OAuth + `/api/v1` resource path coverage and expected error/security contract shape.

- **Local static OpenAPI artifact evidence**
  - **URL/File:** `docs/openapi.json`
  - **Action:** Compare static spec in repo with deployed `/api/openapi.json`; run `pnpm --filter @ship/api openapi:generate:public` to regenerate and prove deterministic spec output.

- **Swagger/internal docs reference evidence**
  - **URL:** `https://ship-web-jyqh.onrender.com/api/docs`
  - **Action:** Use this as supporting API context only; target grading surface for Week 03 public API remains `/api/v1/openapi.json` once that deployment is live.

- **OAuth app registration + one-time secret proof**
  - **URL:** `POST /api/v1/oauth/apps` (against deployed base URL)
  - **Action:** Register a grader app with read-only scopes, capture one-time `client_secret` reveal, and confirm only hashed secret persists in DB/operator logs.

- **Auth Code + PKCE hard-gate proof**
  - **URL/Flow:** `/api/v1/oauth/authorize` -> `/api/v1/oauth/token`
  - **Action:** Demonstrate successful PKCE exchange and mandatory negative case where wrong `code_verifier` returns `400 invalid_grant`.

- **Bearer middleware + scope enforcement proof**
  - **URL/Flow:** `/api/v1/me`, `/api/v1/documents`
  - **Action:** Verify missing/invalid token yields `401`, expired token yields distinct code, and insufficient scope yields `403` with explicit `missing_scope`.

- **ApiError shape proof**
  - **URL/Flow:** any failing `/api/v1/*` request
  - **Action:** Confirm all failures return `{ code, message, details?, request_id }` and include request correlation ID for traceability.

- **Fitness/unit test proof**
  - **URL/File:** `api/src/platform/public-api-fitness.test.ts`, `api/src/platform/public-api-mvp.test.ts`, `api/src/platform/openapi-schema.test.ts`
  - **Action:** Run `pnpm --filter @ship/api test` (with DB available) and capture passing output showing route parity, schema validation, OAuth hard-gates, and error-shape assertions.

- **Playwright E2E OAuth proof**
  - **URL/File:** `e2e/oauth-pkce.spec.ts`
  - **Action:** Run `pnpm test:e2e --grep "OAuth Authorization Code + PKCE"` and attach pass output proving happy path + invalid verifier negative path.

- **SDK contract proof**
  - **URL/File:** `sdk/src/client.ts`, `sdk/src/client.test.ts`
  - **Action:** Run `pnpm --filter @ship/sdk test` and demonstrate `new ShipClient({ token }).me()` returns typed authenticated user payload.

- **FleetGraph reviewer feedback closure proof**
  - **URL/File:** `api/src/services/fleetgraph/runtime.ts`, `api/src/services/fleetgraph/runtime.test.ts`, `web/src/components/sidebars/FleetGraphAssistant.tsx`
  - **Action:** Demonstrate same issue context returns distinct responses for “current blockers” vs “describe issue” (intent-aware routing, not stale finding-template fallback).

- **Performance regression budget proof (+10%)**
  - **URL/File:** `scripts/mvp/perf-regression-check.mjs`, `deliverables/2026-W23-week-03/perf-baseline.json`
  - **Action:** Run perf comparison against baseline and capture report proving P95 latency, bundle size, and query count are within threshold.

- **CI gate proof**
  - **URL/File:** `.github/workflows/mvp-gates.yml`
  - **Action:** Verify workflow runs unit/fitness/e2e/perf checks on PR; attach green pipeline URL/screenshots in submission evidence.

- **Documentation deliverables proof**
  - **URL/Files:** `deliverables/2026-W23-week-03/ARCHITECTURE_DEFENSE.md`, `deliverables/2026-W23-week-03/ARCHITECTURE_TEMPLATE.md`, `deliverables/2026-W23-week-03/PRESEARCH.md`, `deliverables/2026-W23-week-03/PRD.md`
  - **Action:** Confirm all required written artifacts are complete, current, and aligned with implemented behavior and test evidence.

- **Final submission package proof**
  - **URL/Files:** repo root + `deliverables/2026-W23-week-03/`
  - **Action:** Verify demo video link, social post link/screenshot, AI cost analysis, per-epic write-up evidence, three discoveries, and grader credentials are all present before handoff.

## Grader Checklist (Quick Verify)

Use this checklist before submission. Source of truth is `deliverables/2026-W23-week-03/PRD.md`.

- [ ] **Checkpoint readiness:** Architectural Defense, MVP, Early Submission, and Final Submission artifacts are complete and present. **Evidence Link:** [Architecture Defense](https://labs.gauntletai.com/monicapeters/ship/-/blob/gfa2_wk6/deliverables/2026-W23-week-03/ARCHITECTURE_DEFENSE.md), [Week 03 PRD](https://labs.gauntletai.com/monicapeters/ship/-/blob/gfa2_wk6/deliverables/2026-W23-week-03/PRD.md)
- [ ] **Public repo/MR ready:** Branch history is clean, PR/MR description maps slices to PRD acceptance criteria, and evidence links are included. **Evidence Link:** [Repository](https://labs.gauntletai.com/monicapeters/ship), [Week 03 MR (gfa2_wk6)](https://labs.gauntletai.com/monicapeters/ship/-/merge_requests/new?merge_request%5Bsource_branch%5D=gfa2_wk6)
- [ ] **Deployed app reachable:** Live app URL works and grader can authenticate. **Evidence Link:** [Deployed Login](https://ship-web-jyqh.onrender.com/login)
- [ ] **Public OpenAPI live (current deploy path):** `/api/openapi.json` resolves on deployed environment. **Evidence Link:** [Live Public OpenAPI](https://ship-web-jyqh.onrender.com/api/openapi.json)
- [ ] **Static OpenAPI committed:** `docs/openapi.json` exists and matches generated output. **Evidence Link:** [Static OpenAPI File](https://labs.gauntletai.com/monicapeters/ship/-/blob/gfa2_wk6/docs/openapi.json), [Public OpenAPI Generator Script](https://labs.gauntletai.com/monicapeters/ship/-/blob/gfa2_wk6/api/src/scripts/generate-public-openapi.ts)
- [ ] **OAuth app registration works:** Admin can register app, receives `client_id`, sees raw `client_secret` exactly once, and secret is hashed at rest. **Evidence Link:** [OAuth Routes](https://labs.gauntletai.com/monicapeters/ship/-/blob/gfa2_wk6/api/src/platform/routes/oauth.ts), [OAuth Service](https://labs.gauntletai.com/monicapeters/ship/-/blob/gfa2_wk6/api/src/platform/oauth.ts), [OAuth Migration](https://labs.gauntletai.com/monicapeters/ship/-/blob/gfa2_wk6/api/src/db/migrations/047_oauth_public_platform.sql)
- [ ] **Authorization Code + PKCE works:** End-to-end auth flow succeeds. **Evidence Link:** [OAuth Flow Implementation](https://labs.gauntletai.com/monicapeters/ship/-/blob/gfa2_wk6/api/src/platform/routes/oauth.ts), [Playwright PKCE Spec](https://labs.gauntletai.com/monicapeters/ship/-/blob/gfa2_wk6/e2e/oauth-pkce.spec.ts), [MVP API Test](https://labs.gauntletai.com/monicapeters/ship/-/blob/gfa2_wk6/api/src/platform/public-api-mvp.test.ts)
- [ ] **PKCE negative case works:** Wrong `code_verifier` returns `400 invalid_grant`. **Evidence Link:** [Playwright PKCE Negative Case](https://labs.gauntletai.com/monicapeters/ship/-/blob/gfa2_wk6/e2e/oauth-pkce.spec.ts), [MVP API Negative Case](https://labs.gauntletai.com/monicapeters/ship/-/blob/gfa2_wk6/api/src/platform/public-api-mvp.test.ts)
- [ ] **Bearer auth enforcement works:** Missing token -> `401`, invalid token -> `401`, expired token -> `401` with distinct expired code. **Evidence Link:** [Bearer Middleware](https://labs.gauntletai.com/monicapeters/ship/-/blob/gfa2_wk6/api/src/platform/oauth.ts), [MVP API Auth Assertions](https://labs.gauntletai.com/monicapeters/ship/-/blob/gfa2_wk6/api/src/platform/public-api-mvp.test.ts)
- [ ] **Scope enforcement works:** Insufficient scope returns `403` with explicit missing scope in response body. **Evidence Link:** [Scope Registry](https://labs.gauntletai.com/monicapeters/ship/-/blob/gfa2_wk6/api/src/platform/scopes.ts), [Scope Enforcement Middleware](https://labs.gauntletai.com/monicapeters/ship/-/blob/gfa2_wk6/api/src/platform/oauth.ts), [Scope Tests](https://labs.gauntletai.com/monicapeters/ship/-/blob/gfa2_wk6/api/src/platform/public-api-mvp.test.ts)
- [ ] **Documents MVP routes work:** `/api/v1/documents` supports list/get/create under scope checks. **Evidence Link:** [Public Documents Routes](https://labs.gauntletai.com/monicapeters/ship/-/blob/gfa2_wk6/api/src/platform/routes/v1/documents.ts), [Documents MVP Tests](https://labs.gauntletai.com/monicapeters/ship/-/blob/gfa2_wk6/api/src/platform/public-api-mvp.test.ts)
- [ ] **Cursor pagination contract works:** List responses follow `{ data, next_cursor }`. **Evidence Link:** [Cursor Pagination Implementation](https://labs.gauntletai.com/monicapeters/ship/-/blob/gfa2_wk6/api/src/platform/routes/v1/documents.ts), [Cursor Contract Tests](https://labs.gauntletai.com/monicapeters/ship/-/blob/gfa2_wk6/api/src/platform/public-api-mvp.test.ts)
- [ ] **ApiError contract is consistent:** All `/api/v1` failures return `{ code, message, details?, request_id }`. **Evidence Link:** [Public API Error Shape](https://labs.gauntletai.com/monicapeters/ship/-/blob/gfa2_wk6/api/src/platform/http.ts), [Public Router Error Handling](https://labs.gauntletai.com/monicapeters/ship/-/blob/gfa2_wk6/api/src/platform/router.ts), [Fitness Error Assertions](https://labs.gauntletai.com/monicapeters/ship/-/blob/gfa2_wk6/api/src/platform/public-api-fitness.test.ts)
- [ ] **OpenAPI generation is code-driven:** Spec is generated from route metadata/schemas, not hand-written. **Evidence Link:** [Route Metadata Registry](https://labs.gauntletai.com/monicapeters/ship/-/blob/gfa2_wk6/api/src/platform/spec/route-metadata.ts), [OpenAPI Generator](https://labs.gauntletai.com/monicapeters/ship/-/blob/gfa2_wk6/api/src/platform/spec/openapi.ts)
- [ ] **OpenAPI schema validation passes:** Unit test validates generated OpenAPI document against schema. **Evidence Link:** [OpenAPI Schema Test](https://labs.gauntletai.com/monicapeters/ship/-/blob/gfa2_wk6/api/src/platform/openapi-schema.test.ts)
- [ ] **SDK package exists:** `@ship/sdk` workspace package is present and buildable. **Evidence Link:** [SDK Package](https://labs.gauntletai.com/monicapeters/ship/-/blob/gfa2_wk6/sdk/package.json), [Workspace Registration](https://labs.gauntletai.com/monicapeters/ship/-/blob/gfa2_wk6/pnpm-workspace.yaml)
- [ ] **SDK `me()` works:** `new ShipClient({ token }).me()` returns typed authenticated user. **Evidence Link:** [SDK Client](https://labs.gauntletai.com/monicapeters/ship/-/blob/gfa2_wk6/sdk/src/client.ts), [SDK Client Test](https://labs.gauntletai.com/monicapeters/ship/-/blob/gfa2_wk6/sdk/src/client.test.ts)
- [ ] **Route/spec/SDK parity tests pass:** Fitness checks confirm route coverage and contract consistency. **Evidence Link:** [Public API Fitness Test](https://labs.gauntletai.com/monicapeters/ship/-/blob/gfa2_wk6/api/src/platform/public-api-fitness.test.ts), [Public API MVP Test](https://labs.gauntletai.com/monicapeters/ship/-/blob/gfa2_wk6/api/src/platform/public-api-mvp.test.ts)
- [ ] **Playwright/E2E PKCE tests pass:** Includes both positive and mandatory negative path. **Evidence Link:** [Playwright PKCE E2E](https://labs.gauntletai.com/monicapeters/ship/-/blob/gfa2_wk6/e2e/oauth-pkce.spec.ts)
- [ ] **FleetGraph chat reviewer feedback resolved:** Blocker questions and issue-description questions produce distinct, intent-correct outputs. **Evidence Link:** [FleetGraph Runtime](https://labs.gauntletai.com/monicapeters/ship/-/blob/gfa2_wk6/api/src/services/fleetgraph/runtime.ts), [FleetGraph Assistant UI](https://labs.gauntletai.com/monicapeters/ship/-/blob/gfa2_wk6/web/src/components/sidebars/FleetGraphAssistant.tsx)
- [ ] **FleetGraph regression tests added/passing:** Paired-prompt test proves no stale finding-template collapse. **Evidence Link:** [FleetGraph Runtime Tests](https://labs.gauntletai.com/monicapeters/ship/-/blob/gfa2_wk6/api/src/services/fleetgraph/runtime.test.ts)
- [ ] **Performance budget enforced:** P95 latency, bundle size, and query metrics are within +10% vs baseline. **Evidence Link:** [Perf Regression Script](https://labs.gauntletai.com/monicapeters/ship/-/blob/gfa2_wk6/scripts/mvp/perf-regression-check.mjs), [Perf Baseline](https://labs.gauntletai.com/monicapeters/ship/-/blob/gfa2_wk6/deliverables/2026-W23-week-03/perf-baseline.json)
- [ ] **CI gate exists and passes:** Workflow runs MVP tests (unit/fitness/e2e/perf) and is green. **Evidence Link:** [MVP Gates Workflow](https://labs.gauntletai.com/monicapeters/ship/-/blob/gfa2_wk6/.github/workflows/mvp-gates.yml)
- [ ] **Required docs complete:** Pre-Search, Architecture doc content, AI cost analysis, per-epic write-up, and discoveries are complete and current. **Evidence Link:** [Presearch](https://labs.gauntletai.com/monicapeters/ship/-/blob/gfa2_wk6/deliverables/2026-W23-week-03/PRESEARCH.md), [Architecture Template](https://labs.gauntletai.com/monicapeters/ship/-/blob/gfa2_wk6/deliverables/2026-W23-week-03/ARCHITECTURE_TEMPLATE.md), [Architecture Defense](https://labs.gauntletai.com/monicapeters/ship/-/blob/gfa2_wk6/deliverables/2026-W23-week-03/ARCHITECTURE_DEFENSE.md), [Deliverables](https://labs.gauntletai.com/monicapeters/ship/-/blob/gfa2_wk6/deliverables/2026-W23-week-03/DELIVERABLES.md)
- [ ] **Demo video complete (3-5 min):** Demonstrates five-line developer story plus dev portal replay. **Evidence Link:** [Demo Video](https://<your-video-url>)
- [ ] **Pre-registered grader OAuth app provided:** Read-only scopes and secure credential handoff documented. **Evidence Link:** [README](https://labs.gauntletai.com/monicapeters/ship/-/blob/gfa2_wk6/README.md), [Deployment Guide](https://labs.gauntletai.com/monicapeters/ship/-/blob/gfa2_wk6/DEPLOYMENT.md)
- [ ] **Social post complete:** Includes required tag and screenshot of verified signed webhook event. **Evidence Link:** [Social Post](https://<your-social-post-url>)
- [ ] **Final evidence packet complete:** All links, logs, screenshots, and test outputs needed for grading are included and accessible. **Evidence Link:** [Week 03 Deliverables Folder](https://labs.gauntletai.com/monicapeters/ship/-/tree/gfa2_wk6/deliverables/2026-W23-week-03)
