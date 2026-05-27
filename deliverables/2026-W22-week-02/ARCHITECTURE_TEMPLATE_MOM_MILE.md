# FleetGraph Architecture (M.O.M. + M.I.L.E.)

# ============================================================================
# PROJECT ARCHITECTURE
# ============================================================================
# Project Name: FleetGraph on Ship
# Repository: ship (FleetGraph branch scope)
# Version: 1.1
# Status: In delivery (Architecture Defense -> MVP -> Early -> Final)
# Classification: Internal (engineering + grading artifacts)
# Authors: Monica Peters, monigarr@monigarr.com
# Organization: Gauntlet AI Challenger Program
# Primary Maintainers: Monica Peters (primary), project reviewers (secondary)
# Created: 2026-05-25
# Last Updated: 2026-05-25
# License: Inherits repository license
# ============================================================================
#
# DESCRIPTION
# ----------------------------------------------------------------------------
# FleetGraph is implemented as an intelligence overlay on existing Ship:
# - Ship remains source of truth for records, auth, and collaboration.
# - FleetGraph adds proactive + on-demand graph reasoning.
# - Protected actions are gated by explicit human approval (HITL).
# - Observability is first-class via branch-divergent trace evidence.
#
# ============================================================================

---

# 1. Executive Summary

## Overview

FleetGraph is a role-aware project intelligence layer on top of Ship. It detects execution, evidence, and compliance risks early, then routes evidence-backed next actions to the right human while preserving Ship permissions and workflow context.

## Business Objective

- Primary business problem: teams miss high-impact delivery/compliance signals until late because dashboard visibility alone is not enough.
- Expected ROI: reduced surprise misses, faster review cycles, fewer weak approvals, lower audit friction.
- Strategic value: converts Ship from descriptive tracking to proactive, decision-supporting intelligence.
- Long-term operational intent: maintain one graph architecture that supports both proactive and on-demand workflows at increasing scale.

## Operational Philosophy

This project follows:

- AI-first engineering where deterministic checks run before expensive reasoning.
- AI-native architecture with explicit graph branches, shared state, and traceability.
- Human-in-the-loop accountability for all protected or high-impact actions.
- Enterprise operational rigor from day one (auth, observability, governance).

---

# 2. MoniGarr Operating Model (M.O.M.)

## Core Engineering Principles

### 2.1 Human Accountability First

AI may classify and recommend, but humans retain authority over approvals, assignment changes, compliance decisions, and deployment-impacting actions.

### 2.2 Ancient + Human + Artificial Intelligence Integration

- Traditional systems: Ship process artifacts (plans, retros, approvals, evidence, issue lifecycle).
- Human reasoning: role-specific judgment by managers, engineers, PMs, compliance reviewers.
- AI acceleration: proactive signal detection, synthesis, prioritization, and recommendation drafting.

All three layers are visible through evidence references and run traces.

### 2.3 Enterprise from Day One

Architecture decisions prioritize:

- hardened auth and permission boundaries
- maintainable node-based orchestration
- branch-level observability
- documentation and handoff readiness

### 2.4 Documentation as Infrastructure

`FLEETGRAPH.md`, `PRODUCT.md`, `USERS.md`, and this architecture file are treated as operating assets that anchor implementation and grading evidence.

### 2.5 Handoff-Ready Engineering

The system is designed so engineers, reviewers, and auditors can understand:

- what triggers runs
- what each branch does
- what actions require approval
- why each recommendation was produced

---

# 3. System Scope

## In Scope

- Proactive detection over Ship graph state (staleness, blockers, evidence gaps, review gaps).
- On-demand embedded context-aware chat bound to current entity/view.
- Hybrid trigger model (webhook + polling + in-context invocation).
- Risk scoring and role-aware routing.
- HITL gate for protected actions.
- Trace/cost evidence collection for deliverables.

## Out of Scope

