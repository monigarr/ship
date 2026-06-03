# Week 03 Deliverables

**Source of truth:** [`PRD.md`](./PRD.md)  
**Dev branch:** `gfa2_wk6-final` (Early/Final) · **`gfa2_wk6`:** MVP slice preserved · **Last updated:** 2026-06-02
**Architecture doc (PRD path):** [`docs/architecture.md`](../../docs/architecture.md)

This file tracks submission deliverables, implementation status on the current branch, and reviewer proof URLs. Status keys: **Done** · **Partial** · **Not started**.

---

## Implementation status summary

| Track | Done | Partial | Not started |
| --- | --- | --- | --- |
| MVP hard gate (PRD § MVP Requirements) | 10 | 0 | 0 |
| Core platform (webhooks, device flow, portal, agent) | 8 | 0 | 0 |
| Submission artifacts (video, social, epics, cost) | 6 | 1 | 2 |

**Live deployment:** [https://ship-web-jyqh.onrender.com/login](https://ship-web-jyqh.onrender.com/login)  
**Public OpenAPI (grading surface):** [https://ship-web-jyqh.onrender.com/api/v1/openapi.json](https://ship-web-jyqh.onrender.com/api/v1/openapi.json)  
**Internal OpenAPI (legacy, supporting only):** [https://ship-web-jyqh.onrender.com/api/openapi.json](https://ship-web-jyqh.onrender.com/api/openapi.json)

---

## Required deliverables

| Deliverable | PRD requirement | Status | Evidence |
| --- | --- | --- | --- |
| Architectural Defense | Monday checkpoint | **Done** | [`ARCHITECTURE_DEFENSE.md`](./ARCHITECTURE_DEFENSE.md) |
| MVP checkpoint | Tuesday hard gates | **Done** | MVP hard gates + confirming E2E/perf evidence (2026-06-02) |
| Early / Final submission | Friday / Sunday | **Done** (code) | [EARLY_SUBMISSION.md](./EARLY_SUBMISSION.md) · redeploy Render from `gfa2_wk6-final` |
| GitHub / GitLab repository | Public, slice branches, PR mapping | **Done** | [GitLab repo](https://labs.gauntletai.com/monicapeters/ship) · [GitHub repo](https://github.com/monigarr/ship) · slice `gfa2_wk6` preserved · [GitHub PR #1](https://github.com/monigarr/ship/pull/1) · [GitLab MR `gfa2_wk6`→`master`](https://labs.gauntletai.com/monicapeters/ship/-/merge_requests/new?merge_request%5Bsource_branch%5D=gfa2_wk6) (redirects to open MR) · merged to `master` |
| Architecture document | `docs/architecture.md`, 1–2 pages | **Done** | [`docs/architecture.md`](../../docs/architecture.md) |
| Pre-Search document | Three phases + AI conversation artifact | **Done** | [`PRESEARCH.md`](./PRESEARCH.md) · [`AI_CONVERSATION_REFERENCE.md`](./AI_CONVERSATION_REFERENCE.md) · [`evidence/`](./evidence/) |
| OpenAPI spec | Live `/api/v1/openapi.json` + static `docs/openapi.json` | **Done** | [Live](https://ship-web-jyqh.onrender.com/api/v1/openapi.json) · [`docs/openapi.json`](../../docs/openapi.json) |
| Demo video (3–5 min) | Five-line story + portal replay | **Partial** | Script: [`DEMO_VIDEO_SCRIPT.md`](./DEMO_VIDEO_SCRIPT.md) · add URL to [`FINAL_SUBMISSION.md`](./FINAL_SUBMISSION.md) after recording |
| AI cost analysis | Dev spend, projections, assumptions | **Done** | [AI_COST_ANALYSIS.md](./AI_COST_ANALYSIS.md) |
| Per-epic write-up | before → fix → after → proof | **Done** | [epics/](./epics/) E1–E7 |
| Three discoveries | Implementation learnings | **Done** | [DISCOVERIES.md](./DISCOVERIES.md) |
| Deployed application | Public URL + grader OAuth app + portal | **Partial** | Run `node scripts/platform/verify-deploy.mjs` · redeploy `gfa2_wk6-final` on Render if OpenAPI lacks `/webhooks` |
| Social post | `@GauntletAI` + webhook tail screenshot | **Partial** | Draft: [`SOCIAL_POST_DRAFT.md`](./SOCIAL_POST_DRAFT.md) · add URL to FINAL_SUBMISSION after posting |
| Final submission handoff | Sunday deliverables index | **Done** | [`FINAL_SUBMISSION.md`](./FINAL_SUBMISSION.md) |

---

## MVP hard gate (PRD § MVP Requirements)

| Requirement | Status | Proof |
| --- | --- | --- |
| OAuth app registration; secret shown once, hashed at rest | **Done** | [`oauth.ts`](../../api/src/platform/oauth.ts) · [`public-api-mvp.test.ts`](../../api/src/platform/public-api-mvp.test.ts) · `POST /api/v1/oauth/apps` (session admin) |
| Authorization Code + PKCE E2E + invalid verifier | **Done** | [`e2e/oauth-pkce.spec.ts`](../../e2e/oauth-pkce.spec.ts) · MVP test |
| Bearer middleware on `/api/v1/*`; 401 / expired codes | **Done** | [GET /api/v1/me](https://ship-web-jyqh.onrender.com/api/v1/me) → 401 without token · MVP test |
| Documents GET list, GET id, POST + scopes | **Done** | [`routes/v1/documents.ts`](../../api/src/platform/routes/v1/documents.ts) |
| `ApiError` shape on all public failures | **Done** | [`http.ts`](../../api/src/platform/http.ts) · [`public-api-fitness.test.ts`](../../api/src/platform/public-api-fitness.test.ts) |
| ScopeRegistry; 403 names missing scope | **Done** | [`scopes.ts`](../../api/src/platform/scopes.ts) · MVP test |
| OpenAPI 3.1 generated, schema unit test | **Done** | [Live spec](https://ship-web-jyqh.onrender.com/api/v1/openapi.json) · [`openapi-schema.test.ts`](../../api/src/platform/openapi-schema.test.ts) |
| SDK skeleton; `ShipClient({ token }).me()` | **Done** | [`sdk/src/client.ts`](../../sdk/src/client.ts) · [`client.test.ts`](../../sdk/src/client.test.ts) |
| Regression P95 / bundle / queries within +10% | **Done** | [`scripts/mvp/capture-perf-metrics.mjs`](../../scripts/mvp/capture-perf-metrics.mjs) · [`artifacts/perf/current-metrics.json`](../../artifacts/perf/current-metrics.json) · [`evidence/perf-regression-2026-06-02.log`](./evidence/perf-regression-2026-06-02.log) |
| Existing Playwright **full** regression suite passes | **Done** | Confirming run [`evidence/e2e-full-run-CONFIRM.log`](./evidence/e2e-full-run-CONFIRM.log): **854 passed**, **0 failed**, 7 flaky, 9 skipped, exit 0 (~56m, `PLAYWRIGHT_WORKERS=1`) |
| Deployed + OpenAPI URL + grader OAuth app | **Done** | Deploy + OpenAPI live; pre-registered app documented in [`README`](../../README.md) § Week 03 (`client_id` + portal secret handoff) |

---

## Post-MVP scope (`gfa2_wk6-final`)

| PRD area | Status |
| --- | --- |
| Device Authorization Grant | **Done** |
| Refresh token rotation + family invalidation | **Done** |
| Webhooks (events, sign, retry, DLQ, replay) | **Done** |
| Issues / sprints public routes | **Deferred** (scopes registered only) |
| Rate-limit headers on public API | **Done** |
| Public audit trail | **Done** |
| Developer portal UI | **Done** (`/developer`, `/oauth/device`) |
| CLI (`ship login`, `ship docs *`, `ship webhooks tail`) | **Done** (`integrations/cli`) |
| TTFE drill (`pnpm drill:ttfe`) in CI | **Done** | `platform-gates.yml` · `api/src/platform/ttfe-ci.test.ts` · `scripts/platform/run-ttfe-ci.mjs` |
| ≥5 integration/flow items | **Done** (CLI + device E2E + refresh drill + webhook replay + TTFE) |
| Agent-as-citizen rewire (Epic 7) | **Done** (`SHIP_AGENT_USE_PUBLIC_API`) |

---

## Reviewer proof URLs + actions

### Repository and CI

| Action | URL / file |
| --- | --- |
| Week 03 deliverable folder | [tree `gfa2_wk6`](https://labs.gauntletai.com/monicapeters/ship/-/tree/gfa2_wk6/deliverables/2026-W23-week-03) |
| GitHub PR (Week 03 MVP slice) | [PR #1 `gfa2_wk6`→`master`](https://github.com/monigarr/ship/pull/1) |
| GitLab MR (Week 03 MVP slice) | [MR `gfa2_wk6`→`master`](https://labs.gauntletai.com/monicapeters/ship/-/merge_requests/new?merge_request%5Bsource_branch%5D=gfa2_wk6) |
| `master` after merge | [tree `master`](https://labs.gauntletai.com/monicapeters/ship/-/tree/master/deliverables/2026-W23-week-03) |
| MVP CI workflow | [`.github/workflows/mvp-gates.yml`](../../.github/workflows/mvp-gates.yml) |

Run locally:

```bash
pnpm --filter @ship/api test
pnpm --filter @ship/sdk type-check
pnpm test:e2e --grep "OAuth Authorization Code + PKCE"
PLAYWRIGHT_WORKERS=1 pnpm test:e2e   # full regression (~1.3h; see evidence log)
node scripts/mvp/perf-regression-check.mjs
pnpm --filter @ship/api openapi:generate:public
```

### Live deployment (post-MVP routes)

| Requirement | URL / flow | Action |
| --- | --- | --- |
| App reachable | [Login](https://ship-web-jyqh.onrender.com/login) | Authenticate as admin |
| Developer portal | [Developer](https://ship-web-jyqh.onrender.com/developer) | OAuth apps, webhooks, delivery log |
| Device verify UX | [Device](https://ship-web-jyqh.onrender.com/oauth/device) | Enter user code from `ship login` |
| Public OpenAPI 3.1 | [openapi.json](https://ship-web-jyqh.onrender.com/api/v1/openapi.json) | Confirm `/webhooks`, `/oauth/device/*` paths |
| Deploy verification | `node scripts/platform/verify-deploy.mjs` | Fails if production behind `gfa2_wk6-final` |

### Live deployment (MVP-verifiable)

| Requirement | URL / flow | Action |
| --- | --- | --- |
| App reachable | [Login](https://ship-web-jyqh.onrender.com/login) | Authenticate as admin |
| Public OpenAPI 3.1 | [openapi.json](https://ship-web-jyqh.onrender.com/api/v1/openapi.json) | Confirm OAuth + `/me` + `/documents` paths |
| Bearer enforcement | [GET /api/v1/me](https://ship-web-jyqh.onrender.com/api/v1/me) | Expect `401` + `ApiError` without token |
| OAuth registration | `POST /api/v1/oauth/apps` | Admin session; capture one-time `client_secret` |
| PKCE flow | `/api/v1/oauth/authorize` → `/api/v1/oauth/token` | Use Playwright spec or manual flow |
| Scoped documents | `/api/v1/documents` | Bearer token with `documents:read` / `documents:write` |
| Internal Swagger (supporting) | [api/docs](https://ship-web-jyqh.onrender.com/api/docs) | Legacy internal API only |

### Code evidence (no live URL)

| Requirement | File |
| --- | --- |
| PKCE negative case | [`e2e/oauth-pkce.spec.ts`](../../e2e/oauth-pkce.spec.ts), [`public-api-mvp.test.ts`](../../api/src/platform/public-api-mvp.test.ts) |
| Route/spec fitness | [`public-api-fitness.test.ts`](../../api/src/platform/public-api-fitness.test.ts) |
| Public/internal boundary | [`public-boundary.test.ts`](../../api/src/platform/public-boundary.test.ts) |
| OpenAPI generator | [`spec/openapi.ts`](../../api/src/platform/spec/openapi.ts), [`spec/route-metadata.ts`](../../api/src/platform/spec/route-metadata.ts) |
| FleetGraph intent routing (Week 02 carryover) | [`fleetgraph/runtime.ts`](../../api/src/services/fleetgraph/runtime.ts) |
| TTFE CI harness | [`scripts/platform/run-ttfe-ci.mjs`](../../scripts/platform/run-ttfe-ci.mjs) |
| SDK/OpenAPI parity | [`sdk-openapi-parity.test.ts`](../../api/src/platform/sdk-openapi-parity.test.ts) |

---

## Grader checklist

Use before submission. Checkboxes reflect **`gfa2_wk6` as of 2026-06-02**.

### Checkpoints and docs

- [x] **Architecture Defense** — [`ARCHITECTURE_DEFENSE.md`](./ARCHITECTURE_DEFENSE.md)
- [x] **Architecture document (`docs/architecture.md`)** — [`docs/architecture.md`](../../docs/architecture.md)
- [x] **Pre-Search (phases 1–3)** — [`PRESEARCH.md`](./PRESEARCH.md)
- [x] **Pre-Search AI conversation artifact attached** — [`AI_CONVERSATION_REFERENCE.md`](./AI_CONVERSATION_REFERENCE.md) (PRD path: `deliverables/2026-W23-week-03/`)
- [x] **OAuth PKCE E2E evidence log** — [`evidence/e2e-oauth-pkce-2026-06-01.log`](./evidence/e2e-oauth-pkce-2026-06-01.log) (1 passed)
- [x] **AI cost analysis** — [AI_COST_ANALYSIS.md](./AI_COST_ANALYSIS.md)
- [x] **Per-epic write-ups** — [epics/](./epics/)
- [x] **Three discoveries** — [DISCOVERIES.md](./DISCOVERIES.md)
- [ ] **Demo video** — script ready; add URL to [FINAL_SUBMISSION.md](./FINAL_SUBMISSION.md)
- [ ] **Social post** — draft ready; add URL to FINAL_SUBMISSION

### MVP hard gate

- [x] **Deployed app reachable** — [Login](https://ship-web-jyqh.onrender.com/login)
- [x] **Public OpenAPI at `/api/v1/openapi.json`** — [Live](https://ship-web-jyqh.onrender.com/api/v1/openapi.json)
- [x] **Static OpenAPI committed** — [`docs/openapi.json`](../../docs/openapi.json)
- [x] **OAuth app registration + hashed secret** — [`oauth.ts`](../../api/src/platform/oauth.ts) · migration `047_oauth_public_platform.sql`
- [x] **Authorization Code + PKCE** — [`oauth-pkce.spec.ts`](../../e2e/oauth-pkce.spec.ts)
- [x] **PKCE negative (`invalid_grant`)** — MVP + E2E tests
- [x] **Bearer auth (401 / `token_expired`)** — MVP test · live `/api/v1/me`
- [x] **Scope enforcement (403 + `missing_scope`)** — MVP test
- [x] **Documents list/get/create** — [`documents.ts`](../../api/src/platform/routes/v1/documents.ts)
- [x] **Cursor pagination `{ data, next_cursor }`** — MVP test
- [x] **ApiError envelope** — fitness test
- [x] **OpenAPI generated from metadata** — [`spec/openapi.ts`](../../api/src/platform/spec/openapi.ts)
- [x] **OpenAPI schema validation** — [`openapi-schema.test.ts`](../../api/src/platform/openapi-schema.test.ts)
- [x] **SDK package + `me()`** — [`sdk/`](../../sdk/)
- [x] **Route/spec fitness tests** — [`public-api-fitness.test.ts`](../../api/src/platform/public-api-fitness.test.ts)
- [x] **Playwright PKCE E2E** — [`oauth-pkce.spec.ts`](../../e2e/oauth-pkce.spec.ts)
- [x] **Perf budget CI** — [`mvp-gates.yml`](../../.github/workflows/mvp-gates.yml) · [`evidence/perf-regression-2026-06-02.log`](./evidence/perf-regression-2026-06-02.log) (capture + check passed)
- [x] **Full Playwright regression suite** — [`evidence/e2e-full-run-CONFIRM.log`](./evidence/e2e-full-run-CONFIRM.log) (854 passed / 0 failed / 7 flaky / exit 0)
- [x] **Pre-registered grader OAuth app in README** — [`README`](../../README.md) § Week 03; `client_id` `ship_9ba67d9391c53a610558563b93627298`; secret via Gauntlet portal

### Post-MVP / final submission

- [x] **Device Authorization Grant** — `oauth-device.test.ts`
- [x] **Refresh tokens + rotation** — `oauth-refresh.test.ts`
- [x] **Webhooks end-to-end** — `webhooks-deliverer.test.ts`
- [x] **Developer portal** — `/developer`, `/oauth/device`
- [x] **CLI + TTFE drill** — `integrations/cli`, `pnpm drill:ttfe`
- [x] **≥5 PRD integrations/flows** — CLI, device, refresh drill, replay, TTFE
- [x] **Agent-as-citizen (Epic 7)** — `SHIP_AGENT_USE_PUBLIC_API`, `agent-platform.test.ts`
- [x] **AI cost analysis** — [AI_COST_ANALYSIS.md](./AI_COST_ANALYSIS.md)
- [x] **Per-epic write-ups** — [epics/](./epics/)
- [x] **Three discoveries** — [DISCOVERIES.md](./DISCOVERIES.md)
- [ ] **Demo video** — add URL when recorded ([DEMO_VIDEO_SCRIPT.md](./DEMO_VIDEO_SCRIPT.md))
- [ ] **Social post** — add URL when posted ([SOCIAL_POST_DRAFT.md](./SOCIAL_POST_DRAFT.md))
- [x] **Final evidence packet** — [`evidence/platform-tests-CONFIRM.log`](./evidence/platform-tests-CONFIRM.log)
- [x] **Final submission handoff** — [FINAL_SUBMISSION.md](./FINAL_SUBMISSION.md)

### Week 02 carryover (implemented on branch)

- [x] **FleetGraph intent-aware routing** — [`runtime.ts`](../../api/src/services/fleetgraph/runtime.ts) · [`runtime.test.ts`](../../api/src/services/fleetgraph/runtime.test.ts)
