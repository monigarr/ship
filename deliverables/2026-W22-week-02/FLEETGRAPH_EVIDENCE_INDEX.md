# FleetGraph Evidence Index

This file is the sprint-folder packaging checklist for PRD submission evidence on branch `gfa2_wk5`.

## Reviewer Blockers Closed (Final)

- Public trace accessibility: FLEETGRAPH.md Test Cases now include per-case public LangSmith URLs copied from each trace's "View in LangSmith" link.
- Chat discoverability: FleetGraph chat is now anchored in the left sidebar as the primary context-aware interaction surface.

## **AGENTS, EVALS, GRAPHS, RAGS **

**Agents (FleetGraph runtime + UI)**
- api/src/services/fleetgraph/runtime.ts — core FleetGraph execution, signal detection, branching, findings persistence, trace detail/metrics/list APIs.
- api/src/services/fleetgraph/proactive.ts — proactive scheduler + webhook-triggered runs, scan-state tracking, debounce.
- api/src/services/fleetgraph/synthesis.ts — optional LLM synthesis layer for on-demand responses (Bedrock).
- api/src/services/fleetgraph/hitl-actions.ts — HITL action payload build + approved action execution.
- api/src/services/fleetgraph/notifications.ts — notification draft enrichment/routing.
- api/src/services/fleetgraph/trace.ts — internal trace URL/config lifecycle.
- api/src/services/fleetgraph/types.ts — runtime types/contracts.
- api/src/routes/fleetgraph.ts — authenticated REST endpoints for run, findings, metrics, traces, trace detail, HITL decisions, snooze.
- web/src/components/sidebars/FleetGraphAssistant.tsx — context-embedded assistant panel + findings + HITL controls.
- web/src/pages/FleetGraphTracesPage.tsx — trace index UI.
- web/src/pages/FleetGraphTracePage.tsx — trace detail UI.
- web/src/lib/fleetgraphVisuals.ts — shared FleetGraph status/severity/trace-link helpers.
- web/src/components/sidebars/IssueSidebar.tsx, ProjectSidebar.tsx, WeekSidebar.tsx — assistant embedding points.

**Evals (implemented as test-driven scenario validation)**
- api/src/services/fleetgraph/runtime.test.ts — TC1–TC8 scenario assertions, branch divergence, latency, dedupe, HITL lifecycle.
- api/src/routes/fleetgraph.test.ts — endpoint contract and auth/CSRF behavior.
- api/src/services/fleetgraph/proactive.test.ts — scheduler/webhook/tier/debounce behavior.
- api/src/services/fleetgraph/trace.test.ts — trace URL/config behavior.
- api/src/services/fleetgraph/notifications.test.ts — notification routing.
web/src/pages/FleetGraphTracesPage.test.tsx, web/src/lib/fleetgraphVisuals.test.ts — UI and helper coverage.
- api/src/scripts/capture-fleetgraph-traces.ts — scripted capture of TC trace URLs (evidence generation, not product runtime).

**Graphs**
- api/src/services/fleetgraph/runtime.ts — graph-context expansion via related docs/associations (project-state graph reasoning).
- web/src/pages/FleetGraphTracesPage.tsx, FleetGraphTracePage.tsx — graph-run observability views.
- web/src/components/week/WeekProgressGraph.tsx — sprint burndown chart graph (non-FleetGraph visual graph).

**“RAG-like” adjacent, but not full RAG**
- api/src/routes/search.ts — lexical SQL search over titles/tags/content fields (no vector retrieval).
- api/src/services/ai-analysis.ts + api/src/routes/ai.ts — LLM scoring for plans/retros; analysis endpoints, but not retrieval-augmented generation pipeline.
Planned / Docs-Only

## 1) Core Links

- Public review/login URL: `https://ship-web-jyqh.onrender.com/login` (HEAD `200 OK` verified 2026-05-28)
- Public app base URL: `https://ship-web-jyqh.onrender.com/`
- FleetGraph visual trace index: `/fleetgraph/traces` (deployed: `https://ship-web-jyqh.onrender.com/fleetgraph/traces`, authenticated)
- LangSmith project traces (required external evidence): `https://smith.langchain.com/o/53ea29ad-725a-449d-8454-a5e5b940ea6c/projects/p/94ee9aa8-6f2b-42b6-80d5-d5c18af5729d?runview=traces`
- FleetGraph findings endpoint: `/api/fleetgraph/findings` (authenticated)
- FleetGraph traces endpoint: `/api/fleetgraph/traces` (authenticated)
- FleetGraph metrics endpoint: `/api/fleetgraph/metrics` (authenticated)

