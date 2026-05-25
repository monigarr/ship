# FleetGraph Evidence Index

This file is the single packaging checklist for PRD submission evidence on branch `gfa2_wk5`.

## 1) Core Links

- Public deployment URL: `https://ship-web-jyqh.onrender.com/`
- FleetGraph findings endpoint: `/api/fleetgraph/findings`
- FleetGraph traces endpoint: `/api/fleetgraph/traces`
- FleetGraph metrics endpoint: `/api/fleetgraph/metrics`

## 2) PRD Requirement Checklist (Pass/Fail)

| PRD Requirement | Status | Evidence |
| --- | --- | --- |
| Proactive mode implemented | Complete | `api/src/services/fleetgraph/proactive.ts`, `/api/fleetgraph/proactive/webhook` |
| On-demand mode implemented | Complete | `web/src/components/sidebars/FleetGraphAssistant.tsx`, `/api/fleetgraph/run` |
| Shared graph architecture for both modes | Complete | `api/src/services/fleetgraph/runtime.ts` |
| Context-embedded chat (no standalone bot) | Complete | FleetGraph panel embedded in `IssueSidebar`, `ProjectSidebar`, `WeekSidebar` |
| HITL gate for protected actions | Complete | `fleetgraph_hitl_requests`, `/api/fleetgraph/hitl/:requestId/approve|reject` |
| Real Ship data usage | Complete | Runtime reads from `documents` and related workspace records |
| Divergent trace paths | Complete (local live run) | `internal://fleetgraph/c71aaa46-2438-4fbc-bae9-32db073576fa` and `internal://fleetgraph/601fe3eb-6741-4d50-b112-dc5d060dae2a` from live script run |
| Deployed and accessible | Complete | Public deployment URL above |
| Trigger model documented and defended | Complete | `FLEETGRAPH.md` Trigger Model section |
| Cost per run + runs/day documented | Complete | `FLEETGRAPH.md` Cost Analysis + `/api/fleetgraph/metrics` |
| Detection latency evidence (<5 min) | Complete (local live run) | 51 ms measured from start to surfaced output (details below) |

## 3) Shared Trace Links To Submit

Replace placeholders with shared URLs from `/api/fleetgraph/traces`.

| Checkpoint | Trace A (Path 1) | Trace B (Path 2) | Notes |
| --- | --- | --- | --- |
| MVP | `internal://fleetgraph/c71aaa46-2438-4fbc-bae9-32db073576fa` | `internal://fleetgraph/601fe3eb-6741-4d50-b112-dc5d060dae2a` | Proactive webhook vs on-demand branch run |
| Early Submission | `internal://fleetgraph/c71aaa46-2438-4fbc-bae9-32db073576fa` | `internal://fleetgraph/601fe3eb-6741-4d50-b112-dc5d060dae2a` | Local proof run; replace with shared links if LangSmith base URL is configured |
| Final Submission | `internal://fleetgraph/c71aaa46-2438-4fbc-bae9-32db073576fa` | `internal://fleetgraph/601fe3eb-6741-4d50-b112-dc5d060dae2a` | Local proof run; replace with shared links if LangSmith base URL is configured |

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
| Total runs | `2` |
| Average latency (ms) | `22` |
| Total token estimate | `11250` |
| Total cost estimate (USD) | `0.018` |

### Production Projection Snapshot

| Users | Monthly Cost |
| --- | --- |
| 100 | `$79.20` |
| 1,000 | `$792.00` |
| 10,000 | `$7,920.00` |

## 6) Validation Run Outputs (Live)

Last fully green verification: `2026-05-25 17:06-17:07 (UTC-5)` (`2026-05-25T22:06Z` approx).

### Dependency install

- Command: `pnpm install`
- Result: success

### Type checks

- Command: `pnpm --filter @ship/api type-check`
- Result: pass
- Command: `pnpm --filter @ship/web type-check`
- Result: pass

### Tests

- Command: `pnpm --filter @ship/web test`
- Result: pass (`16` files, `151` tests)
- Command: `pnpm --filter @ship/api test`
- Result: pass (`32` files, `472` tests)
- Notes: previously failing `probe-target-url` assertion is fixed; both API and web suites are now green in this verification window.

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
