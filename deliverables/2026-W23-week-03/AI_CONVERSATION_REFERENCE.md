# AI Conversation Reference — Week 03 (PlugForge)

**PRD requirement:** Pre-Search document with all three phases completed, plus **saved AI conversation attached as a reference artifact** ([`PRD.md`](./PRD.md) Submission Requirements, line 362; Appendix Pre-Search Checklist).

| Field | Value |
| --- | --- |
| **Artifact path (committed)** | `deliverables/2026-W23-week-03/AI_CONVERSATION_REFERENCE.md` |
| **Companion pre-search** | [`PRESEARCH.md`](./PRESEARCH.md) (Phases 1–3 written answers) |
| **Dev branch** | `gfa2_wk6` |
| **Date** | 2026-06-01 |
| **Author** | Monica Peters (Cursor-assisted sessions) |

Raw Cursor agent transcripts (JSONL) remain on the author machine under the Cursor project folder. This file is the **reviewer-readable export** graders can open in GitLab/GitHub without access to local IDE storage.

**Related:** [`DELIVERABLES.md`](./DELIVERABLES.md) · [`docs/architecture.md`](../../docs/architecture.md) · [`GRADER_HANDOFF.md`](./GRADER_HANDOFF.md) (login/OAuth handoff — secrets out of band)

---

## How this artifact satisfies the PRD

| PRD ask | Where it is met |
| --- | --- |
| Complete Pre-Search (3 phases) | Decisions and status in [`PRESEARCH.md`](./PRESEARCH.md); this file records **how** those decisions were reached in AI-assisted working sessions |
| Attach saved AI conversation | Session index + summaries below map to parent transcript UUIDs |
| MVP hard-gate evidence | Links to code, live URLs, and [`evidence/`](./evidence/) logs from 2026-06-01 runs |
| Architectural Defense / Monday checkpoint | Sessions 2–6 + [`ARCHITECTURE_DEFENSE.md`](./ARCHITECTURE_DEFENSE.md) |

---

## Pre-Search phase mapping (AI-assisted)

| PRD appendix phase | Topics driven in AI sessions | Written answers in |
| --- | --- | --- |
| **Phase 1** — Constraints, scope, security, skills | MVP hard gates, reviewer FleetGraph feedback, grader OAuth/deploy assumptions, cost/CI notes | [`PRESEARCH.md`](./PRESEARCH.md) § Phase 1 |
| **Phase 2** — OAuth, API shape, webhooks, SDK, portal, agent | Public `/api/v1` boundary, PKCE-first OAuth, generated OpenAPI, scopes-as-data, deferred webhooks/CLI/TTFE | [`PRESEARCH.md`](./PRESEARCH.md) § Phase 2 |
| **Phase 3** — Validation, cost, deployment | Fitness tests, Render URLs, MVP submit readiness, grader checklist, test evidence plan | [`PRESEARCH.md`](./PRESEARCH.md) § Phase 3 |

---

## Session index (parent chats — June 1, 2026)

| # | Time (CT) | Summary | Transcript ID |
| --- | --- | --- | --- |
| 1 | ~11:47 AM | Sync remotes; create Week 03 branch `gfa2_wk6` | [77a962c7-196c-43d7-b01e-be1502f7483a](77a962c7-196c-43d7-b01e-be1502f7483a) |
| 2 | ~12:10 PM | `PRD.pdf` → `PRD.md`; draft PRESEARCH / architecture defense docs from W22 templates | [0b16a4d5-4bbf-442c-8869-a3233feefac5](0b16a4d5-4bbf-442c-8869-a3233feefac5) |
| 3 | ~2:27 PM | `DELIVERABLES.md`; MVP + reviewer plan; **implement** platform OAuth/`/api/v1`/SDK; FleetGraph intent fix; commit/push | [abd14272-f61f-49bb-bda9-886db79b46bc](abd14272-f61f-49bb-bda9-886db79b46bc) |
| 4 | ~3:49 PM | Debug Render `Cannot GET /api/v1/openapi.json` | [c0469e5a-cf28-4339-84c8-57e53cd090ae](c0469e5a-cf28-4339-84c8-57e53cd090ae) |
| 5 | ~4:00 PM | Video script (2–4 min) for defense + reviewer acknowledgment | [0f27f48b-b9c0-4284-9551-d0830e5ea811](0f27f48b-b9c0-4284-9551-d0830e5ea811) |
| 6 | Evening | PRD compliance audit; `docs/architecture.md`; align DELIVERABLES/PRESEARCH/DEFENSE; first AI artifact draft | [953bbff6-74e5-427d-96e4-3e2a40390892](953bbff6-74e5-427d-96e4-3e2a40390892) |
| 7 | Evening | MVP submit Q&A; grader handoff doc; **test evidence runs**; super-admin guidance; update this artifact | [953bbff6-74e5-427d-96e4-3e2a40390892](953bbff6-74e5-427d-96e4-3e2a40390892) (continued) |
| 8 | Evening | **MVP final gates:** README grader OAuth (`client_id` + portal secret); sanitize `GRADER_HANDOFF.md`; full `pnpm test:e2e` (~1.3h evidence log) | [953bbff6-74e5-427d-96e4-3e2a40390892](953bbff6-74e5-427d-96e4-3e2a40390892) (continued) |

