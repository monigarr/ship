# FleetGraph on Ship — Architecture Draft

## Scope and Inputs

This draft is based on the current repository implementation (`GitHub/ship`) and these project artifacts:

- `PRD.md`
- `USERS.md`
- `FLEETGRAPH.md`
- `DELIVERABLES.md`

It documents:

1. What exists now in Ship (baseline architecture)
2. How FleetGraph maps onto that baseline
3. What needs to be added to deliver proactive + on-demand graph behavior
4. A phased path aligned with checkpoint deliverables

---

## 1) Current Ship Baseline (as implemented)

### Monorepo and runtime

- `pnpm` monorepo with:
  - `api/` (Express + PostgreSQL + WebSocket)
  - `web/` (React + Vite + TanStack Query + TipTap/Yjs)
  - `shared/` (shared TS contracts/utilities)
- Primary local run flow is `pnpm dev`; containerized local stack also supported.

### Backend architecture

- Express API in `api/src/app.ts` with:
  - security middleware (`helmet`, rate limiters, CSRF sync, session cookie)
  - auth/session + token support
  - broad route surface for documents/issues/projects/weeks/standups/team/dashboard/search/files/etc.
- PostgreSQL is the source of truth, queried directly via `pg` (raw SQL).
- Existing read-heavy intelligence endpoints already exist:
  - `GET /api/dashboard/my-work`
  - `GET /api/dashboard/my-focus`
  - `GET /api/dashboard/my-week`
  - `GET /api/accountability/action-items` (inference-based, no persistent issue creation)
- Existing AI-adjacent routes exist:
  - `POST /api/ai/analyze-plan`
  - `POST /api/ai/analyze-retro`
  - `GET /api/claude/context` (context pack for standup/review/retro interviews)

### Frontend architecture

- React app (`web/src/pages/App.tsx`) uses contextual navigation across docs/programs/projects/team/dashboard modes.
- `MyWeek` view already supports the human accountability loop:
  - plan/retro authoring and submission nudges
  - standup slots
  - assigned project visibility
- Action item UX exists via:
  - accountability banner
  - action items modal
  - real-time event hooks (`accountability:updated`)

### Data model and collaboration

- Unified document model with `document_type` conventions (wiki, issue, project, sprint, weekly_plan, weekly_retro, person, etc.).
- Relationship graph represented via `document_associations`.
- Week windows are computed from workspace start date + `sprint_number` semantics.
- Rich text collaboration uses TipTap + Yjs + WebSocket + IndexedDB persistence.

### Security and auth posture

- Session auth with CSRF for browser state-changing calls; Bearer token paths skip CSRF correctly.
- CAIA/PIV OAuth integration path exists.
- Rate limiting, secure cookie config, and basic hardening already wired.

---

## 2) FleetGraph Architecture Goal

Per PRD + FLEETGRAPH, FleetGraph must support two trigger modes over one reasoning graph:

- **Proactive mode:** system-triggered detections and notifications without user request.
- **On-demand mode:** context-aware in-product chat/reasoning bound to current view.

Core requirement: FleetGraph should be an intelligence layer over Ship's project graph, not a standalone chatbot and not a separate source of truth.

---

## 3) Target Overlay Architecture (FleetGraph on top of Ship)

## A. Execution Planes

- **Plane 1: Ship Core (existing)**
  - CRUD, auth, permissions, collaboration, document model, dashboards.
- **Plane 2: FleetGraph Intelligence (new/extended)**
  - event ingestion + scheduled scans
  - detector + reasoning graph
  - human-in-the-loop gate
  - findings and notification routing
- **Plane 3: Observability + Cost (new/extended)**
  - trace links per use case path
  - branch-path evidence
  - run/token/cost telemetry

## B. Graph Runtime

- Recommended orchestrator: **LangGraph** (already anticipated in PRD/FLEETGRAPH).
- Common graph for both triggers:
  1. Trigger intake (event, poll, or chat invocation)
  2. Context + authorization resolution
  3. Parallel data fetch over Ship domain entities
  4. Deterministic detectors (staleness, missing evidence, blocker age, review gaps)
  5. LLM reasoning/synthesis only when needed
  6. Risk scoring + routing
  7. HITL gate for protected actions
  8. Output writeback (note, alert, draft action, or approved mutation)
  9. Trace + metrics export

## C. Trigger Model (hybrid)

- **Webhook/event-driven:** low-latency reaction to high-signal changes (issue update, plan/retro submit, evidence changes, approval changes).
- **Scheduled polling:** catches missed events and purely time-based conditions (stale standups, aged blockers, overdue approvals).
- **On-demand invoke:** chat started from a specific Ship route/entity context.

