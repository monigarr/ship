# FleetGraph Quick Start

Use this guide to **run automated FleetGraph tests** (fast engineer onboarding) and **manually verify** PRD-critical behavior in Ship.

| | |
| --- | --- |
| **Branch** | `gfa2_wk5` |
| **Public app** | `https://ship-web-jyqh.onrender.com/` |
| **Last updated** | 2026-05-26 |
| **Source of truth** | This file is the canonical quick start |

Estimated time:

- Automated tests: 5–10 minutes (first run, including Postgres setup)
- Seed demo data: 2–5 minutes
- Manual verification: 15–25 minutes

### Related docs (read these for grading context)

| File | Purpose |
| --- | --- |
| [`PRD.md`](./PRD.md) | Source of truth for requirements, test cases, deliverables |
| [`FLEETGRAPH.md`](./FLEETGRAPH.md) | Agent responsibility, graph diagram, use cases, trigger model, test-case trace links, cost analysis |
| [`USERS.md`](./USERS.md) | Personas (director, manager, engineer, PM, auditor) and UC1–UC4 |
| [`PRESEARCH.md`](./PRESEARCH.md) | Pre-search checklist |
| [`FLEETGRAPH_EVIDENCE_INDEX.md`](./FLEETGRAPH_EVIDENCE_INDEX.md) | Submission evidence packaging, trace URLs, latency proof |

---

## Part 0 — Fast Observability Onboarding and Visual Trace Verification

Use this when a human needs a quick orientation to FleetGraph observability and a fast visual/manual confirmation path.

### Fast onboarding bullets (internal observability)

- FleetGraph traces are **internal to Ship**, not a third-party trace host; every run emits `traceId` + `traceUrl`.
- Trace execution data is persisted in API runtime tables (`fleetgraph_runs`, `fleetgraph_trace_events`) and exposed in authenticated endpoints.
- Humans can inspect traces in three places:
  - FleetGraph assistant links (**Open trace details**)
  - Trace list API (`/api/fleetgraph/traces`)
  - Trace detail page (`/fleetgraph/traces/:traceId`)
- Divergent branches (for example `planning_risk` vs `accountability_risk`) are required evidence for grading.
- Canonical evidence packaging lives in [`FLEETGRAPH_EVIDENCE_INDEX.md`](./FLEETGRAPH_EVIDENCE_INDEX.md); TC mappings live in [`FLEETGRAPH.md`](./FLEETGRAPH.md).

### Visual/manual verification quick path (Local and Deployed)

| Step | Local path | Deployed path |
| --- | --- | --- |
| 1. Run or trigger FleetGraph | Seed + run via local API (`db:seed:fleetgraph` + on-demand or proactive trigger) | Use `[SYNTH-HITL]` workspace and run on-demand/proactive scenarios |
| 2. Open trace list | `http://localhost:5173/api/fleetgraph/traces` (authenticated) | `https://ship-web-jyqh.onrender.com/api/fleetgraph/traces` (authenticated) |
| 3. Open trace detail | Click a `traceUrl` to `/fleetgraph/traces/{traceId}` | Click a `traceUrl` to `/fleetgraph/traces/{traceId}` |
| 4. Visually confirm fields | Branch, trigger, latency budget, timeline events, findings | Branch, trigger, latency budget, timeline events, findings |
| 5. Confirm divergence | Capture at least two traces with different branches | Capture at least two traces with different branches |
| 6. Record evidence | Paste links in `FLEETGRAPH.md` + Evidence Index | Paste links in `FLEETGRAPH.md` + Evidence Index |

Pass criteria (both paths):

- Trace links stay inside Ship (`/fleetgraph/traces/{traceId}`).
- At least two branch-divergent traces are visible and shareable to authenticated workspace members.
- Trace API (`/api/fleetgraph/traces`) and trace detail route are both accessible.

---

## Part A — Automated Tests (Engineer Onboarding)

Run these first to confirm FleetGraph runtime, routes, proactive polling, and PRD test cases (TC1–TC8) against **real Postgres-backed Ship documents** — no mocked agent responses.