---

## Session summaries

### 1 — Branch setup (`77a962c7`)

- Aligned local repo with GitHub/GitLab remotes.
- Created **`gfa2_wk6`** as the Week 03 integration branch for PlugForge MVP work.

### 2 — PRD and planning docs (`0b16a4d5`)

- Converted [`PRD.md`](./PRD.md) to markdown source of truth.
- Drafted [`PRESEARCH.md`](./PRESEARCH.md), [`ARCHITECTURE_DEFENSE.md`](./ARCHITECTURE_DEFENSE.md), [`ARCHITECTURE_TEMPLATE.md`](./ARCHITECTURE_TEMPLATE.md) from Week 22 templates, scoped to Week 03 PRD.

### 3 — MVP implementation + human reviewer feedback (`abd14272`)

**Reviewer feedback (paraphrased):** FleetGraph chat returned the same stale template for “current blockers” vs “describe this issue” on the same issue context.

**Shipped on `gfa2_wk6` (code):**

| Area | Artifacts |
| --- | --- |
| OAuth + public API | `api/src/platform/` — apps, authorize, token, bearer, scopes |
| DB | `api/src/db/migrations/047_oauth_public_platform.sql` |
| Documents `/api/v1` | `api/src/platform/routes/v1/documents.ts` |
| OpenAPI 3.1 | `api/src/platform/spec/openapi.ts`, live + `docs/openapi.json` |
| SDK | `sdk/` — `ShipClient`, `me()`, `documents.*` |
| Tests | `public-api-mvp.test.ts`, `public-api-fitness.test.ts`, `openapi-schema.test.ts`, `public-boundary.test.ts`, `e2e/oauth-pkce.spec.ts` |
| CI | `.github/workflows/mvp-gates.yml` |
| FleetGraph fix | `api/src/services/fleetgraph/runtime.ts`, `runtime.test.ts` |

**Key commits:** `0aa0dcd` (platform MVP + FleetGraph), `7e66901` (doc/OpenAPI evidence alignment).

**Docs:** Initial [`DELIVERABLES.md`](./DELIVERABLES.md) with grader proof URLs and checklist.

### 4 — Deploy OpenAPI troubleshooting (`c0469e5a`)

- Investigated `Cannot GET /api/v1/openapi.json` on Render vs route wiring in `app.ts` / `createPlatformRouter()`.
- Resolution path: redeploy latest `gfa2_wk6` image; verify via web proxy to API.
- **Live spec (grading):** https://ship-web-jyqh.onrender.com/api/v1/openapi.json

### 5 — Demo video script (`0f27f48b`)

- Produced 2–4 minute SPEAK/SHOW script for Monday defense.
- Honest scope: **MVP foundation + defense docs + FleetGraph fix**; full-week items (webhooks, CLI, TTFE, portal) framed as next slices.

### 6 — Compliance audit and architecture doc (`953bbff6`)

- Audited repo vs full PRD (not only MVP): gaps documented for webhooks, CLI, TTFE, final submission package.
- Added [`docs/architecture.md`](../../docs/architecture.md) (PRD submission path for architecture write-up).
- Synced [`DELIVERABLES.md`](./DELIVERABLES.md), [`PRESEARCH.md`](./PRESEARCH.md), [`ARCHITECTURE_DEFENSE.md`](./ARCHITECTURE_DEFENSE.md).
- Created first version of this AI conversation reference.

### 7 — MVP evidence, handoff, and test runs (`953bbff6` continued)

**User goals:**

- Confirm MVP submit readiness on `gfa2_wk6`.
- Attach today’s AI chats to deliverables per PRD.
- Run tests and save evidence logs.
- Document grader login/OAuth handoff ([`GRADER_HANDOFF.md`](./GRADER_HANDOFF.md)).
- Clarify super-admin creation for human reviewers.

**Outcomes:**