This aligns with current docs and is the most defensible path for the <5 minute detection target while controlling cost.

## D. State model

- **Per-run state:** trigger metadata, principal, scoped entities, detector findings, branch decisions, outputs.
- **Persistent state:** last scan cursor, dedupe fingerprints, snooze decisions, pending approvals, unresolved findings.
- **Principle:** Ship remains source of truth; FleetGraph persists only intelligence metadata and control state.

## E. Human-in-the-loop (HITL)

- Mandatory gate before actions that alter assignments/status/approvals/compliance outcomes or send external notifications.
- Confirmation payload should always include:
  - proposed action
  - rationale
  - supporting evidence refs
  - confidence/severity
  - affected entities
  - dismiss/snooze/rollback semantics

---

## 4) Mapping to User Personas and Existing UX

From `USERS.md`, FleetGraph must serve directors/managers, engineers, PM/program, and compliance/audit roles.

Current Ship UX already has anchors for this:

- dashboard + accountability surfaces for managers/ICs
- project/week/retro flows for PM/engineering collaboration
- evidence and review documents for compliance posture

FleetGraph should initially plug into these surfaces rather than introducing a new primary navigation paradigm.

---

## 5) Recommended Component Additions

1. **FleetGraph Worker Service**
   - Runs scheduled scans + webhook handlers.
   - Can live as a separate worker process within same deployment boundary as API.

2. **FleetGraph Orchestrator Module**
   - Node definitions, branch conditions, detector registry, policy checks.

3. **Context Resolver**
   - Converts Ship route/entity/user scope into graph input envelope.

4. **Policy + Authorization Guard**
   - Enforces existing Ship permissions before every fetch/action.

5. **Findings Store**
   - Stores unresolved findings, dedupe hash, status, escalation history, snooze windows.

6. **Notification Router**
   - Routes by project membership + role heuristics from existing role/activity data.

7. **Trace and Cost Reporter**
   - Persists links and per-path telemetry required by MVP/early/final deliverables.

---

## 6) What Is Already Strong vs. What Is Missing

### Strong foundations already present

- Rich project graph in a unified document model
- API routes for weekly execution + accountability inference
- Existing AI analysis and Claude context support
- Real UI surfaces for action items, week workflows, and dashboard context
- Security and auth middleware stack mature enough for gated actions

### Key missing pieces for FleetGraph completion

- unified proactive trigger pipeline (webhook + scheduler + queue semantics)
- explicit graph orchestration runtime with branchable execution traces
- persisted finding lifecycle management (new/ack/snoozed/escalated/resolved)
- embedded context-aware FleetGraph chat entrypoints in targeted views
- standardized HITL confirmation UX for all protected actions
- productionized run/token/cost accounting for final reporting

---

## 7) Delivery Phasing (aligned to DELIVERABLES)

### Phase A: Architecture Defense (first checkpoint)

- Finalize graph topology, trigger rationale, and trust boundaries.
- Lock detector catalog for MVP use cases.

### Phase B: MVP

- Ship one proactive detection end-to-end.
- Enable trace publication with at least two divergent execution paths.
- Expose in-context chat entry and notification/action-item surfacing in existing UI.
- Demonstrate at least one HITL gate.

### Phase C: Early Submission

- Expand detector coverage to all declared use cases.
- Document architecture tradeoffs from real runs.
- Add trace-backed test case matrix.

### Phase D: Final

- Add cost instrumentation + projection model.
- Harden operational controls (retry/backoff/dedupe/noise suppression).
- Finalize deployment and observability evidence package.

---

## 8) Risks and Mitigations

- **Alert fatigue risk** -> confidence thresholds, dedupe, snooze windows, role-aware routing.
- **Cost blow-up risk** -> deterministic pre-filtering before LLM usage; incremental fetches.
- **Permission leakage risk** -> explicit authz checks at context resolution + action execution.
- **Trace quality risk** -> enforce branch markers and trace publishing checks in CI/release checklist.
- **Adoption risk** -> embed in existing Week/Project/Dashboard workflows instead of standalone bot UX.

---

## 9) Draft Decision Statement

FleetGraph should be implemented as an **intelligence overlay** on the existing Ship architecture, not as a replacement platform. The current codebase already provides the essential substrate (document graph, accountability endpoints, context APIs, and embedded workflow UI). The next work is to add a graph runtime, proactive trigger infrastructure, HITL controls, and observability/cost instrumentation so Ship transitions from descriptive project tracking to proactive, role-aware project intelligence.