### What the suite covers

| File | Tests | Purpose |
| --- | --- | --- |
| `api/src/services/fleetgraph/trace.test.ts` | 4 | Internal trace URL generation + safe trace config diagnostics |
| `api/src/services/fleetgraph/runtime.test.ts` | 18 | PRD TC1–TC8 + HITL, snooze, dedupe, metrics, latency, branch divergence |
| `api/src/routes/fleetgraph.test.ts` | 11 | All `/api/fleetgraph/*` endpoints (auth, CSRF, snooze, JSON shape) |
| `api/src/services/fleetgraph/proactive.test.ts` | 9 | Proactive poll, webhook debounce, scan tiers, scheduler env guard |
| `api/src/services/fleetgraph/notifications.test.ts` | 2 | Role-based notification draft routing |
| `api/src/services/fleetgraph/seed-helpers.ts` | — | Shared document seed helpers (used by tests and `db:seed:fleetgraph`) |
| `api/src/services/fleetgraph/__tests__/fixtures.ts` | — | Test workspace/auth helpers and cleanup |

PRD test-case mapping lives in `runtime.test.ts` describe blocks (`TC1 weak weekly plan` … `TC8 overdue plan approval`). Trace URLs from those runs are documented in `FLEETGRAPH.md` → **Test Cases**.

### Internal trace setup

1. Ensure FleetGraph traces are enabled in Ship API (default internal path is `/fleetgraph/traces/:traceId`).
2. Optionally set `FLEETGRAPH_TRACE_BASE_PATH` if you need a custom internal route prefix.
3. Run two divergent graph paths (for example TC1 `planning_risk` and TC7 `accountability_risk`).
4. Copy internal trace URLs from `/api/fleetgraph/traces` into `FLEETGRAPH.md` and `FLEETGRAPH_EVIDENCE_INDEX.md`.

**Capture all TC1–TC8 trace URLs in one script run:**

```powershell
$env:DATABASE_URL='postgres://ship:ship_dev_password@localhost:5432/ship_dev'
$env:FLEETGRAPH_SYNTHESIS_ENABLED='0'
pnpm --filter @ship/api exec tsx src/scripts/capture-fleetgraph-traces.ts
```

Paste printed URLs into `FLEETGRAPH.md` → **Test Cases**.

### Prerequisites

- Node.js 20+ and pnpm 9+ (from repo root)
- Docker (for local Postgres used by API integration tests)
- Repo dependencies installed: `pnpm install`
- Shared package built (required before some API scripts/tests):

```powershell
pnpm run build:shared
```

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

### Seed PRD + USERS.md demo data (local UI verification)

After migrations, load base workspace data and FleetGraph PRD test-case states (TC1–TC8) aligned with [`USERS.md`](./USERS.md) personas:

```powershell
$env:DATABASE_URL='postgres://ship:ship_dev_password@localhost:5432/ship_dev'
pnpm --filter @ship/api db:seed
pnpm --filter @ship/api db:seed:fleetgraph
```

**Local login:** `dev@ship.local` / `admin123`

**Where to look in Ship UI:**

| Marker | Location |
| --- | --- |
| Program | **`[FG-PRD] FleetGraph PRD Evidence Program`** (prefix `FGPRD`) |
| Documents | Filter by prefix **`[FG-PRD]`** |
| Wiki index | **`[FG-PRD] FleetGraph PRD Verification Index`** |

**Personas seeded on person documents** (`fleetgraph_role`, `use_case`):

| Email | Role | USERS use case |
| --- | --- | --- |
| `dev@ship.local` | director | UC1 |
| `alice.chen@ship.local`, `bob.martinez@ship.local` | manager | UC1 |
| `emma.johnson@ship.local`, `frank.garcia@ship.local` | engineer | UC2 |
| `grace.lee@ship.local`, `carol.williams@ship.local` | pm | UC3 |
| `henry.patel@ship.local`, `david.kim@ship.local` | auditor | UC4 |

**Local `[FG-PRD]` demo documents (TC1–TC8):**