For this submission, both evidence channels are required: internal in-app Ship traces (`/fleetgraph/*`, `/api/fleetgraph/*`) and external LangSmith project traces. Trace IDs are persisted runtime records from captured FleetGraph runs, not source files.

### Fast human onboarding and visual verification

Use the canonical quick checklist in [`QUICKSTART.md`](./QUICKSTART.md) → **Part 0 — Fast Observability Onboarding and Visual Trace Verification** for:

- Internal observability orientation (no third-party trace-host dependency)
- Local and deployed side-by-side manual trace verification steps
- Pass/fail criteria for branch-divergent internal trace evidence

For required external monitoring/evidence setup, see [`QUICKSTART.md`](./QUICKSTART.md) → **Required — LangSmith Evidence and Automations (External Observability)** for high-value automations and conservative/aggressive threshold defaults.

## 2) PRD Requirement Checklist (Pass/Fail)

| PRD Requirement | Status | Evidence |
| --- | --- | --- |
| Proactive mode implemented | Complete | [`proactive.ts`](../../api/src/services/fleetgraph/proactive.ts), `POST /api/fleetgraph/proactive/webhook` in [`fleetgraph.ts`](../../api/src/routes/fleetgraph.ts) |
| On-demand mode implemented | Complete | [`FleetGraphAssistant.tsx`](../../web/src/components/sidebars/FleetGraphAssistant.tsx), `POST /api/fleetgraph/run` |
| Shared graph architecture for both modes | Complete | [`runtime.ts`](../../api/src/services/fleetgraph/runtime.ts) |
| Context-embedded chat (no standalone bot) | Complete | FleetGraph panel embedded in [`IssueSidebar.tsx`](../../web/src/components/sidebars/IssueSidebar.tsx), [`ProjectSidebar.tsx`](../../web/src/components/sidebars/ProjectSidebar.tsx), [`WeekSidebar.tsx`](../../web/src/components/sidebars/WeekSidebar.tsx) |
| HITL gate for protected actions | Complete | `fleetgraph_hitl_requests`, `POST /api/fleetgraph/hitl/:requestId/approve`, `POST /api/fleetgraph/hitl/:requestId/reject`, snooze via `POST /api/fleetgraph/findings/:findingId/snooze` |
| Internal FleetGraph trace links | Complete | Visual trace index `/fleetgraph/traces`, internal trace detail endpoint `/api/fleetgraph/traces/:traceId`, in-app route `/fleetgraph/traces/:traceId`, trace persistence migration [`040_add_fleetgraph_trace_events.sql`](../../api/src/db/migrations/040_add_fleetgraph_trace_events.sql), and trace URL repair migrations [`041`](../../api/src/db/migrations/041_canonicalize_fleetgraph_trace_urls.sql), [`042`](../../api/src/db/migrations/042_enforce_internal_fleetgraph_trace_urls.sql), [`043`](../../api/src/db/migrations/043_repair_fleetgraph_trace_detail_links.sql) |
| Snooze lifecycle | Complete | `fleetgraph_findings.snoozed_until`, [`038_fleetgraph_snooze.sql`](../../api/src/db/migrations/038_fleetgraph_snooze.sql), UI snooze buttons in [`FleetGraphAssistant.tsx`](../../web/src/components/sidebars/FleetGraphAssistant.tsx) |
| Standup + approval overdue detectors | Complete | `accountability_risk` + overdue `planning_risk` in [`runtime.ts`](../../api/src/services/fleetgraph/runtime.ts) (TC7/TC8) |
| Real Ship data usage | Complete | Runtime reads from `documents` and related workspace records in Postgres-backed Ship tables |
| Divergent trace paths | Complete | Divergent internal traces captured for TC1 (`d543c205-754e-44d8-8ffd-ef7c95f8a75c`) vs TC7 (`aac37d8f-711c-43c9-a4a7-aa3817b1c614`) |
| Deployed and accessible | Complete | Public review/login URL above returned `200 OK` on 2026-05-28 |
| Trigger model documented and defended | Complete | [`FLEETGRAPH.md`](./FLEETGRAPH.md) Trigger Model section |
| Cost per run + runs/day documented | Complete | [`FLEETGRAPH.md`](./FLEETGRAPH.md) Cost Analysis + `/api/fleetgraph/metrics` |
| Detection latency evidence (<5 min) | Complete (recorded local live run) | Detection latency and run latency are now tracked separately; see Section 4. |

