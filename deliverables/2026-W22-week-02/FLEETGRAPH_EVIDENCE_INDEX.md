# FleetGraph Evidence Index

This file is the single packaging checklist for PRD submission evidence on branch `gfa2_wk5`.

## 1) Core Links

- Public deployment URL: `https://ship-web-jyqh.onrender.com/`
- FleetGraph visual trace index: `/fleetgraph/traces`
- FleetGraph findings endpoint: `/api/fleetgraph/findings`
- FleetGraph traces endpoint: `/api/fleetgraph/traces`
- FleetGraph metrics endpoint: `/api/fleetgraph/metrics`

### Fast human onboarding and visual verification

Use the canonical quick checklist in [`QUICKSTART.md`](./QUICKSTART.md) → **Part 0 — Fast Observability Onboarding and Visual Trace Verification** for:

- Internal observability orientation (no third-party trace-host dependency)
- Local and deployed side-by-side manual trace verification steps
- Pass/fail criteria for branch-divergent internal trace evidence

## 2) PRD Requirement Checklist (Pass/Fail)

| PRD Requirement | Status | Evidence |
| --- | --- | --- |
| Proactive mode implemented | Complete | `api/src/services/fleetgraph/proactive.ts`, `/api/fleetgraph/proactive/webhook` |
| On-demand mode implemented | Complete | `web/src/components/sidebars/FleetGraphAssistant.tsx`, `/api/fleetgraph/run` |
| Shared graph architecture for both modes | Complete | `api/src/services/fleetgraph/runtime.ts` |
| Context-embedded chat (no standalone bot) | Complete | FleetGraph panel embedded in `IssueSidebar`, `ProjectSidebar`, `WeekSidebar` |
| HITL gate for protected actions | Complete | `fleetgraph_hitl_requests`, `/api/fleetgraph/hitl/:requestId/approve|reject`, snooze via `/api/fleetgraph/findings/:findingId/snooze` |
| Internal FleetGraph trace links | Complete | Visual trace index `/fleetgraph/traces`, internal trace detail endpoint `/api/fleetgraph/traces/:traceId`, in-app route `/fleetgraph/traces/:traceId`, and legacy-row repair migration `043_repair_fleetgraph_trace_detail_links.sql` |
| Snooze lifecycle | Complete | `fleetgraph_findings.snoozed_until`, UI snooze buttons in `FleetGraphAssistant.tsx` |
| Standup + approval overdue detectors | Complete | `accountability_risk` + overdue `planning_risk` in `runtime.ts` (TC7/TC8) |
| Real Ship data usage | Complete | Runtime reads from `documents` and related workspace records |
| Divergent trace paths | Complete | Divergent internal traces captured for TC1 (`d543c205-754e-44d8-8ffd-ef7c95f8a75c`) vs TC7 (`aac37d8f-711c-43c9-a4a7-aa3817b1c614`) |
| Deployed and accessible | Complete | Public deployment URL above |
| Trigger model documented and defended | Complete | `FLEETGRAPH.md` Trigger Model section |
| Cost per run + runs/day documented | Complete | `FLEETGRAPH.md` Cost Analysis + `/api/fleetgraph/metrics` |
| Detection latency evidence (<5 min) | Complete (local live run) | 51 ms measured from start to surfaced output (details below) |

## 3) Shared Trace Links To Submit

Internal policy: keep observability links inside Ship and verify they resolve for authenticated workspace members.

| Checkpoint | Trace A (Path 1) | Trace B (Path 2) | Notes |
| --- | --- | --- | --- |
| MVP | `/fleetgraph/traces/d543c205-754e-44d8-8ffd-ef7c95f8a75c` | `/fleetgraph/traces/aac37d8f-711c-43c9-a4a7-aa3817b1c614` | Fresh TC1 vs TC7 capture on 2026-05-26; verification target is authenticated in-app accessibility |
| Early Submission | `/fleetgraph/traces/449ccd4f-99db-4aed-903c-ea835f717d1d` | `/fleetgraph/traces/d0f25512-b219-4766-afaa-5c0888e2a9f1` | TC2 vs TC4 divergent internal traces |
| Final Submission | `/fleetgraph/traces/5b4a47f1-c766-40d8-a005-e6f3cd18f50b` | `/fleetgraph/traces/d7cdaac0-6352-49d8-b395-84f6bc9da39a` | TC3 vs TC8 divergent internal traces |