| TC | Seeded artifact | How to trigger FleetGraph |
| --- | --- | --- |
| 1 | Empty weekly plan | On-demand scan → `planning_risk` |
| 2 | Short retro (`"Done."`) | Proactive webhook or on-demand → `evidence_risk` |
| 3 | Hypothesis-only project | Open project + on-demand → `hypothesis_risk` |
| 4 | Open CVE issue | On-demand chat: *"compliance gate review"* → `compliance_risk` + HITL |
| 5 | Blocked issue near sprint end | Proactive webhook/poll → `execution_risk` |
| 6 | Stale context issue | Open issue + ask *"what should happen next?"* |
| 7 | Sprint missing standup | Proactive poll → `accountability_risk` |
| 8 | Plan submitted, approval pending | Proactive webhook → `planning_risk` (`approval_type:plan`) |

Re-run safely: `db:seed:fleetgraph` is idempotent (skips existing `[FG-PRD]` titles).

### Seed deployed Render app (remote synthetic workspace)

For the **deployed** app, use the remote synthetic workspace seeder ([`USERS.md`](./USERS.md) UC1–UC4 + HITL edge cases):

```powershell
$env:SHIP_BASE_URL='https://ship-web-jyqh.onrender.com'
$env:SHIP_EMAIL='your@email.com'
$env:SHIP_PASSWORD='your-password'
$env:SHIP_SYNTH_RESUME='1'
pnpm --filter @ship/api seed:remote-synthetic
```

| Setting | Default | Purpose |
| --- | --- | --- |
| Workspace name | `GFA Synthetic HITL Workspace` | Isolated demo workspace on Render |
| Document prefix | `[SYNTH-HITL]` | Filter programs/issues/wiki in UI |
| `SHIP_SYNTH_RESUME=1` | — | Reuse existing workspace; skip duplicates |

**Remote programs (USERS UC coverage):**

- `[SYNTH-HITL] UC1 Manager Accountability`
- `[SYNTH-HITL] UC2 Engineer Execution Evidence`
- `[SYNTH-HITL] UC3 PM Hypothesis Validation`
- `[SYNTH-HITL] UC4 Compliance Security Verification`

**Edge cases included:** overdue weekly plan, approval gap, missing retro, unassigned backlog issue, cancelled hypothesis, open security verification gap.

Optional env overrides: `SHIP_SYNTH_WORKSPACE_NAME`, `SHIP_SYNTH_DRY_RUN=1`, `SHIP_SYNTH_DELAY_MS=200`.

### Run FleetGraph tests only

```powershell
$env:DATABASE_URL='postgres://ship:ship_dev_password@localhost:5432/ship_dev'
pnpm --filter @ship/api test -- src/services/fleetgraph src/routes/fleetgraph.test.ts
```

**Pass criteria:** targeted FleetGraph service + route tests pass with no failures.

### Run the full API test suite

Root `pnpm test` runs all API Vitest tests (includes FleetGraph):

```powershell
$env:DATABASE_URL='postgres://ship:ship_dev_password@localhost:5432/ship_dev'
pnpm test
```

**Pass criteria:** full API suite passes with no failures.

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
2. Add a seeder in `api/src/services/fleetgraph/seed-helpers.ts` if needed.
3. Add a `describe('TCn ...')` block in `runtime.test.ts` with `cleanupFleetGraphTables()` at the start.
4. Optionally add route coverage in `fleetgraph.test.ts`.
5. Re-run the FleetGraph test command above, then paste the new `run.traceUrl` into `FLEETGRAPH.md` → **Test Cases**.

### Automated test troubleshooting

| Symptom | Fix |
| --- | --- |
| `relation "fleetgraph_*" does not exist` | Run `pnpm --filter @ship/api db:migrate`, or rely on `ensureFleetGraphTables()` (called on first FleetGraph run in tests) |
| `ECONNREFUSED` / connection errors | Confirm Postgres is running: `docker exec ship-test-postgres pg_isready -U ship -d ship_dev` |
| `Cannot find module '@ship/shared/dist/index.js'` | Run `pnpm run build:shared` from repo root |
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
- Open [`FLEETGRAPH_EVIDENCE_INDEX.md`](./FLEETGRAPH_EVIDENCE_INDEX.md) in your editor while testing so you can cross-check run IDs and evidence fields.
- On **Render:** switch to **`GFA Synthetic HITL Workspace`** and filter `[SYNTH-HITL]`.
- On **local dev:** use **`Ship Workspace`** after `db:seed` + `db:seed:fleetgraph` and filter `[FG-PRD]`.