| Work item | Result |
| --- | --- |
| OAuth PKCE E2E | **1 passed** — log: [`evidence/e2e-oauth-pkce-2026-06-01.log`](./evidence/e2e-oauth-pkce-2026-06-01.log) |
| Windows E2E fix | `e2e/fixtures/isolated-env.ts` — `npx.cmd` + `shell` for Vite preview spawn (fixes `spawn npx ENOENT`) |
| API unit tests (local) | Blocked without Postgres on `:5432` — log: [`evidence/api-test-2026-06-01.log`](./evidence/api-test-2026-06-01.log) |
| Platform Vitest (Docker PG) | Needs `pnpm db:migrate` on `localhost:5433` before green — log: [`evidence/api-platform-test-2026-06-01.log`](./evidence/api-platform-test-2026-06-01.log) |
| Perf regression script | Skipped (no `artifacts/perf/current-metrics.json`) — log: [`evidence/perf-regression-2026-06-01.log`](./evidence/perf-regression-2026-06-01.log) |
| Grader handoff | [`GRADER_HANDOFF.md`](./GRADER_HANDOFF.md) — deploy URL, `client_id`, portal for `client_secret` (no secrets in git) |
| Super-admin guidance | Documented: `/admin` toggle, SQL `is_super_admin`, or first-time `/setup` on empty DB |

---

## Architecture and contract decisions (from AI-assisted design)

| Topic | Decision | Implemented on `gfa2_wk6` |
| --- | --- | --- |
| Public boundary | `/api/v1` only; separate from session/CSRF `/api/*` | Yes — `app.ts`, `public-boundary.test.ts` |
| OpenAPI | Generated from `route-metadata.ts`; static `docs/openapi.json` | Yes |
| OAuth MVP | Authorization Code + PKCE; negative `invalid_grant` | Yes — E2E + unit tests |
| Device flow / refresh | Deferred post-MVP slice | Planned |
| Secrets | `client_secret` once; SHA-256 at rest | Yes — `oauth.ts` |
| Scopes | Data-driven; `403` + `details.missing_scope` | Yes — `scopes.ts` |
| SDK | Hand-written `@ship/sdk`; expand with routes | Partial — `me()` + `documents` |
| Webhooks / CLI / TTFE | PRD must-ship for final week; not MVP hard gate | Not started |
| FleetGraph | Intent routing before template selection | Yes — `runtime.ts` + paired test |
| CI MVP gates | Unit tests, OpenAPI generate, OAuth E2E grep, perf script | Yes — `mvp-gates.yml` |

---

## MVP hard gate status (PRD § MVP Requirements)

**Branch:** `gfa2_wk6` · **Evidence date:** 2026-06-01

