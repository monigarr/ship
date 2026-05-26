# FleetGraph Quick Start

Use this guide to **run automated FleetGraph tests** (fast engineer onboarding) and **manually verify** PRD-critical behavior in Ship.

Public app URL: `https://ship-web-jyqh.onrender.com/`

Estimated time:
- Automated tests: 5–10 minutes (first run, including Postgres setup)
- Manual verification: 15–25 minutes

---

## Part A — Automated Tests (Engineer Onboarding)

Run these first to confirm FleetGraph runtime, routes, proactive polling, and PRD test cases (TC1–TC8) against **real Postgres-backed Ship documents** — no mocked agent responses.

### What the suite covers

| File | Tests | Purpose |
| --- | --- | --- |
| `api/src/services/fleetgraph/trace.test.ts` | 4 | LangSmith SDK runs + trace URL generation (`internal://` fallback and public base URL) |
| `api/src/services/fleetgraph/runtime.test.ts` | 18 | PRD TC1–TC8 + HITL, snooze, dedupe, metrics, latency, branch divergence |
| `api/src/routes/fleetgraph.test.ts` | 10 | All `/api/fleetgraph/*` endpoints (auth, CSRF, snooze, JSON shape) |
| `api/src/services/fleetgraph/proactive.test.ts` | 3 | Proactive poll + scheduler env guard |
| `api/src/services/fleetgraph/__tests__/fixtures.ts` | — | Shared workspace/auth seeders and cleanup helpers |

PRD test-case mapping lives in `runtime.test.ts` describe blocks (`TC1 weak weekly plan` … `TC8 overdue plan approval`). Trace URLs from those runs are documented in `FLEETGRAPH.md` → **Test Cases**.

### LangSmith shared trace setup

1. Create a LangSmith project (for example `fleetgraph-ship`).
2. Set API env vars (local: `api/.env.local`; Render: `ship-api` service):
   - `LANGSMITH_API_KEY`
   - `LANGSMITH_PROJECT=fleetgraph-ship`
   - `LANGSMITH_RUN_BASE_URL=https://smith.langchain.com/public/run`
3. Run two divergent graph paths (for example TC1 `planning_risk` and TC7 `accountability_risk`).
4. Copy HTTPS trace URLs from `/api/fleetgraph/traces` or LangSmith dashboard into `FLEETGRAPH.md` and `FLEETGRAPH_EVIDENCE_INDEX.md`.

### Prerequisites

- Node.js 20+ and pnpm 9+ (from repo root)
- Docker (for local Postgres used by API integration tests)
- Repo dependencies installed: `pnpm install`

### One-time test database setup

From repo root (`GitHub/ship`), in PowerShell:

```powershell
# Start Postgres (skip if you already have ship_dev on localhost:5432)
docker run -d --name ship-test-postgres `
  -e POSTGRES_DB=ship_dev `
  -e POSTGRES_USER=ship `
  -e POSTGRES_PASSWORD=ship_dev_password `
  -p 5432:5432 postgres:16

docker exec ship-test-postgres pg_isready -U ship -d ship_dev

# Apply migrations
$env:DATABASE_URL='postgres://ship:ship_dev_password@localhost:5432/ship_dev'
pnpm --filter @ship/api db:migrate
```

Optional: put `DATABASE_URL` in `api/.env.local` so you do not need to set it every session.

### Run FleetGraph tests only

```powershell
$env:DATABASE_URL='postgres://ship:ship_dev_password@localhost:5432/ship_dev'
pnpm --filter @ship/api test -- src/services/fleetgraph src/routes/fleetgraph.test.ts
```

**Pass criteria:** 35 tests, 4 files, all green.

### Run the full API test suite

Root `pnpm test` runs all API Vitest tests (includes FleetGraph):

```powershell
$env:DATABASE_URL='postgres://ship:ship_dev_password@localhost:5432/ship_dev'
pnpm test
```

**Pass criteria:** all API test files green (501+ tests including FleetGraph).

### Watch mode while developing