### FleetGraph UI locations

FleetGraph is embedded in context sidebars (not a standalone page):

- **Issue view** → `IssueSidebar` → FleetGraph assistant panel
- **Project view** → `ProjectSidebar` → FleetGraph assistant panel
- **Week/Sprint view** → `WeekSidebar` → FleetGraph assistant panel

Findings and HITL controls also surface inside the FleetGraph assistant (approve / reject / snooze).

---

## Step 1 - Confirm Context-Embedded On-Demand Mode

Goal: Verify FleetGraph can be invoked from existing Ship context and reasons from that context.

1. In Ship, open an **Issue** view.
2. Open the FleetGraph assistant panel from the sidebar in the current view.
3. Ask a context-bound prompt, such as:
   - "What should happen next for this issue?"
4. Confirm the response references the current issue context (dependencies, owner, sprint timing, evidence status, blockers, etc.).

**Fast path with seeded data:**

- **Local:** open **`[FG-PRD] TC6 Context Issue — What Should Happen Next?`**
- **Render:** open any in-progress issue under `[SYNTH-HITL] UC2 …`

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

**Fast path with seeded data:**

- **Local:** wait up to 3 minutes (`FLEETGRAPH_POLL_INTERVAL_MS=180000` on Render) or trigger webhook if wired; TC7/TC8 `[FG-PRD]` sprints are built for proactive detectors.
- **Render:** proactive mode is on via `FLEETGRAPH_PROACTIVE_ENABLED=1` in [`render.yaml`](./render.yaml).

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

**Fast path with seeded data:**

- Open **`[FG-PRD] TC4 Open CVE Remediation Pending Replay Evidence`** (local) or **`[SYNTH-HITL] UC4 Open CVE …`** (Render).
- In FleetGraph chat, prompt: *"Run compliance gate review for this remediation"*
- Expect `compliance_risk` finding with **pending HITL** — approve or reject from the assistant UI.

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

**Example divergent internal traces (from automated TC runs):**

- TC1 `planning_risk`: `/fleetgraph/traces/d543c205-754e-44d8-8ffd-ef7c95f8a75c`
- TC7 `accountability_risk`: `/fleetgraph/traces/aac37d8f-711c-43c9-a4a7-aa3817b1c614`

Internal observability policy (2026-05-26): keep trace links inside Ship and verify they open for authenticated workspace members.

To regenerate current internal trace URLs, run:

```powershell
$env:DATABASE_URL='postgres://ship:ship_dev_password@localhost:5432/ship_dev'
$env:FLEETGRAPH_SYNTHESIS_ENABLED='0'
pnpm --filter @ship/api exec tsx src/scripts/capture-fleetgraph-traces.ts
```

Full index: [`FLEETGRAPH_EVIDENCE_INDEX.md`](./FLEETGRAPH_EVIDENCE_INDEX.md) and [`FLEETGRAPH.md`](./FLEETGRAPH.md) → **Test Cases**.

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
- Documented live measurement: **51 ms** (see [`FLEETGRAPH_EVIDENCE_INDEX.md`](./FLEETGRAPH_EVIDENCE_INDEX.md) §4).

---

## Step 6 - Confirm PRD-Level Completion Signals

Use this checklist as final signoff:

- [x] Proactive mode works end-to-end.
- [x] On-demand mode works from in-context Ship views.
- [x] Same FleetGraph architecture supports both triggers.
- [x] HITL gate protects sensitive actions.
- [x] Real Ship data is used (not mock-only responses).
- [x] At least two divergent **internally resolvable** trace runs exist.
- [x] Detection latency evidence is under 5 minutes.
- [x] UI visibly exposes chat and proactive findings.

