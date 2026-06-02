# PlugForge Architecture Template (M.O.M. + M.I.L.E.)

---

# 1. Executive Summary

## Overview

PlugForge extends Ship into a developer-first platform by introducing a contract-governed public API, standards-aligned OAuth, reliable signed webhooks, and a typed SDK. The architecture is designed so third-party clients and first-party agent integrations use the same public interface and constraints.

## Business Objective

- Convert Ship from application-only delivery into platform-grade integration surface.
- Enable external developers to go from SDK install to verified webhook quickly.
- Reduce integration ambiguity via generated OpenAPI and strict contract testing.
- Ensure production-ready trust boundaries (auth, scopes, signatures, auditability).

## Operational Philosophy

- Contract-first over endpoint-first.
- Public/internal boundary as a hard architectural rule.
- Deterministic enforcement before convenience.
- Evidence-driven validation via CI fitness tests and TTFE drill.

---

# 2. MoniGarr Operating Model (M.O.M.)

## 2.1 Platform Contract Integrity First

Every public route must be represented in OpenAPI and must obey shared error, auth, and pagination conventions.

## 2.2 Human Accountability in Sensitive Operations

Secret lifecycle, scope grants, and replay-capable webhook operations must remain reviewable and operator-safe.

## 2.3 Enterprise Posture from Day One

Security, reliability, and observability are treated as first-order requirements, not post-MVP clean-up.

## 2.4 Documentation as Runtime Control Surface

`PRD.md`, this architecture file, and OpenAPI artifacts are implementation constraints, not passive notes.

## 2.5 Handoff-Ready Engineering

Any engineer should be able to answer:

- Where auth/authz/rate-limit attach.
- How webhook retries and DLQ behave.
- How SDK parity is validated.
- How the agent path differs before/after rewire.

---

# 3. System Scope

## In Scope

- `/api/v1/*` public boundary with route-level scope enforcement.
- OAuth app registration and OAuth flows (Auth Code + PKCE, Device Grant).
- One-time secret display and hashed secret storage.
- `ApiError` envelope consistency across public failures.
- Cursor-based pagination for list endpoints.
- Generated OpenAPI 3.1 served at `/api/v1/openapi.json`.
- Signed webhook system with retries, DLQ, and replay.
- Typed SDK clients and OAuth helper surfaces.
- CLI must-ship integration and TTFE drill.
- Agent rewire through OAuth + SDK + public API.

## Out of Scope

- Replacing Ship core domain model.
- Unversioned or mixed public/internal endpoint exposure.
- Hand-authored OpenAPI as authoritative source.
- Privileged agent shortcuts bypassing public platform controls.

---

# 4. STRATA-X Scale Classification

| Level | Description |
| --- | --- |
| X0 | Micro modifications |
| X1 | Local feature |
| X2 | Component architecture |
| X3 | Cross-system architecture |
| X4 | Institutional systems |
| X5 | Sovereign / generational systems |

## Current Classification

**X3 (Cross-system architecture)**: OAuth, API contract layer, webhook pipeline, SDK/CLI integration, and agent call-path rewire all cross service boundaries and operational domains.

---

# 5. Architecture Goals

## Functional Goals

- Deliver MVP contract slices with tests:
  - OAuth registration + flows
  - public authz + scope control
  - documents resource endpoints
  - generated OpenAPI
  - webhook reliability loop
  - SDK + CLI integration

## Non-Functional Goals

- **Security:** strict token/scope checks, protected secret lifecycle.
- **Reliability:** deterministic retry/DLQ/replay behavior.
- **Performance:** remain within PRD regression budget and latency targets.
- **Observability:** auditable public API and webhook delivery logs.
- **Maintainability:** route metadata and scope registries as data.
- **Scalability:** queue-backed delivery can replace in-memory implementation without contract break.

---

# 6. High-Level System Architecture

## Architectural Style

- Brownfield enhancement of existing Ship stack.
- Contract-driven public API layer.
- Event-driven webhook fanout with failure management.
- SDK-first external integration model.

## System Diagram

```text
[OAuth Client / SDK / CLI / Agent]
    -> [/api/v1/* Public Boundary]
        -> [Bearer + Scope Middleware]
            -> [Domain Services]
                -> [Event Bus]
                    -> [Webhook Subscriptions]
                        -> [Signed Delivery + Retry Scheduler]
                            -> [DLQ + Replay]
        -> [ApiError Envelope + Rate-Limit Headers]
        -> [OpenAPI Generator + Spec Endpoint]
        -> [Public Audit Trail]
```

---

# 7. AI-Native Engineering Model

## AI-First Philosophy

