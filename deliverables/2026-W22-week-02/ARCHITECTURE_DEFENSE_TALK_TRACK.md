# FleetGraph Architecture Defense Talk Track

## 60-Second Thesis

FleetGraph should be built as an intelligence overlay on existing Ship, not as a parallel platform.  
Ship already has the core graph substrate (documents, associations, role-aware workflows, accountability surfaces).  
The architecture decision is to add a branchable graph runtime, hybrid triggers, and human-in-the-loop controls on top of that substrate to satisfy PRD requirements with minimal platform risk.

---

## Position to Defend

- Reuse Ship core (`api` + `web` + unified document graph) as system of record.
- Add FleetGraph as a thin, explicit decision layer:
  - detector + reasoning graph runtime
  - proactive trigger pipeline (event + poll)
  - HITL gating + role-routed notifications
  - trace + cost observability

---

## Why This Is the Right Architecture

### 1) Fastest path to MVP confidence

- Existing endpoints already provide inference context (`/api/dashboard/*`, `/api/accountability/action-items`, `/api/claude/context`).
- We can demonstrate end-to-end proactive detection without rewriting data model or UI shell.

### 2) Lowest integration risk

- Security, auth, CSRF, role context, and workspace scoping already exist in `api/src/app.ts`.
- Keeping Ship as source of truth avoids data drift and sync complexity.

### 3) PRD compliance by design

- Same graph serves proactive and on-demand modes.
- Embedded, context-aware interaction is preserved (not a standalone chatbot).
- HITL guarantees high-impact actions remain human-approved.

### 4) Cost containment

- Deterministic checks run first; LLM invoked only on actionable findings.
- Hybrid trigger model avoids expensive full scans while meeting latency targets.

---

## Core Architecture in One Slide

1. Trigger intake (webhook, poll, or in-context invoke)  
2. Context + authz resolution (user/service scope)  
3. Parallel fetch over Ship entities (issues/weeks/plans/retros/evidence/roles)  
4. Deterministic detectors (staleness, blockers, evidence gaps, review gaps)  
5. Conditional reasoning node (LLM synthesis only when needed)  
6. Risk score + routing (role/severity/confidence)  
7. HITL gate for protected actions  
8. Output writeback + trace/cost telemetry

---

## Tradeoffs (and why we accept them)

- **Hybrid triggers add operational complexity**  
  We accept this because poll-only misses latency targets and webhook-only misses time-based conditions.

- **Another service/process (worker) to run**  
  We accept this to cleanly separate background proactive work from user-request path latency.

- **HITL slows some actions**  
  We accept this for trust, auditability, and prevention of high-cost autonomous mistakes.

---

## Anticipated Pushback and Rebuttals

### Pushback: "Why not just do chat-only?"

Rebuttal: PRD requires proactive mode and graph branching; chat-only cannot satisfy detection latency and autonomous surfacing goals.

### Pushback: "Why not full event-driven, no polling?"

Rebuttal: Several required signals are time-threshold based (staleness/overdue/blocker age) and need scheduled evaluation.

### Pushback: "Why not build a separate FleetGraph datastore?"

Rebuttal: It creates consistency and permission drift risk; Ship already contains authoritative graph and auth context.

### Pushback: "Why use LLM at all?"

Rebuttal: Deterministic detectors identify conditions; LLM is reserved for synthesis, prioritization, and role-tailored explanation.

---

## Non-Negotiables

- Ship remains source of truth.
- No privileged bypass of existing auth/visibility constraints.
- Any destructive or approval-like action goes through explicit HITL.
- Every surfaced claim must include evidence refs or an explicit missing-evidence statement.
- Observability traces must show divergent branches, not linear pipelines.

---

## MVP Defense Checklist

- At least one proactive detection path runs end-to-end.
- At least one on-demand context-aware path runs from real Ship view context.
- At least one HITL gate exercised with approve/reject behavior.
- At least two shared traces show different execution branches.
- Trigger model rationale and cost/latency tradeoff are explicitly documented.

---

## Closing Statement

This architecture is intentionally conservative where correctness and trust matter (data, auth, HITL), and intentionally adaptive where intelligence matters (detector + graph + selective LLM reasoning). It delivers PRD-required behavior quickly while preserving the operational reality of the existing Ship platform.