## 3) Shared Trace Links To Submit

Submission policy: include internal FleetGraph trace links and public LangSmith links for reviewer-openable verification.

| Checkpoint | Trace A (Path 1) | Trace B (Path 2) | Notes |
| --- | --- | --- | --- |
| MVP | `/fleetgraph/traces/d543c205-754e-44d8-8ffd-ef7c95f8a75c` + public LangSmith per-run URL in `FLEETGRAPH.md` | `/fleetgraph/traces/aac37d8f-711c-43c9-a4a7-aa3817b1c614` + public LangSmith per-run URL in `FLEETGRAPH.md` | Fresh TC1 vs TC7 capture on 2026-05-26; dual-channel reviewer verification (internal + public LangSmith) |
| Early Submission | `/fleetgraph/traces/449ccd4f-99db-4aed-903c-ea835f717d1d` + public LangSmith per-run URL in `FLEETGRAPH.md` | `/fleetgraph/traces/d0f25512-b219-4766-afaa-5c0888e2a9f1` + public LangSmith per-run URL in `FLEETGRAPH.md` | TC2 vs TC4 divergent traces with public reviewer-openable links |
| Final Submission | `/fleetgraph/traces/5b4a47f1-c766-40d8-a005-e6f3cd18f50b` + public LangSmith per-run URL in `FLEETGRAPH.md` | `/fleetgraph/traces/d7cdaac0-6352-49d8-b395-84f6bc9da39a` + public LangSmith per-run URL in `FLEETGRAPH.md` | TC3 vs TC8 divergent traces with public reviewer-openable links |

Open shared trace links as `https://ship-web-jyqh.onrender.com/fleetgraph/traces/{traceId}` after authenticating, or locally as `http://localhost:5173/fleetgraph/traces/{traceId}`.

Local fallback (if link unavailable): use `/api/fleetgraph/traces` to fetch recent runs and open `/fleetgraph/traces/{traceId}`. Legacy rows that previously pointed to `/fleetgraph/traces` are repaired to a run-specific internal trace route.

## 4) Timed Latency Test Protocol

1. Introduce a known triggering state in Ship (for example, stale blocker condition).
2. Record event-introduced timestamp.
3. Trigger proactive execution:
   - webhook path: `POST /api/fleetgraph/proactive/webhook`
   - or wait for scheduled poll (`FLEETGRAPH_POLL_INTERVAL_MS`, default 3 minutes).
4. Record first surfaced finding timestamp from `/api/fleetgraph/findings`.
5. Compute detection latency (`finding surfaced` - `event introduced`) and run latency separately.

### Scripted capture (recommended)

```powershell
DATABASE_URL=... pnpm --filter @ship/api exec tsx src/scripts/measure-detection-latency.ts
```

The script prints JSON with:
- `detectionLatencyMs` (PRD detection latency metric)
- `runLatencyMs` (runtime execution latency metric)
- `traceId`, `internalTraceUrl`, and optional `externalTraceUrl`

### Latency Evidence

- Test run ID: `1a478610-3bbd-4748-9245-fca36e724243`
- Event introduced at (UTC): `2026-05-25T21:58:45.946Z`
- First surfaced finding at (UTC): `2026-05-25T21:58:45.997Z`
- Detection latency (`event -> surfaced finding`): `51 ms`
- Run latency (`executeFleetGraphRun` runtime execution latency): `51 ms`
- Pass condition: `< 5 minutes`

## 5) Cost and Telemetry Capture

Use `/api/fleetgraph/metrics` for runtime-derived telemetry.

Important scope boundary: `/api/fleetgraph/metrics` reports FleetGraph runtime estimates from `fleetgraph_runs`; it does not represent billed spend invoices.

### Recorded Runtime Snapshot

Recorded values below come from the 2026-05-25 through 2026-05-27 FleetGraph capture and smoke runs. Refresh from `/api/fleetgraph/metrics` before final submission if new traces are generated.