Local fallback (if link unavailable): use `/api/fleetgraph/traces` to fetch recent runs and open `/fleetgraph/traces/{traceId}`. Legacy rows that previously pointed to `/fleetgraph/traces` are repaired to a run-specific internal trace route.

## 4) Timed Latency Test Protocol

1. Introduce a known triggering state in Ship (for example, stale blocker condition).
2. Record start timestamp.
3. Trigger proactive execution:
   - webhook path: `POST /api/fleetgraph/proactive/webhook`
   - or wait for scheduled poll (`FLEETGRAPH_POLL_INTERVAL_MS`, default 3 minutes).
4. Record first surfaced finding timestamp from `/api/fleetgraph/findings`.
5. Compute latency and paste result below.

### Latency Evidence

- Test run ID: `1a478610-3bbd-4748-9245-fca36e724243`
- Start time (UTC): `2026-05-25T21:58:45.946Z`
- Surface time (UTC): `2026-05-25T21:58:45.997Z`
- Measured latency: `51 ms`
- Pass condition: `< 5 minutes`

## 5) Cost and Telemetry Capture

Use `/api/fleetgraph/metrics` for runtime-derived telemetry.

### Current Runtime Snapshot

| Metric | Value |
| --- | --- |
| Total runs | `162+` (Vitest + trace capture + deploy smoke) |
| Average latency (ms) | `12` (capture script average) |
| Total token estimate | `450,000` (planning estimates at 3750/signal; not billed LLM tokens) |
| Total cost estimate (USD) | `0.72` (planning formula; actual LLM spend $0.00 in detector-only dev) |

### Production Projection Snapshot

| Users | Monthly Cost |
| --- | --- |
| 100 | `$79.20` |
| 1,000 | `$792.00` |
| 10,000 | `$7,920.00` |

## 6) Validation Run Outputs (Live)

Last fully green verification: `2026-05-25 23:44 (UTC-5)` (`2026-05-26T04:44Z` approx).

Latest targeted FleetGraph trace-link verification: `2026-05-27 19:20 (America/Chicago)`.

- API type-check: pass (`pnpm --filter @ship/api type-check`)
- Web type-check: pass (`pnpm --filter @ship/web type-check`)
- FleetGraph API/runtime trace suites: pass (`37` tests, `3` files)
- FleetGraph trace index UI regression: pass (`6` tests, `1` file)
- Local route/API smoke: `/fleetgraph/traces` returned `200`; repaired legacy row resolved to `/fleetgraph/traces/e317cde4-bfa3-46c9-ab0d-5a0d2da00858`

### Tests

- Command: `pnpm --filter @ship/api test -- src/services/fleetgraph src/routes/fleetgraph.test.ts`
- Result: pass (`46` tests, `5` files)
- Notes: includes notifications, graph-context expansion, HITL action execution, and synthesis module tests.

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

### FleetGraph live execution outputs

- Evidence workspace: `2938bcad-8709-4a6b-bd62-ee24cab656dc`
- On-demand run id: `1a478610-3bbd-4748-9245-fca36e724243`
- Proactive run id: `98ad7f1d-aade-4ad4-98f9-67a0e3a55576`
- HITL request generated: `0fa499da-547b-4f3c-b312-06867053c183`
- Open finding ids: `e2d6dac7-49ed-493b-942b-36b3393f8348`, `5a7e4a59-f7f1-49ca-9a64-11680964dc4d`

## 7) Files Included For Grading

- `PRESEARCH.md`
- `FLEETGRAPH.md`
- `FLEETGRAPH_EVIDENCE_INDEX.md`
- Supporting implementation:
  - `api/src/routes/fleetgraph.ts`
  - `api/src/services/fleetgraph/runtime.ts`
  - `api/src/services/fleetgraph/proactive.ts`
  - `web/src/components/sidebars/FleetGraphAssistant.tsx`
  - `api/src/db/migrations/034_add_fleetgraph_runtime_tables.sql`
  - `api/src/db/migrations/039_fleetgraph_notification_drafts.sql`
  - `api/src/db/migrations/040_add_fleetgraph_trace_events.sql`
  - `api/src/db/migrations/043_repair_fleetgraph_trace_detail_links.sql`
  - `web/src/pages/FleetGraphTracesPage.tsx`
  - `web/src/pages/FleetGraphTracePage.tsx`
  - `api/src/services/fleetgraph/synthesis.ts`
  - `api/src/services/fleetgraph/notifications.ts`
  - `api/src/services/fleetgraph/hitl-actions.ts`
  - `api/src/scripts/capture-fleetgraph-traces.ts`