- Replacing Ship as source of truth.
- Standalone chatbot detached from in-app context.
- Permission bypass or autonomous high-impact write actions.
- Finalized production cost numbers without provider telemetry export.

---

# 4. STRATA-X Scale Classification

| Level | Description                      |
| ----- | -------------------------------- |
| X0    | Micro modifications              |
| X1    | Local feature                    |
| X2    | Component architecture           |
| X3    | Cross-system architecture        |
| X4    | Institutional systems            |
| X5    | Sovereign / generational systems |

## Current Classification

**X3 (Cross-system architecture)**. FleetGraph spans existing Ship API/Web/data-model surfaces plus new orchestration, trigger, routing, and observability layers.

---

# 5. Architecture Goals

## Functional Goals

- Deliver at least one proactive end-to-end detection path in MVP.
- Deliver context-aware on-demand reasoning from real Ship views.
- Enforce HITL gates for protected actions while preserving user trust.

## Non-Functional Goals

### Security
Reuse Ship auth/session/CSRF posture and apply explicit authz checks at context resolution and action execution.

### Privacy
Operate on least-privilege scope; avoid over-disclosure; include only minimum needed evidence in outputs.

### Stability
Graceful degradation when fetches or reasoning fail; continue with deterministic findings where possible.

### Reliability
Hybrid triggers reduce missed events and time-based blind spots.

### Performance
Target < 5-minute detection latency using event-first + bounded polling.

### Accessibility
HITL confirmation and notifications integrate with existing Ship UI conventions and readable evidence summaries.

### Observability
Require branch-divergent traces and per-run telemetry.

### Maintainability
Use small graph nodes with explicit branch conditions and shared state contracts.

### Scalability
Incremental scans, dedupe fingerprints, and selective LLM invocation.

### Portability
Worker can run adjacent to API in current deployment model; architecture supports future queue/service evolution.

### Disaster Recovery
Retries, idempotent dedupe keys, and fallback to deterministic outputs when model services fail.

---

# 6. High-Level System Architecture

## Architectural Style

- Brownfield augmentation of Ship core.
- AI-native graph orchestration using Ship-owned runtime components.
- Hybrid event-driven + scheduled proactive execution.
- Embedded context-aware user interaction.

## System Diagram

```text
[Ship UI: Project/Week/Issue/Evidence context]
    -> [Ship API: auth + context envelope]
        -> [FleetGraph Orchestrator]
            -> [Parallel Fetch Nodes over Ship data]
            -> [Detectors + Conditional Reasoning]
            -> [Risk Scoring + Notification Routing]
            -> [HITL Gate for protected actions]
            -> [Writeback: notes, drafts, approved mutations]
            -> [Trace + Cost Telemetry]
```

---

# 7. AI-Native Engineering Model

## AI-First Philosophy

AI is used to improve signal quality and decision speed, not to replace governance. Deterministic checks run first; LLM synthesis is invoked only when conditions are actionable.

## AI-Native Capabilities

- Graph runtime supporting proactive and on-demand modes.
- Detector registry for repeatable risk conditions.
- Context resolver that binds route/entity/user scope to graph state.
- Conditional reasoning node for synthesis, prioritization, and explanation.
- Notification/action drafting based on role and severity.

## Human-in-the-Loop Controls

HITL is mandatory before:

- status/priority/owner/scope changes
- plan/retro/approval/compliance pass-fail decisions
- external notifications
- actions that imply human commitment or audit significance

HITL payload includes action, rationale, confidence/severity, evidence refs, affected records, and approve/reject/snooze outcomes.

---

# 8. Agent Council Review (ACR)

## AI Agent Roles