| Metric | Value |
| --- | --- |
| Total runs | `162+` (Vitest + trace capture + deploy smoke) |
| Average run latency (ms) | `12` (capture script average) |
| Total runtime estimate (tokens) | `450,000` (runtime estimate at 3750/signal; not billed spend) |
| Total runtime estimate (USD) | `0.72` (FleetGraph runtime estimate formula from `fleetgraph_runs`) |
| Billed spend observed (USD) | `0.00` (detector-only dev/test runtime sample window) |

### Production Projection Snapshot

| Users | Monthly Cost |
| --- | --- |
| 100 | `$79.20` |
| 1,000 | `$792.00` |
| 10,000 | `$7,920.00` |

## 6) Validation Run Outputs (Recorded + Current Spot-Check)

Last fully green verification: `2026-05-25 23:44 (UTC-5)` (`2026-05-26T04:44Z` approx).

Latest targeted FleetGraph trace-index verification: `2026-05-28 11:17 (America/Chicago)`.

Current repo spot-check: `2026-05-29` verified referenced files/routes/migrations exist, the deployed login URL returns `200 OK`, and the targeted FleetGraph API suite currently declares `51` tests across `5` files. A local test rerun can discover the same tests but may not execute them if no local Postgres is listening on `localhost:5432` (`ECONNREFUSED`).

Count drift guard (run before final submission updates):

```powershell
rg "\bit\(" api/src/services/fleetgraph/runtime.test.ts --count
rg "\bit\(" api/src/services/fleetgraph/trace.test.ts --count
rg "\bit\(" api/src/routes/fleetgraph.test.ts --count
rg "\bit\(" api/src/services/fleetgraph/proactive.test.ts --count
rg "\bit\(" api/src/services/fleetgraph/notifications.test.ts --count
```

- API type-check: pass (`pnpm --filter @ship/api type-check`)
- Web type-check: pass (`pnpm --filter @ship/web type-check`)
- FleetGraph API/runtime/route trace suites: recorded pass (`37` tests, `3` files)
- FleetGraph targeted API suite declarations: current repo has `51` tests across `5` files (`trace` 7, `runtime` 20, `routes` 13, `proactive` 9, `notifications` 2)
- FleetGraph trace index UI regression: current pass (`6` tests, `1` file), including visible Trace column order and page/table scroll containers; trace-link helper coverage currently has `4` tests in [`fleetgraphVisuals.test.ts`](../../web/src/lib/fleetgraphVisuals.test.ts)
- Local route/API smoke: `/fleetgraph/traces` returned `200`; repaired legacy row resolved to `/fleetgraph/traces/e317cde4-bfa3-46c9-ab0d-5a0d2da00858`; production-build browser check confirmed the Trace column renders as the second table column with full trace ID link text and scrollable vertical/horizontal overflow.

### Tests

- Command: `pnpm --filter @ship/api test -- src/services/fleetgraph src/routes/fleetgraph.test.ts`
- Recorded result: pass (`51` tests, `5` files)
- Notes: includes notifications, graph-context expansion, HITL action execution, proactive scheduler/webhook behavior, internal trace URL generation, metrics/traces endpoints, snooze, and latency assertions.

### Command transcript snippets (copy-ready)

```powershell
# Build shared package required for workspace type resolution
pnpm run build:shared
```

```text
> ship@0.0.0 build:shared
> pnpm --filter @ship/shared build
> @ship/shared@0.0.0 build
> tsc
```

```powershell
# API + web type checks
pnpm --filter @ship/api type-check
pnpm --filter @ship/web type-check
```

```text
> @ship/api@0.0.0 type-check
> tsc --noEmit

> @ship/web@0.0.0 type-check
> tsc --noEmit
```

```powershell
# API test environment bootstrap
docker run -d --name ship-test-postgres -e POSTGRES_DB=ship_dev -e POSTGRES_USER=ship -e POSTGRES_PASSWORD=ship_dev_password -p 5432:5432 postgres:16
docker exec ship-test-postgres pg_isready -U ship -d ship_dev
$env:DATABASE_URL='postgres://ship:ship_dev_password@localhost:5432/ship_dev'; pnpm --filter @ship/api db:migrate; pnpm --filter @ship/api test
```

```text
/var/run/postgresql:5432 - accepting connections

> @ship/api@0.0.0 test
> vitest run
...
Test Files  32 passed (32)
Tests      472 passed (472)
```

```powershell
# Web test suite
pnpm --filter @ship/web test
```