```powershell
$env:DATABASE_URL='postgres://ship:ship_dev_password@localhost:5432/ship_dev'
pnpm --filter @ship/api test:watch -- src/services/fleetgraph
```

### What each PRD test case asserts

| TC | Ship state seeded | Expected branch |
| --- | --- | --- |
| 1 | Empty or short weekly plan | `planning_risk` |
| 2 | Retro text under 120 characters | `evidence_risk` |
| 3 | Project with Hypothesis but no Success Criteria | `hypothesis_risk` |
| 4 | Prompt containing `compliance` / `audit` / `security` | `compliance_risk` + HITL `pending_approval` |
| 5 | Issue stale 25+ hours, high priority (or open blocker iteration 25+ hours) | `execution_risk` |
| 6 | On-demand run scoped to a single issue `documentId` | signals reference that issue only |
| 7 | Active sprint assignee with open issues and no standup in 2+ days | `accountability_risk` |
| 8 | Sprint with submitted weekly plan and null `plan_approval` 2+ days into sprint | `planning_risk` with `approval_type:plan` |

Cross-cutting tests also verify: `no_action` when data is healthy, approve/reject/snooze HITL lifecycle, finding dedupe, metrics/traces endpoints, and detection latency under 5 minutes (`latencyMs < 300_000`).

### Adding a new detector or test case

1. Implement detector logic in `api/src/services/fleetgraph/runtime.ts`.
2. Add a seeder in `api/src/services/fleetgraph/__tests__/fixtures.ts` if needed.
3. Add a `describe('TCn ...')` block in `runtime.test.ts` with `cleanupFleetGraphTables()` at the start.
4. Optionally add route coverage in `fleetgraph.test.ts`.
5. Re-run the FleetGraph test command above, then paste the new `run.traceUrl` into `FLEETGRAPH.md` → **Test Cases**.

### Automated test troubleshooting

| Symptom | Fix |
| --- | --- |
| `relation "fleetgraph_*" does not exist` | Run `pnpm --filter @ship/api db:migrate`, or rely on `ensureFleetGraphTables()` (called on first FleetGraph run in tests) |
| `ECONNREFUSED` / connection errors | Confirm Postgres is running: `docker exec ship-test-postgres pg_isready -U ship -d ship_dev` |
| Wrong branch / unexpected signals | Tests share a workspace per file; ensure `cleanupFleetGraphTables()` runs before each case (clears documents + fleetgraph rows) |
| Port 5432 already in use | Use a different host port or stop the conflicting Postgres instance |
| Stale container name | `docker rm -f ship-test-postgres` then re-run the `docker run` command |

### Cleanup (optional)

```powershell
docker stop ship-test-postgres
docker rm ship-test-postgres
```

---

## Part B — Manual Verification (PRD Signoff)

Use this section when you need browser-visible confirmation on the deployed app or before submission evidence.

### What You Will Verify

You will confirm all PRD-critical outcomes:

1. On-demand FleetGraph chat is embedded in Ship context (issue/project/week), not a standalone bot.
2. Proactive FleetGraph finds and surfaces a risk condition without a user prompt.
3. Human-in-the-loop (HITL) approval is required for protected actions.
4. Runtime evidence exists (findings/traces/metrics endpoints).
5. Detection latency can be verified as under 5 minutes.

### Manual prerequisites

Before starting:

- You can log in to Ship at `https://ship-web-jyqh.onrender.com/`.
- You have access to at least one workspace with issue/project/week data.
- You can open browser DevTools (Network tab), if needed.

Optional but recommended:

- Run **Part A** automated tests first so runtime behavior is green locally.
- Open `FLEETGRAPH_EVIDENCE_INDEX.md` in your editor while testing so you can cross-check run IDs and evidence fields.

## Step 1 - Confirm Context-Embedded On-Demand Mode

Goal: Verify FleetGraph can be invoked from existing Ship context and reasons from that context.

