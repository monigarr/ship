# PRESEARCH

## Source of Truth

This pre-search document is drafted directly from `deliverables/2026-W23-week-03/PRD.md`.  
If any statement here conflicts with implementation reality, update code and this file to match the PRD contract.

---

## Phase 1: Define Constraints and Must-Ship Scope

### 1.1 Delivery Scope and Hard Gates

- **MVP hard gate scope for this week**
  - OAuth app registration with one-time secret reveal and hashed storage.
  - Authorization Code + PKCE flow passing end-to-end (including invalid verifier negative case).
  - Bearer middleware + scope enforcement on `/api/v1/*`.
  - At least one resource (`documents`) with list/get/create.
  - Consistent `ApiError` envelope across all public failures.
  - Generated OpenAPI 3.1 spec at `/api/v1/openapi.json`.
  - SDK skeleton with typed authenticated call.
  - Existing regression suite intact within +10% performance/query/bundle budgets.

- **Non-negotiable architecture commitments from PRD**
  - Public/internal split: public routes only under `/api/v1/*`.
  - OpenAPI generated from route metadata (never hand-authored).
  - Scopes-as-data registry (no middleware surgery for each new scope).
  - Event publication in domain layer (not route handlers).
  - Agent rewired as OAuth app + SDK consumer (platform citizen model).

### 1.2 Time and Risk Constraints

- **Highest-risk items**
  - OAuth correctness (PKCE + device flow + refresh rotation).
  - Public/internal boundary enforcement linting.
  - Webhook retry + dead-letter + replay correctness.
  - SDK/spec parity and drift prevention.
  - TTFE drill flake risk in CI.

- **Risk-reduction sequence (PRD-aligned)**
  1. OAuth foundation + negative tests.
  2. `/api/v1` boundary and lint guard.
  3. Error envelope and route fitness tests.
  4. OpenAPI generation and schema validation.
  5. Webhook pipeline with deterministic retry tests.
  6. SDK + CLI reference integration.
  7. Agent rewire behind feature flag.

### 1.3 Security and Data Sensitivity

- **Secrets and tokens**
  - `client_secret` shown once at creation/rotation; only hashed at rest.
  - Refresh tokens are one-time-use with family invalidation on reuse detection.
  - No secret leakage in logs, docs examples, or portal defaults.

- **Webhook trust model**
  - Stripe-style signature header with timestamp and HMAC-SHA256.
  - Reject replay/tamper/expired timestamp in SDK verifier.
  - Preserve idempotency key through replay path.

---

## Phase 2: Architecture Discovery and Decisions

### 2.1 OAuth and Authorization Decisions

- **Auth flows**
  - Web apps: Authorization Code + PKCE.
  - CLI: Device Authorization Grant.
  - Both must map to same scope and audit model as public platform clients.

- **Scope model**
  - Start with PRD baseline scopes:  
    `documents:read`, `documents:write`, `issues:read`, `issues:write`, `sprints:read`, `sprints:write`, `webhooks:manage`.
  - Missing scope must return `403` with named missing scope.

- **Token validation outcomes**
  - Missing/invalid/expired token => `401`.
  - Insufficient scope => `403`.
  - OAuth contract errors (ex: PKCE mismatch) => standards-aligned error body (`invalid_grant`, etc.).

### 2.2 Public API Contract Decisions

- **Error envelope contract**
  - Every public failure returns:
    - `code`
    - `message`
    - optional `details`
    - `request_id`

- **Pagination contract**
  - List endpoints return `data` and `next_cursor`.
  - Cursor is opaque and stable across reordering-sensitive operations.

- **OpenAPI parity contract**
  - Route metadata is canonical.
  - Fitness test asserts route/spec parity and fails on drift.

### 2.3 Webhook Reliability Decisions

- **Event model**
  - Event types are data, each with typed schema.
  - Domain writes publish events through `IEventBus`.

- **Delivery model**
  - Retry schedule with jitter: `1s, 4s, 16s, 1m, 5m, 30m`.
  - `5xx`/timeout => retry.
  - `4xx` => permanent failure + dead-letter.
  - After 6 failures => DLQ with replay support.

- **Replay model**
  - Replay from delivery log.
  - Preserve original idempotency key for subscriber dedupe.

### 2.4 SDK and Developer Experience Decisions

- **SDK shape**
  - Resource-segregated clients (`documents`, `issues`, `sprints`, `webhooks`).
  - OAuth helpers for auth code and device flows.
  - Async iterator pagination for clean consumer loop.
  - Typed discriminated error union.

- **CLI (must-ship)**
  - `ship login` (device flow)
  - `ship docs create`
  - `ship webhooks tail`
  - Used as operational proof for TTFE.

### 2.5 Agent-as-Citizen Rewire Decisions

- **Before**
  - Internal direct service calls with privileged pathing.

- **After**
  - First-party OAuth app + SDK + public API, same constraints as external developers.
  - Feature flag supports compatibility during migration.

---

## Phase 3: Validation, Cost, and Deployment Planning

### 3.1 Verification and Fitness Tests

- **Mandatory acceptance coverage**
  - PKCE success + invalid verifier negative case.
  - Device flow with slow-down handling and `/api/v1/me` validation.
  - Route fitness: scope declarations, OpenAPI parity, error shape, pagination.
  - Webhook signature verification (positive and tamper/expired negatives).
  - Retry schedule validation and DLQ/replay confirmation.

- **TTFE drill**
  - Measure install -> auth -> subscribe -> trigger -> verify.
  - Keep CI runtime under PRD target and fail on regression.

### 3.2 Cost and Performance Guardrails

- **Performance**
  - Keep latency/query/bundle budgets within +10% over baseline.
  - Track webhook P95 first-attempt latency and auth flow P95.

- **Cost**
  - Platform AI spend is zero by design.
  - Track CI minutes (TTFE + OAuth + regressions) explicitly.
  - Track delivery/audit log retention assumptions for storage cost.

### 3.3 Deployment and Demo Readiness

- **Public readiness checklist**
  - Deployed app publicly accessible.
  - `/api/v1/openapi.json` resolvable.
  - Pre-registered read-only OAuth app for graders.
  - Developer portal reachable for app/subscription/log/replay flows.

- **Demo loop**
  - Fresh terminal install.
  - Device login.
  - Document creation via SDK/CLI.
  - Signed webhook observed and verified.

---

## Open Questions to Resolve Early

1. Refresh-token family schema and invalidation strategy details.
2. Boundary lint rule implementation location and enforcement mechanics.
3. Deterministic test-time clock strategy for retry schedule assertions.
4. SDK generation-vs-handwritten balance for type quality and drift resistance.
5. Agent rewire OAuth flow choice and seeding guarantees across environments.

---

## Definition of “Architecturally Ready” for Week 03

- OAuth + scope + token middleware passes positive and negative contract tests.
- `/api/v1` boundary is enforced by lint/dep rules.
- OpenAPI generation + validation is in CI.
- Webhooks (sign/retry/DLQ/replay) are end-to-end testable.
- SDK + CLI complete the five-line developer story.
- Agent path through public API is implemented behind feature flag with audit proof.