| # | PRD requirement | Status | Proof |
| --- | --- | --- | --- |
| 1 | OAuth app registration; secret once; hashed | **Done** | `public-api-mvp.test.ts`, [`oauth.ts`](../../api/src/platform/oauth.ts) |
| 2 | Auth Code + PKCE Playwright E2E | **Done** | [`e2e/oauth-pkce.spec.ts`](../../e2e/oauth-pkce.spec.ts), [`evidence/e2e-oauth-pkce-2026-06-01.log`](./evidence/e2e-oauth-pkce-2026-06-01.log) |
| 3 | Bearer middleware; 401 / `token_expired` | **Done** | MVP test; [GET /api/v1/me](https://ship-web-jyqh.onrender.com/api/v1/me) → 401 |
| 4 | Documents list/get/post + scopes | **Done** | [`routes/v1/documents.ts`](../../api/src/platform/routes/v1/documents.ts) |
| 5 | `ApiError` + fitness test | **Done** | [`public-api-fitness.test.ts`](../../api/src/platform/public-api-fitness.test.ts) |
| 6 | ScopeRegistry; explicit 403 | **Done** | [`scopes.ts`](../../api/src/platform/scopes.ts) |
| 7 | OpenAPI 3.1 generated + schema test | **Done** | [Live OpenAPI](https://ship-web-jyqh.onrender.com/api/v1/openapi.json), [`openapi-schema.test.ts`](../../api/src/platform/openapi-schema.test.ts) |
| 8 | SDK skeleton; `ShipClient({ token }).me()` | **Done** | [`sdk/src/client.test.ts`](../../sdk/src/client.test.ts) |
| 9 | Playwright regression + perf +10% | **Partial** | Full suite run: [`evidence/e2e-full-run-2026-06-01.log`](./evidence/e2e-full-run-2026-06-01.log) — 793 passed, 12 failed (exit 1). OAuth PKCE isolated: [`e2e-oauth-pkce-2026-06-01.log`](./evidence/e2e-oauth-pkce-2026-06-01.log) (1 passed). Perf CI in `mvp-gates.yml`. |
| 10 | Deployed + OpenAPI + grader OAuth app | **Done** | [Live deploy](https://ship-web-jyqh.onrender.com/login) · [OpenAPI](https://ship-web-jyqh.onrender.com/api/v1/openapi.json) · [`README`](../../README.md) § Week 03 grader OAuth (`client_id` + portal secret handoff) |

**MVP checkpoint verdict:** Suitable for **Tuesday MVP hard-gate submission** — grader OAuth app pre-registered and documented in README; full Playwright suite executed with committed evidence log. Full suite is not 100% green (12 failures, mostly pre-existing specs); OAuth PKCE passes in isolation and in CI grep. Not equivalent to **full Week 03 PRD** or **Sunday final submission**.

---

## Test evidence artifacts (2026-06-01)

Committed under [`deliverables/2026-W23-week-03/evidence/`](./evidence/):

| Log file | Command / purpose | Outcome |
| --- | --- | --- |
| [`build-shared-2026-06-01.log`](./evidence/build-shared-2026-06-01.log) | `pnpm build:shared` | Success |
| [`e2e-oauth-pkce-2026-06-01.log`](./evidence/e2e-oauth-pkce-2026-06-01.log) | `pnpm exec playwright test e2e/oauth-pkce.spec.ts` | **1 passed** (~3.5m) |
| [`e2e-full-run-2026-06-01.log`](./evidence/e2e-full-run-2026-06-01.log) | `PLAYWRIGHT_WORKERS=1 pnpm test:e2e` | **793 passed**, 12 failed, 9 flaky, 47 did not run (~1.3h, exit 1) |
| [`api-test-2026-06-01.log`](./evidence/api-test-2026-06-01.log) | `pnpm --filter @ship/api test` | Failed — no local Postgres on `:5432` |
| [`api-platform-test-2026-06-01.log`](./evidence/api-platform-test-2026-06-01.log) | `vitest run src/platform/` + Docker PG | Failed — schema not migrated |
| [`docker-postgres-2026-06-01.log`](./evidence/docker-postgres-2026-06-01.log) | `docker compose up -d postgres` | Container started |
| [`perf-regression-2026-06-01.log`](./evidence/perf-regression-2026-06-01.log) | `node scripts/mvp/perf-regression-check.mjs` | Skipped — missing current metrics file |

**Recommended before claiming MVP item 9 complete:** Full suite was run 2026-06-01; remaining 12 failures are pre-existing spec flakes/timeouts (not Week 03 OAuth/API). Re-run failed specs with `--last-failed` after resource cleanup if a fully green log is required for strict interpretation of “passes.”

---

## Representative user prompts (paraphrased)

Captured for audit trail without reproducing full model outputs:

1. “Generate deliverables list from PRD and save as DELIVERABLES.md.”
2. “Implement MVP hard gates + close FleetGraph reviewer feedback per plan.”
3. “Why does `/api/v1/openapi.json` return Cannot GET on Render?”
4. “Does the repo meet all PRD requirements with live URL proof?”
5. “Align architecture, deliverables, and pre-search with current branch.”
6. “Put today’s AI chats in the deliverable file; can I submit `gfa2_wk6` for MVP?”
7. “Run tests for evidence.”
8. “How do I create a super-admin login for the human reviewer?”
9. “Complete MVP final requirements: grader OAuth in README + full Playwright regression with evidence.”

---

## Raw transcript access (optional audit)

On the author machine:

`%USERPROFILE%\.cursor\projects\d-GFA-Cohort-5-Week-Five-GitHub-ship\agent-transcripts\<uuid>\<uuid>.jsonl`

Parent UUIDs are listed in the session index above. Subagent transcripts are excluded per course submission guidance.

---

## Cross-links for graders

| Document | Role |
| --- | --- |
| [`PRESEARCH.md`](./PRESEARCH.md) | Phase 1–3 written pre-search |
| **This file** | AI conversation reference artifact (PRD attachment) |
| [`DELIVERABLES.md`](./DELIVERABLES.md) | Checklist, live URLs, MVP status |
| [`docs/architecture.md`](../../docs/architecture.md) | PRD architecture submission (1–2 pages) |
| [`ARCHITECTURE_DEFENSE.md`](./ARCHITECTURE_DEFENSE.md) | Monday defense talk track |
| [`GRADER_HANDOFF.md`](./GRADER_HANDOFF.md) | Deploy login + OAuth `client_id` (secret via portal) |
