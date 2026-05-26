# FleetGraph Product Definition

This document is aligned to the following source-of-truth order:

1. `PRD.md`
2. `DELIVERABLES.md`
3. `FLEETGRAPH.md`
4. `USERS.md`
5. `ARCHITECTURE_DEFENSE_TALK_TRACK.md`
6. `ARCHITECTURE_DRAFT.md`

When any detail conflicts, the higher item in this list wins.

---

## Product Thesis

FleetGraph is a project intelligence agent for Ship.

Ship already shows what is happening. FleetGraph adds proactive and on-demand reasoning that identifies delivery risk, evidence gaps, and decision points early, then helps the right human take the next action with confidence.

FleetGraph is an intelligence overlay on Ship, not a standalone chatbot and not a separate system of record.

---

## Problem Statement

Project teams lose context quickly:

- Work drifts from plans and hypotheses.
- Blockers and stale items linger until late.
- Standups, retros, and approvals become inconsistent.
- Completion claims are often weakly evidenced.
- Compliance and QA gates are difficult to replay and audit.

Dashboard visibility alone is not enough. Teams need role-aware intelligence that detects important conditions, explains why they matter, and routes actions to the right person.

---

## Product Goals

Based on `PRD.md` and `FLEETGRAPH.md`, FleetGraph must:

- Run in two modes over one graph architecture:
  - Proactive mode (system-triggered)
  - On-demand mode (user-triggered, in context)
- Surface meaningful conditions without user prompting.
- Keep chat embedded in the Ship view context (issue/sprint/project/evidence), never as a generic standalone bot.
- Include explicit human-in-the-loop (HITL) gates for protected actions.
- Run on real Ship data (no mock-only behavior).
- Provide observable, branch-divergent execution traces.
- Meet detection latency target of under 5 minutes from event to surfaced finding.

---

## Non-Goals

FleetGraph does not:

- Replace Ship CRUD workflows, auth model, or document graph.
- Override user permissions or visibility boundaries.
- Autonomously execute destructive or approval-like actions without human confirmation.
- Act as a broad, unconstrained assistant detached from current view context.

---

## Target Users and Value

From `USERS.md`, FleetGraph supports a multi-role model:

- Engineering managers/directors/team leads
  - Need: accountability and approval visibility
  - Value: early risk surfacing, stronger plan/retro quality signals
- Engineers/week owners/ICs
  - Need: clearer definition of done and evidence expectations
  - Value: actionable evidence gap detection and next-step guidance
- Product/program managers
  - Need: hypothesis rigor and delivery-to-outcome alignment
  - Value: drift detection and prioritization support
- Security/compliance/QA reviewers
  - Need: reproducible verification and gate confidence
  - Value: missing-control and missing-artifact detection with traceability

---

## Functional Model

## 1) Proactive Mode (Agent Pushes)

The system runs via webhook, schedule, or hybrid trigger and proactively detects:

- stale or overdue work
- unresolved blockers past threshold
- missing standups/retros/approvals
- weak plans or hypotheses
- missing or non-replayable evidence artifacts
- compliance/security gate gaps
- cross-program drift between goals, commitments, and delivered outcomes

The agent decides when to surface and when to stay quiet.

## 2) On-Demand Mode (User Pulls)

The graph runs when a user invokes FleetGraph from the current Ship view.

The interaction must be context-aware and role-aware from the first step, using:

- current route and entity type/id
- user identity and permissions
- visible project graph scope

If opened on an issue, responses begin from that issue and dependencies. If opened on sprint/week/project/evidence context, responses begin from that context.

Both modes share one graph architecture. Trigger changes, graph logic does not.

---

## Capability and Action Boundaries

## Autonomous actions allowed

- Read and correlate relevant Ship records.
- Score and summarize risk by severity/confidence/owner/role.
- Draft in-product notes, recommendations, and notifications.
- Surface low-risk findings according to policy thresholds.

## Actions that always require HITL approval

- Status/priority/owner/scope changes
- Approval or rejection decisions
- Compliance/security gate pass/fail actions
- External notifications outside Ship
- New work creation implying team commitment

HITL prompts must include rationale, supporting evidence, affected records, and explicit approve/reject/snooze behavior.

---

## Trigger and Latency Model

FleetGraph uses a hybrid trigger model:

- Webhook/event-driven for low-latency high-signal updates
- Scheduled polling for time-threshold conditions and missed events
- On-demand invocation from embedded chat

Performance target:

- Detection latency: under 5 minutes

Design implication:

- Poll cadence and webhook handling must be configured to preserve the latency target while controlling cost.

---

## Trust, Safety, and Compliance Principles

From the defense and architecture docs, these are non-negotiable:

- Ship remains source of truth.
- No auth or permission bypass.
- Protected actions require explicit HITL.
- Every claim must include evidence references or an explicit missing-evidence statement.
- Observability must prove branch-divergent graph behavior.

---

## Architecture Direction

FleetGraph is a thin decision layer on top of existing Ship core:

1. Trigger intake (webhook/poll/in-context invoke)
2. Context and authorization resolution
3. Parallel fetch from Ship entities
4. Deterministic detectors
5. Conditional LLM synthesis (only when needed)
6. Risk scoring and role-based routing
7. HITL gate for protected actions
8. Output writeback to Ship surfaces
9. Trace/cost telemetry

Recommended runtime is LangGraph, or an equivalent implementation that produces comparable branch-level internal FleetGraph traces.

---

## Observability and Testing Requirements

Required product evidence from `PRD.md`:

- At least two shared trace links showing different execution paths.
- Trace-backed test cases for defined use cases.
- Real-data execution evidence (not mocked-only).
- Submission artifacts that prove proactive and on-demand behavior.

---

## Cost Requirements

Product reporting must include:

- development/testing token and spend tracking
- invocation counts
- production monthly projections for 100, 1,000, and 10,000 users
- documented assumptions for run frequency and token usage

Cost control strategy:

- deterministic pre-checks before LLM calls
- incremental fetches and caching
- branch/path telemetry for expensive execution patterns

---

## Deliverables and Timeline

This timeline reflects `DELIVERABLES.md` and `PRD.md`:

- Architecture Defense (4 hours after assignment)
  - defend responsibility scope, trigger strategy, and architecture
- MVP (Tuesday 11:59 PM)
  - core `FLEETGRAPH.md` MVP sections complete
  - at least one proactive path end-to-end
  - at least one HITL gate implemented
  - at least two divergent shared traces
  - deployed and accessible
- Early Submission (Thursday 11:59 PM)
  - test cases and architecture decisions completed with trace-backed validation
- Final Submission (Sunday noon)
  - `PRESEARCH.md` complete
  - full `FLEETGRAPH.md` complete (including cost analysis)
  - public deployment URL and final shared trace evidence

---

## Acceptance Criteria (Product-Level)

FleetGraph is product-ready for this sprint when all are true:

- Two-mode behavior works on one graph architecture.
- Embedded context-aware interaction is available in Ship.
- Proactive detection surfaces at least one meaningful condition end-to-end.
- HITL protection is active for protected actions.
- Branch-divergent traces are captured and shareable.
- Real Ship data is used.
- Deliverable files (`PRESEARCH.md`, `FLEETGRAPH.md`) are complete per checkpoint.

---

## Single-Sentence Product Definition

FleetGraph is a role-aware intelligence overlay for Ship that proactively and interactively detects delivery, evidence, and compliance risk, then routes trustworthy next actions through explicit human control.