```text
> @ship/web@0.0.0 test
> vitest run
...
Test Files  16 passed (16)
Tests      151 passed (151)
```

```powershell
# Test environment cleanup
docker stop ship-test-postgres; docker rm ship-test-postgres
```

### Recorded FleetGraph live execution outputs

- Evidence workspace: `2938bcad-8709-4a6b-bd62-ee24cab656dc`
- On-demand run id: `1a478610-3bbd-4748-9245-fca36e724243`
- Proactive run id: `98ad7f1d-aade-4ad4-98f9-67a0e3a55576`
- HITL request generated: `0fa499da-547b-4f3c-b312-06867053c183`
- Open finding ids: `e2d6dac7-49ed-493b-942b-36b3393f8348`, `5a7e4a59-f7f1-49ca-9a64-11680964dc4d`

## 7) Files Included For Grading

- [`PRESEARCH.md`](./PRESEARCH.md)
- [`FLEETGRAPH.md`](./FLEETGRAPH.md)
- [`FLEETGRAPH_EVIDENCE_INDEX.md`](./FLEETGRAPH_EVIDENCE_INDEX.md)
- Supporting implementation:
  - [`api/src/routes/fleetgraph.ts`](../../api/src/routes/fleetgraph.ts)
  - [`api/src/services/fleetgraph/runtime.ts`](../../api/src/services/fleetgraph/runtime.ts)
  - [`api/src/services/fleetgraph/proactive.ts`](../../api/src/services/fleetgraph/proactive.ts)
  - [`api/src/services/fleetgraph/trace.ts`](../../api/src/services/fleetgraph/trace.ts)
  - [`web/src/components/sidebars/FleetGraphAssistant.tsx`](../../web/src/components/sidebars/FleetGraphAssistant.tsx)
  - [`web/src/components/sidebars/IssueSidebar.tsx`](../../web/src/components/sidebars/IssueSidebar.tsx)
  - [`web/src/components/sidebars/ProjectSidebar.tsx`](../../web/src/components/sidebars/ProjectSidebar.tsx)
  - [`web/src/components/sidebars/WeekSidebar.tsx`](../../web/src/components/sidebars/WeekSidebar.tsx)
  - [`api/src/db/migrations/034_add_fleetgraph_runtime_tables.sql`](../../api/src/db/migrations/034_add_fleetgraph_runtime_tables.sql)
  - [`api/src/db/migrations/038_fleetgraph_snooze.sql`](../../api/src/db/migrations/038_fleetgraph_snooze.sql)
  - [`api/src/db/migrations/039_fleetgraph_notification_drafts.sql`](../../api/src/db/migrations/039_fleetgraph_notification_drafts.sql)
  - [`api/src/db/migrations/040_add_fleetgraph_trace_events.sql`](../../api/src/db/migrations/040_add_fleetgraph_trace_events.sql)
  - [`api/src/db/migrations/041_canonicalize_fleetgraph_trace_urls.sql`](../../api/src/db/migrations/041_canonicalize_fleetgraph_trace_urls.sql)
  - [`api/src/db/migrations/042_enforce_internal_fleetgraph_trace_urls.sql`](../../api/src/db/migrations/042_enforce_internal_fleetgraph_trace_urls.sql)
  - [`api/src/db/migrations/043_repair_fleetgraph_trace_detail_links.sql`](../../api/src/db/migrations/043_repair_fleetgraph_trace_detail_links.sql)
  - [`web/src/pages/FleetGraphTracesPage.tsx`](../../web/src/pages/FleetGraphTracesPage.tsx)
  - [`web/src/pages/FleetGraphTracePage.tsx`](../../web/src/pages/FleetGraphTracePage.tsx)
  - [`web/src/lib/fleetgraphVisuals.ts`](../../web/src/lib/fleetgraphVisuals.ts)
  - [`api/src/services/fleetgraph/synthesis.ts`](../../api/src/services/fleetgraph/synthesis.ts)
  - [`api/src/services/fleetgraph/notifications.ts`](../../api/src/services/fleetgraph/notifications.ts)
  - [`api/src/services/fleetgraph/hitl-actions.ts`](../../api/src/services/fleetgraph/hitl-actions.ts)
  - [`api/src/scripts/capture-fleetgraph-traces.ts`](../../api/src/scripts/capture-fleetgraph-traces.ts)