The platform layer itself performs no AI inference. AI invocation remains confined to user-initiated agent operations, preserving clear cost boundaries and platform neutrality.

## Agent-as-Citizen Model

- Agent authenticates as first-party OAuth app.
- Agent consumes `@ship/sdk` and `/api/v1` routes.
- Agent obeys same scopes/rate limits/audit surfaces as external apps.

---

# 8. Security Architecture

## Security Requirements

- OAuth client registration with hashed secrets.
- PKCE verifier validation and standards-consistent token errors.
- Scope-based authorization on each public route.
- Replay-resistant webhook signing with timestamp tolerance.
- Secret rotation support without historical secret recovery.

## Threat Model Focus

- Credential leakage risk at registration/rotation surfaces.
- Scope escalation through missing route guards.
- Webhook spoof/replay and subscriber misbehavior.
- Agent privilege bypass risk during rewire migration.

---

# 9. API Contract Architecture

## Public Contract Rules

- Public routes only under `/api/v1/*`.
- Shared failure shape: `ApiError { code, message, details?, request_id }`.
- List endpoints return cursor contract (`data`, `next_cursor`).
- Public responses include rate-limit headers.

## OpenAPI and SDK Parity

- OpenAPI is generated from route metadata.
- Spec validates against OpenAPI 3.1 schema in CI.
- Fitness tests assert route/spec and spec/SDK parity.

---

# 10. Webhook Reliability Architecture

## Event and Delivery Model

- Event types registered as data with typed schema.
- Domain publishes events via `IEventBus`.
- Subscription management gated by `webhooks:manage`.

## Signing and Replay Controls

- Header format: `Ship-Signature: t=<unix-seconds>,v1=<hex-hmac>`.
- SDK `verifyWebhook()` enforces signature validity, freshness, and integrity.
- Replays preserve idempotency key to support downstream dedupe.

## Failure Handling

- Retry backoff: `1s, 4s, 16s, 1m, 5m, 30m`.
- `5xx`/timeout retried; `4xx` dead-lettered.
- Delivery attempts logged with status, latency, and excerpt.

---

# 11. Observability and Verification

## Observability Requirements

- Public API audit events (client_id, user, route, scope, status, latency).
- Webhook delivery attempt logs and replay outcomes.
- CI visibility for contract drift and TTFE regressions.

## Verification Requirements

- PKCE positive + negative tests.
- Device flow polling and slow-down handling tests.
- Error envelope and scope declarations across all public routes.
- OpenAPI schema validation and SDK parity checks.
- Webhook tamper/retry/DLQ/replay scenario tests.

---

# 12. Performance and Cost Model

## Performance Targets (PRD-aligned)

- OAuth Auth Code + PKCE P95 under target.
- Webhook first-attempt P95 under target.
- Rate-limit headers on 100% public responses.
- Regression budgets (P95, bundle, query counts) within +10%.

## Cost Model

- Platform core introduces no direct LLM runtime cost.
- Cost drivers:
  - API traffic
  - webhook delivery volume
  - CI runtime for contract and TTFE drills
- Track assumptions:
  - webhook fanout ratio
  - agent active rate
  - retention windows for delivery/audit logs

---

# 13. Deployment Architecture

## Environments

| Environment | Purpose |
| --- | --- |
| Local | Rapid iteration and contract test development |
| CI | Deterministic contract + integration verification |
| Staging | End-to-end validation of deployment posture |
| Production | Public grader-accessible deployment |

## Deployment Requirements

- Public URL available to graders.
- OpenAPI endpoint resolvable on deployed instance.
- At least one read-only OAuth app pre-registered for evaluation.
- Developer portal surfaces apps/subscriptions/logs/replay.

---

# 14. Failure Modes and Recovery

## Expected Failures

- Token misuse/expiration/invalid scope.
- Webhook subscriber instability.
- Spec drift introduced by route changes.
- Replay misuse without idempotency support.

## Recovery Strategies

- Explicit 401/403 contract responses.
- Retry and DLQ controls with replay tooling.
- CI blocking on spec/route and SDK/spec mismatch.
- Idempotency key propagation and subscriber dedupe guidance.

---

# 15. Submission Evidence Checklist

- [ ] Public repo and slice progression evidence.
- [ ] Architecture document aligned with PRD section requirements.
- [ ] Live and static OpenAPI artifacts.
- [ ] TTFE drill proof in CI.
- [ ] Agent rewire proof through audit trail.
- [ ] Demo-ready five-line developer story.

---

# 16. Final Engineering Position

The week-03 architecture succeeds when the platform contract is both strict and usable: strict enough to guarantee security, consistency, and auditability; usable enough that a new developer can authenticate, call the API through the SDK, and verify signed webhook delivery quickly with only published docs.
