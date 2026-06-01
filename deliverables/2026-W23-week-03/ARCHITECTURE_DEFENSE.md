# PlugForge Architecture Defense

## 60-Second Thesis

PlugForge should be implemented as a contract-first platform layer over Ship, not as a loose collection of endpoints.  
The week-03 architecture choice is to make `/api/v1` the only public boundary, enforce OAuth 2.0 + scope controls consistently, publish a generated OpenAPI contract, and prove integration quality through SDK + signed webhooks + TTFE drill evidence.

---

## Position to Defend

- Ship remains the core system and domain source of truth.
- Public developer experience is delivered through explicit platform primitives:
  - versioned public API (`/api/v1/*`)
  - OAuth app model and standards-aligned flows
  - scopes-as-data authorization
  - contract-generated OpenAPI 3.1
  - typed SDK (`@ship/sdk`)
  - signed/retriable/replayable webhooks
- The Part 2 agent must authenticate and consume this same public surface as a first-party app.

---

## Why This Is the Right Architecture

### 1) Contract reliability over endpoint sprawl

- PRD explicitly prioritizes a small API that matches its spec over broad but drifting surface area.
- Route metadata -> OpenAPI generation -> fitness tests creates one authoritative contract path.

### 2) Security and trust by default

- OAuth + PKCE + device flow enforce modern client auth posture.
- Scope middleware and explicit 401/403 semantics prevent silent privilege overreach.
- Client secret lifecycle (shown once, hashed at rest, rotated) follows least-exposure posture.

### 3) Developer velocity and integration quality

- Typed SDK with OAuth helpers and async pagination reduces integration friction.
- Signed webhook verification helper standardizes trust checks in one call.
- CLI reference integration makes the platform usability testable, not theoretical.

### 4) Operational resilience

- Retry policy + DLQ + replay supports realistic subscriber failure modes.
- Public audit trail and delivery logs provide accountability and diagnostics.
- TTFE drill and fitness tests catch drift quickly in CI.

### 5) Architectural payoff: agent as citizen

- Rewiring the agent through OAuth + SDK + public API removes privileged shortcuts.
- Same scopes, rate limits, and audit trail as third-party apps.

---

## Core Architecture in One Slide

1. OAuth app registration and consented auth flows.
2. Public request enters `/api/v1` boundary.
3. Bearer + scope middleware enforces contract and authz.
4. Route metadata drives OpenAPI generation and parity tests.
5. Domain write emits typed events via event bus.
6. Webhook subsystem signs, delivers, retries, dead-letters, and replays.
7. SDK/CLI consumes same public contract.
8. Audit and delivery logs provide traceability.

---

## Tradeoffs (and Why We Accept Them)

- **Strict public/internal boundary adds upfront complexity**  
  We accept this to avoid long-term contract contamination and hidden coupling.

- **Generated spec requires disciplined metadata wiring**  
  We accept this because hand-written specs drift rapidly under active delivery.

- **Retry + DLQ + replay adds implementation surface**  
  We accept this because webhook reliability is a first-class platform promise.

- **Agent rewire introduces migration work**  
  We accept this for architectural integrity and externally credible platform behavior.

---

## Anticipated Pushback and Rebuttals

### Pushback: “Why not keep using internal APIs for speed?”

Rebuttal: PRD explicitly requires public/internal separation and the agent-as-citizen outcome; bypassing this invalidates core learning and contract guarantees.

### Pushback: “Why generate OpenAPI instead of writing it manually?”

Rebuttal: generated spec from route metadata + parity tests is the most robust anti-drift mechanism within a one-week sprint.

### Pushback: “Why implement both PKCE and device flow?”

Rebuttal: different client classes (web and CLI) require different standards-compliant flows; this is foundational platform literacy, not optional scope.

### Pushback: “Why not skip DLQ/replay for MVP?”

Rebuttal: reliable webhook operations require failure visibility and recoverability; otherwise integrations are brittle and non-operable.

### Pushback: “Why wire the CLI this early?”

Rebuttal: CLI is must-ship and is the quickest way to validate that SDK + auth + webhooks actually compose into a real developer loop.

---

## Non-Negotiables

- Public routes exist only under `/api/v1/*`.
- Every public failure returns the `ApiError` shape.
- Every public route declares scope requirements.
- OpenAPI is generated and validated in CI.
- Webhook payloads are signed and verifiable with timestamp tolerance checks.
- Retry schedule, DLQ, and replay are testable and observable.
- Agent path uses OAuth + SDK + public API under feature-flagged migration.

---

## MVP Defense Checklist

- [ ] OAuth app registration endpoint with one-time secret reveal and hashed persistence.
- [ ] Auth Code + PKCE Playwright flow (including invalid verifier negative case).
- [ ] Bearer middleware + scope enforcement with explicit 401/403 behavior.
- [ ] Documents list/get/create on `/api/v1`.
- [ ] Public error envelope fitness test across all `/api/v1` routes.
- [ ] OpenAPI 3.1 generation and schema validation test.
- [ ] SDK authenticated call works against running server.
- [ ] Regression budgets remain within +10%.
- [ ] Public deployment + OpenAPI URL + grader OAuth app available.

---

## Closing Statement

This architecture favors verifiable contracts over ad hoc speed. It is intentionally strict where platform trust matters (auth, scopes, boundaries, signatures, audits) and intentionally practical where developer experience matters (typed SDK, CLI, and TTFE proof). That balance is exactly what the week-03 PRD asks us to demonstrate.