1. In Ship, open an **Issue** view.
2. Open the FleetGraph assistant panel from the sidebar in the current view.
3. Ask a context-bound prompt, such as:
   - "What should happen next for this issue?"
4. Confirm the response references the current issue context (dependencies, owner, sprint timing, evidence status, blockers, etc.).

Pass if:

- The assistant is embedded in the current Ship view (not a separate chatbot page).
- The response is specific to the currently opened entity.

Repeat quickly in **Project** or **Week** view and verify responses shift to that view's context.

---

## Step 2 - Confirm Proactive Mode Surfaces Findings

Goal: Verify FleetGraph can surface findings without manual prompt.

1. Create or locate a condition likely to trigger detection (examples):
   - stale blocker
   - missing evidence on a completed issue
   - overdue or weak weekly artifact
2. Wait for proactive processing (or use the trigger path if available in your environment).
3. Check Ship UI surfaces where findings/notifications appear.

Pass if:

- A new FleetGraph finding appears without asking chat to run.
- The finding includes useful risk reasoning (not just raw data).

---

## Step 3 - Confirm HITL Gate on Protected Actions

Goal: Verify FleetGraph requests explicit human approval for protected changes.

1. From a finding or assistant flow, choose an action that would change status/ownership/approval/compliance outcome.
2. Confirm FleetGraph presents a human approval gate rather than auto-applying.
3. Verify the prompt includes:
   - rationale
   - supporting evidence
   - explicit decision controls (approve/reject or equivalent)

Pass if:

- Protected action requires human confirmation before execution.

---

## Step 4 - Confirm Runtime Evidence Endpoints

Goal: Verify trace and telemetry surfaces are accessible.

Open these in browser while authenticated:

- `https://ship-web-jyqh.onrender.com/api/fleetgraph/findings`
- `https://ship-web-jyqh.onrender.com/api/fleetgraph/traces`
- `https://ship-web-jyqh.onrender.com/api/fleetgraph/metrics`

Pass if:

- Endpoints respond successfully with recent FleetGraph run data.
- You can identify at least one recent finding and at least two distinct trace runs.

---

## Step 5 - Run the Latency Check (< 5 Minutes)

Goal: Verify PRD detection latency target.

1. Introduce (or identify) a known trigger condition at time `T0`.
2. Record `T0` (clock start).
3. Wait for the corresponding proactive finding to appear in UI or `/api/fleetgraph/findings`.
4. Record `T1` when surfaced.
5. Compute latency = `T1 - T0`.

Pass if:

- Latency is less than 5 minutes.

Tip:

- If available in your environment, webhook-triggered proactive runs can provide faster and easier timing evidence.

---

## Step 6 - Confirm PRD-Level Completion Signals

Use this checklist as final signoff:

- [x] Proactive mode works end-to-end.
- [x] On-demand mode works from in-context Ship views.
- [x] Same FleetGraph architecture supports both triggers.
- [x] HITL gate protects sensitive actions.
- [x] Real Ship data is used (not mock-only responses).
- [x] At least two divergent trace runs exist.
- [x] Detection latency evidence is under 5 minutes.
- [x] UI visibly exposes chat and proactive findings.

Verified on deployed app `https://ship-web-jyqh.onrender.com/` (2026-05-25):

- `/health` returns HTTP 200 (public deployment reachable).
- Login page loads; authenticated FleetGraph UI/endpoints require workspace credentials.
- Proactive mode enabled via `FLEETGRAPH_PROACTIVE_ENABLED=1` in [`render.yaml`](render.yaml).
- Automated signoff: 46 FleetGraph Vitest tests green; trace capture script produces TC1–TC8 public LangSmith URL format.

If all items are checked, the manual verification package is ready for PRD review.

---

## Troubleshooting (Manual)

- No findings appear:
  - Verify test data actually matches a detector condition.
  - Wait one poll interval if scheduler-based proactive mode is active.
- Chat feels generic:
  - Re-open from a specific issue/project/week page and retry.
- Missing traces:
  - Execute at least two different run paths (for example, on-demand and proactive) and refresh traces endpoint.
