# PlugForge Architecture Defense

**Dev branch:** `gfa2_wk6` · **Last updated:** 2026-06-01  
**Canonical architecture:** [`docs/architecture.md`](../../docs/architecture.md)  
**Evidence tracker:** [`DELIVERABLES.md`](./DELIVERABLES.md) · **Pre-search:** [`PRESEARCH.md`](./PRESEARCH.md)  
**Source of truth:** [`PRD.md`](./PRD.md)

---

## 60-Second Thesis

PlugForge is a contract-first platform layer over Ship—not a loose collection of endpoints.  
On `gfa2_wk6`, the MVP slice is **shipped**: `/api/v1` as the only public boundary, OAuth 2.0 with Authorization Code + PKCE, scopes-as-data, generated OpenAPI 3.1, and a typed `@ship/sdk` skeleton. Remaining PRD work—device flow, webhooks, CLI, TTFE drill, developer portal, and agent-as-citizen—is **planned** and documented in [`docs/architecture.md`](../../docs/architecture.md).

**Live proof:** [Login](https://ship-web-jyqh.onrender.com/login) · [Public OpenAPI](https://ship-web-jyqh.onrender.com/api/v1/openapi.json)

---

## Implementation status (`gfa2_wk6`)

| Area | Status |
| --- | --- |
| OAuth app registration + hashed secrets | **Shipped** |
| Authorization Code + PKCE (+ negative verifier) | **Shipped** |
| Bearer middleware + scope enforcement | **Shipped** |
| `/api/v1` documents + cursor pagination | **Shipped** |
| `ApiError` + fitness tests | **Shipped** |
| OpenAPI 3.1 (live + `docs/openapi.json`) | **Shipped** |
| `@ship/sdk` (`me()`, `documents.*`) | **Shipped** |
| Public/internal import boundary test | **Shipped** |
| CI MVP gates | **Shipped** |
| Grader OAuth app pre-seeded in README | **Partial** — manual admin registration |
| Device Authorization Grant | **Planned** |
| Refresh tokens + rotation | **Planned** |
| Webhooks (sign, retry, DLQ, replay) | **Planned** |
| Developer portal | **Planned** |
| CLI + TTFE drill | **Planned** |
| Agent-as-citizen (Epic 7) | **Planned** |

---

## Position to Defend

- Ship remains the core system and domain source of truth.
- Public developer experience is delivered through explicit platform primitives:
  - versioned public API (`/api/v1/*`) — **in production on Render**
  - OAuth app model and standards-aligned flows — **PKCE shipped; device flow next**
  - scopes-as-data authorization — **shipped**
  - contract-generated OpenAPI 3.1 — **shipped**
  - typed SDK (`@ship/sdk`) — **MVP skeleton shipped**
  - signed/retriable/replayable webhooks — **planned**
- The Part 2 agent must eventually authenticate and consume this same public surface as a first-party app — **planned (Epic 7)**.

---

## Why This Is the Right Architecture

### 1) Contract reliability over endpoint sprawl

- PRD explicitly prioritizes a small API that matches its spec over broad but drifting surface area.
- **Shipped:** `spec/route-metadata.ts` → `spec/openapi.ts` → fitness tests in CI.

### 2) Security and trust by default

- **Shipped:** PKCE, bearer middleware, explicit `401` / `token_expired` / `403` + `missing_scope`, one-time `client_secret` with SHA-256 at rest.
- **Planned:** device flow, refresh rotation, webhook signatures, rate-limit headers.

### 3) Developer velocity and integration quality

- **Shipped:** typed SDK for `me()` and documents.
- **Planned:** OAuth helpers, async iterators, `verifyWebhook()`, CLI five-line story.

### 4) Operational resilience

- **Planned:** retry/DLQ/replay, audit trail, TTFE drill in CI.
- **Shipped:** contract drift caught by OpenAPI + fitness tests today.

### 5) Architectural payoff: agent as citizen

- **Planned:** OAuth app + SDK + public API under feature flag; audit-log proof for Epic 7.

---

## Core Architecture in One Slide

**Shipped today (steps 1–4):**

1. OAuth app registration and Authorization Code + PKCE.
2. Public request enters `/api/v1` boundary (`createPlatformRouter()` in `app.ts`).
3. Bearer + `requireScope()` enforce authz; `ApiError` on failure.
4. Route metadata drives OpenAPI generation and parity tests.

**Planned (steps 5–8):**

5. Domain write emits typed events via `IEventBus`.
6. Webhook subsystem signs, delivers, retries, dead-letters, and replays.
7. SDK/CLI consumes same public contract end-to-end.
8. Audit and delivery logs provide traceability.

---

## Tradeoffs (and Why We Accept Them)

- **Strict public/internal boundary adds upfront complexity**  
  We accept this to avoid long-term contract contamination. **Enforced today** via `public-boundary.test.ts`.

- **Generated spec requires disciplined metadata wiring**  
  We accept this because hand-written specs drift rapidly. **Proven today** at `/api/v1/openapi.json`.

- **Retry + DLQ + replay adds implementation surface**  
  We accept this because webhook reliability is a first-class platform promise. **Not yet built**—sequenced after device flow.

- **Agent rewire introduces migration work**  
  We accept this for architectural integrity. **Epic 7** after CLI + webhooks prove the contract.

---

## Anticipated Pushback and Rebuttals

### Pushback: “Why not keep using internal APIs for speed?”

Rebuttal: PRD requires public/internal separation and agent-as-citizen. We already mount `/api/v1` separately from session/CSRF `/api/*` in `app.ts`—the boundary is real, not aspirational.

### Pushback: “Why generate OpenAPI instead of writing it manually?”

Rebuttal: generated spec + parity tests are the anti-drift mechanism. Graders can fetch the live contract: https://ship-web-jyqh.onrender.com/api/v1/openapi.json

### Pushback: “Why implement both PKCE and device flow?”

Rebuttal: different client classes (web vs CLI) need different RFC-compliant flows. PKCE is **done**; device flow is the next slice for `ship login`.

### Pushback: “Why not skip DLQ/replay for MVP?”

Rebuttal: DLQ/replay is post-MVP per our sequencing, but still non-negotiable for **final** submission—not optional platform scope.

### Pushback: “Why wire the CLI this early?”

Rebuttal: CLI is must-ship for TTFE proof. MVP OAuth + documents exist so CLI can consume `@ship/sdk` as soon as device flow lands.

### Pushback: “You defended webhooks but didn’t ship them yet.”

Rebuttal: Defense document states **target architecture**; [`docs/architecture.md`](../../docs/architecture.md) and [`DELIVERABLES.md`](./DELIVERABLES.md) separate **shipped vs planned** so reviewers are not misled.

---

## Non-Negotiables

| Rule | `gfa2_wk6` |
| --- | --- |
| Public routes only under `/api/v1/*` | **Enforced** |
| Every public failure returns `ApiError` shape | **Enforced** |
| Every public route declares scope requirements | **Enforced** (bearer routes in metadata) |
| OpenAPI generated and validated in CI | **Enforced** |
| Webhook payloads signed; timestamp tolerance | **Planned** |
| Retry, DLQ, replay testable and observable | **Planned** |
| Agent uses OAuth + SDK + public API (feature flag) | **Planned** |

---

## MVP Defense Checklist

Aligned with [`DELIVERABLES.md`](./DELIVERABLES.md) grader checklist.

- [x] OAuth app registration with one-time secret reveal and hashed persistence — [`oauth.ts`](../../api/src/platform/oauth.ts)
- [x] Auth Code + PKCE Playwright flow (including invalid verifier negative case) — [`e2e/oauth-pkce.spec.ts`](../../e2e/oauth-pkce.spec.ts)
- [x] Bearer middleware + scope enforcement with explicit 401/403 behavior — [`public-api-mvp.test.ts`](../../api/src/platform/public-api-mvp.test.ts)
- [x] Documents list/get/create on `/api/v1` — [`routes/v1/documents.ts`](../../api/src/platform/routes/v1/documents.ts)
- [x] Public error envelope fitness test across `/api/v1` routes — [`public-api-fitness.test.ts`](../../api/src/platform/public-api-fitness.test.ts)
- [x] OpenAPI 3.1 generation and schema validation test — [`openapi-schema.test.ts`](../../api/src/platform/openapi-schema.test.ts)
- [x] SDK authenticated call works against running server — [`sdk/src/client.test.ts`](../../sdk/src/client.test.ts)
- [x] Regression budgets remain within +10% — [`mvp-gates.yml`](../../.github/workflows/mvp-gates.yml)
- [ ] Public deployment + OpenAPI URL + **pre-registered grader OAuth app** — deploy + OpenAPI **done**; grader app **manual** per [`README`](../../README.md)

---

## Post-MVP defense targets (not yet demonstrable)

- [ ] Device Authorization Grant + refresh rotation
- [ ] Webhooks end-to-end (sign, retry, DLQ, replay)
- [ ] Developer portal (dogfoods public API)
- [ ] CLI + TTFE drill in CI
- [ ] ≥5 PRD integration/flow items
- [ ] Agent-as-citizen with audit-log proof

---

## Closing Statement

This architecture favors verifiable contracts over ad hoc speed. On `gfa2_wk6`, that discipline is **already visible** in the MVP slice: live OpenAPI, passing PKCE gates, and a enforced public boundary. The remaining PRD surface—webhooks, CLI, TTFE, portal, and agent rewire—is the same architecture extended, not a different plan. Depth over breadth; proof over promises—and today’s proof is in [`docs/architecture.md`](../../docs/architecture.md), tests, and the deployed URLs above.