| Agent | Model | Responsibility in FleetGraph |
| --- | --- | --- |
| Architect Agent | Gemini 2.5 Pro | Validate graph topology, trigger fit, and trust boundaries |
| Security Agent | GPT-4o | Verify permission checks, service identity scope, and action gating |
| Audit Agent | OpenAI o1 & o3-mini | Verify evidence references, traceability, and reviewability |
| Verification Agent | Qwen-Max or GPT-4o | Validate expected outputs against use-case states |
| Documentation Agent | Gemini 1.5 Pro or GPT-4o | Keep architecture and decision records aligned to implementation |
| Adversarial Agent | GPT-5 | Probe branch failures, noisy routing, and false positives |
| Performance Agent | Gemini 3.1 Flash-Lite | Analyze latency/cost tradeoffs and scan cadence |

## Agent Governance Rules

- no autonomous production deployment authority
- no self-authorized protected actions
- all high-impact outputs route through HITL
- human override and dismissal/snooze are always available

---

# 9. Security Architecture

## Security Philosophy

Security is inherited from Ship baseline and reinforced in FleetGraph by explicit context-scoped authorization, protected-action gating, and trace-linked evidence.

## Security Requirements

- AuthN/AuthZ: session or token paths remain authoritative in Ship.
- RBAC/role-aware routing: notify and act only within permitted scope.
- Audit logging/traces: record branch path and action decisions.
- Secrets: service credentials stored in deployment secret manager.
- Prompt-safety: constrain model prompts to scoped project context and explicit tool inputs.
- Data isolation: no separate shadow source of truth for operational records.

## Threat Model

- Internal threats: over-broad service identity, accidental privilege creep.
- External threats: webhook abuse, replay, and route probing.
- AI misuse risks: overconfident claims, low-evidence recommendations.
- Operational threats: missed events, queue backlog, degraded polling loops.
- Social risks: users acting on unverified suggestions; mitigated via evidence-first outputs and HITL.

---

# 10. Privacy & Data Governance

## Data Classification

| Classification | Description |
| --- | --- |
| Public | High-level architecture narrative suitable for review audience |
| Internal | Project execution metadata, operational traces, workflow state |
| Confidential | Team performance indicators, approval rationale, compliance findings |
| Sovereign | Not currently designated in this scope |

## Sovereign AI Considerations

No explicit Indigenous-data governance scope is defined in current FleetGraph artifacts. Add policy overlays if deployment introduces sovereign/community data obligations.

---

# 11. Observability Architecture

## Observability Stack

- Internal FleetGraph trace links (required evidence)
- structured logging for trigger intake and branch decisions
- run-level latency, token, and cost telemetry
- failure tags for degraded fetch/reasoning paths

## Monitoring Goals

- prove branch-divergent graph behavior
- track detection latency against < 5-minute target
- track cost per path and expensive branches
- detect noisy alert loops and suppress via dedupe/snooze controls

## Shared Trace Links (Placeholders)

- [FleetGraph Trace 1 - Divergent Path A](/fleetgraph/traces/REPLACE_WITH_TRACE_ID_1)
- [FleetGraph Trace 2 - Divergent Path B](/fleetgraph/traces/REPLACE_WITH_TRACE_ID_2)

---

# 12. Verification & Evaluation

## Verification Philosophy

AI outputs are untrusted until supported by evidence references and, when required, explicit human confirmation.

## Evaluation Categories

- functional correctness by defined use cases
- evidence quality and replayability
- permission and trust-boundary compliance
- degraded-mode behavior when partial fetch/model failure occurs
- regression across proactive and on-demand paths

---

# 13. Repository Governance

## Required Repository Standards

For this sprint scope, governance artifacts include:

- `PRD.md`
- `FLEETGRAPH.md`
- `USERS.md`
- `PRODUCT.md`
- `DELIVERABLES.md`
- `ARCHITECTURE_DRAFT.md`
- `ARCHITECTURE_DEFENSE_TALK_TRACK.md`
- this architecture document

## Internal Documentation Requirements

Internal records should maintain:

- architecture decision rationale and tradeoffs
- trace links mapped to test cases
- deployment notes and service identity scope
- cost telemetry exports and projection assumptions

---

# 14. Echelon Engineering File Standards

## Mandatory File Header Requirements