Verified on deployed app `https://ship-web-jyqh.onrender.com/` (2026-05-26):

- `/health` returns HTTP 200 (public deployment reachable).
- Login page loads; authenticated FleetGraph UI/endpoints require workspace credentials.
- Proactive mode enabled via `FLEETGRAPH_PROACTIVE_ENABLED=1` in [`render.yaml`](./render.yaml).
- Remote synthetic workspace **`GFA Synthetic HITL Workspace`** seeded with `[SYNTH-HITL]` UC1–UC4 data (`seed:remote-synthetic`).
- Local **`Ship Workspace`** supports `[FG-PRD]` TC1–TC8 demo data via `db:seed:fleetgraph`.
- Automated signoff: FleetGraph Vitest suite verifies TC1–TC8 paths and `capture-fleetgraph-traces.ts` produces internal trace links.

If all items are checked, the manual verification package is ready for PRD review.

---

## Part C — Optional Local Full-Stack Dev

Run API + web against local Postgres for end-to-end UI verification:

```powershell
# Terminal 1 — API
$env:DATABASE_URL='postgres://ship:ship_dev_password@localhost:5432/ship_dev'
pnpm --filter @ship/api dev

# Terminal 2 — Web (default http://localhost:5173)
pnpm --filter @ship/web dev
```

Copy `api/.env.example` → `api/.env.local` and set `CORS_ORIGIN=http://localhost:5173`.

FleetGraph env vars (optional): see `api/.env.example` → FleetGraph / Observability section.

---

## Troubleshooting (Manual)

- No findings appear:
  - Verify test data actually matches a detector condition (see TC table in Part A).
  - Wait one poll interval if scheduler-based proactive mode is active (default 3 minutes on Render).
  - Confirm you are in the correct workspace (`Ship Workspace` local / `GFA Synthetic HITL Workspace` on Render).
- Chat feels generic:
  - Re-open from a specific issue/project/week page and retry.
  - Use seeded TC6 issue or a `[SYNTH-HITL]` issue with clear state.
- Missing traces:
  - Execute at least two different run paths (for example, on-demand and proactive) and refresh traces endpoint.
  - Open `/api/fleetgraph/traces` and navigate to `/fleetgraph/traces/{traceId}` for details.
- HITL not appearing:
  - Use a compliance/audit/security prompt (TC4) or a finding marked `requiresHitl`.

---

## Key npm scripts (reference)

| Command | Purpose |
| --- | --- |
| `pnpm --filter @ship/api db:migrate` | Apply database migrations |
| `pnpm --filter @ship/api db:seed` | Base Ship workspace + users |
| `pnpm --filter @ship/api db:seed:fleetgraph` | `[FG-PRD]` TC1–TC8 + USERS personas (local) |
| `pnpm --filter @ship/api seed:remote-synthetic` | `[SYNTH-HITL]` UC1–UC4 workspace (Render) |
| `pnpm --filter @ship/api test -- src/services/fleetgraph …` | FleetGraph test suite |
| `pnpm --filter @ship/api exec tsx src/scripts/capture-fleetgraph-traces.ts` | Print TC1–TC8 trace URLs |

---

## Publishing dev work (GitHub + GitLab client mirrors)

Keep branch **`gfa2_wk5`** current on **both** remotes so clients always see the latest FleetGraph PRD deliverables.

**One-time setup** (from repo root):

```powershell
git remote add gitlab https://labs.gauntletai.com/monicapeters/ship.git
git remote set-url --push origin https://github.com/monigarr/ship.git
git remote set-url --add --push origin https://labs.gauntletai.com/monicapeters/ship.git
```

After setup, a single push updates both mirrors:

```powershell
git push origin gfa2_wk5
```

**Verify both remotes match:**

```powershell
git fetch origin gitlab
git log -1 --oneline origin/gfa2_wk5
git log -1 --oneline gitlab/gfa2_wk5
```

Write commit messages tied to [`PRD.md`](./PRD.md) deliverables (MVP modes, HITL, test cases TC1–TC8, observability traces, deployment, seed/verification docs).