All new/substantially new source files in scoped feature trees must include required Echelon headers (version/date/author/purpose/usage/example/dependencies/security/HIPAA/FHIR/accessibility/performance/stability/legal notes).

## Applied Standard

FleetGraph architecture enforces evidence-first outputs, explicit trust boundaries, and no autonomous protected actions, aligned to Echelon security/privacy/stability expectations.

---

# 15. Deployment Architecture

## Environments

| Environment | Purpose |
| --- | --- |
| Local | Development and trace validation against real Ship data |
| Dev | Shared integration testing for triggers, HITL, and routing |
| Staging | Pre-production branch/path and cost checks |
| Production | Publicly accessible delivery target for final submission evidence |

## CI/CD Philosophy

- automated validation and test-case replay support
- traceability of architecture changes to run evidence
- reproducible builds and controlled rollout
- rollback-safe release posture

## Public Deployment URL (Placeholder)

- [FleetGraph Public Deployment](https://ship-web-jyqh.onrender.com/)

---

# 16. Scalability Strategy

- Concurrency assumptions: multiple project scans + on-demand invocations in parallel.
- Scaling model: worker process scaling with per-project dedupe and cursors.
- Infrastructure limits: poll cadence and model calls are primary cost/latency cliffs.
- AI inference scaling: prioritize deterministic filters; reserve LLM for synthesis.
- Caching strategy: fingerprint unchanged graph state to skip redundant reasoning.
- Database/API scaling: incremental fetch windows and role-scoped query boundaries.

---

# 17. Failure Modes & Recovery

## Failure Expectations

- webhook/event drops
- polling drift/backlog
- Ship API partial outages
- model timeout/errors
- trace export interruptions

## Recovery Strategies

- idempotent event handling and dedupe fingerprints
- fallback scheduled scans for missed events
- partial-result outputs with degraded-confidence markers
- retry/backoff for transient failures
- continue execution when tracing fails, but mark run as non-evidence for deliverables

---

# 18. Compliance & Regulatory Considerations

- HIPAA/GDPR/SOC2 are not explicitly mandated by sprint docs, but architecture follows minimum-necessary access and auditable decision trails.
- Compliance-relevant actions (gate pass/fail, exception closeout, review signoff) are human-gated and evidence-linked.
- Audit readiness is a first-class use case for security/compliance reviewers.

---

# 19. Future Expansion

- Expand detector catalog to cover all declared use cases with trace-backed validation.
- Introduce richer notification policy controls (noise suppression, escalation ladders).
- Add formal budget guardrails by path and role.
- Evolve worker into queue-backed distributed architecture if proactive load grows.
- Extend interoperability with additional compliance artifact systems as needed.
- Expanded detector catalog – Cover all declared use cases with trace-backed validation.
- Richer notification policy controls – Add noise suppression, escalation ladders, and role-based routing rules.
- Budget guardrails per path and role.
- Queue-backed distributed worker architecture – Support growing proactive load beyond single-worker polling.
- Interoperability with additional compliance artifact systems – Extend evidence and audit integration.
- Formal budget guardrails per execution path and user role – Control costs for LLM and trace exports.
- Explicit policy and consent handling for community data obligations.
- On-demand graph replay for historical audits – Re-run detection logic against past project states.
- Automated false-positive suppression loops – Learn from HITL snooze/dismiss outcomes to reduce noise.
- Cross-project risk aggregation – Surface fleet-level compliance or delivery trends across multiple Ship projects.
- HITL approval analytics – Measure approval latency, override rates, and recommendation precision per role.

---

# 20. Final Engineering Position

FleetGraph should be implemented as an intelligence overlay on Ship, not as a separate platform. This keeps correctness and trust anchored in existing data/auth boundaries while enabling proactive and on-demand graph intelligence through a defensible hybrid trigger model, selective reasoning, explicit HITL control, and observable branch-divergent execution.

AI accelerates signal detection and synthesis.  
Humans remain accountable for protected decisions.  
Systems remain governable, auditable, and incrementally scalable.
