# PRESEARCH — Week 03 (PlugForge)

**Source of truth:** [`PRD.md`](./PRD.md)  
**Dev branch:** `gfa2_wk6` · **Last updated:** 2026-06-01  
**Architecture:** [`docs/architecture.md`](../../docs/architecture.md) · **Evidence tracker:** [`DELIVERABLES.md`](./DELIVERABLES.md)

This document captures pre-build decisions (Phases 1–3) and records **what is implemented vs planned** on the current branch. When code and pre-search diverge, update both—pre-search describes intent; `DELIVERABLES.md` tracks proof.

**AI conversation artifact (PRD attachment):** [`deliverables/2026-W23-week-03/AI_CONVERSATION_REFERENCE.md`](./AI_CONVERSATION_REFERENCE.md) — session index, Pre-Search phase mapping, architecture decisions, MVP hard-gate status, and [`evidence/`](./evidence/) test logs from June 1, 2026.

---

## Phase 1: Define constraints and must-ship scope

### 1.1 Delivery scope and hard gates

**PRD MVP hard gate — implementation status on `gfa2_wk6`:**

| Item | Status | Proof |
| --- | --- | --- |
| OAuth app registration; one-time secret; hashed at rest | **Done** | `api/src/platform/oauth.ts`, migration `047_oauth_public_platform.sql` |
| Authorization Code + PKCE (+ invalid verifier) | **Done** | `e2e/oauth-pkce.spec.ts`, `public-api-mvp.test.ts` |
| Bearer middleware + scope enforcement on `/api/v1/*` | **Done** | `oauth.ts` `requireBearerToken` / `requireScope` |
| Documents list/get/create | **Done** | `api/src/platform/routes/v1/documents.ts` |
| Consistent `ApiError` envelope | **Done** | `api/src/platform/http.ts`, fitness tests |
| OpenAPI 3.1 at `/api/v1/openapi.json` | **Done** | Live: https://ship-web-jyqh.onrender.com/api/v1/openapi.json |
| SDK skeleton + typed `me()` | **Done** | `sdk/src/client.ts` |
| Regression within +10% baseline | **Done** | `.github/workflows/mvp-gates.yml`, `perf-baseline.json` |

**Non-negotiable architecture commitments:**

| Commitment | Status | Notes |
| --- | --- | --- |
| Public routes only under `/api/v1/*` | **Done** | Mounted in `app.ts`; separate from session/CSRF stack |
| OpenAPI generated from route metadata | **Done** | `spec/route-metadata.ts` → `spec/openapi.ts` |
| Scopes-as-data registry | **Done** | `scopes.ts`; all PRD scopes registered |
| Event publication in domain layer | **Not started** | Required for webhooks |
| Agent as OAuth app + SDK consumer | **Not started** | Epic 7 |

### 1.2 Scale, load, and demo assumptions

- **Demo API rate:** Low—grader + team CLI sessions; estimate &lt;50 req/min on Render instance during review window.
- **Webhook fanout (when built):** One `document.created` × N subscriptions per app; seed 1–2 grader subscriptions max for demo to stay within in-memory deliverer P95 &lt;2 s target.
- **Concurrent device-flow polls:** Plan for 3–5 simultaneous CLI logins; implement RFC 8628 `slow_down` before demo week.
- **Delivery log growth:** ~10–50 rows/day during active dev; retain 30 days for demo (assumption for cost model—table not created yet).

### 1.3 Budget and cost ceilings

- **LLM spend (Epic 7 rewire):** Platform layer is LLM-free; agent rewire should not increase tokens per turn—verify with before/after trace comparison when rewire lands.
- **CI minutes:** MVP gates today ≈ unit tests + OpenAPI generate + PKCE Playwright + perf script. TTFE drill (when added) budget ≤5 min/PR.
- **SDK install size:** Target &lt;250 KB min+gzip prod deps; enforce with bundle size check when CLI package added.
- **Runaway webhook cost:** Cap retries at 6 attempts then DLQ; no unbounded fanout without active subscriptions.

### 1.4 Timeline and scope reality

**Must-ship for passing grade (PRD):** MVP hard gate + CLI + TTFE + webhooks + dev portal + agent rewire + submission artifacts.

**Current branch reality:** MVP platform slice is in place; remaining work is the majority of the PRD surface area.

**Kill criterion for developer portal:** Minimum viable = read-only app list + delivery log viewer + replay button (no full subscription CRUD UI on day one if time-constrained).

### 1.5 Security and data sensitivity

**Implemented:**

- `client_secret` shown once at registration; SHA-256 hash stored (`oauth.ts`).
- Access tokens opaque, hashed, 1 h TTL; no refresh tokens yet.
- PKCE S256 required on authorization code exchange.

**Planned:**

- Refresh token rotation + family invalidation on reuse.
- Webhook payloads: ship document id + metadata only in `document.created` (fetch content via API if needed)—reduces leakage surface.
- Portal secret display: one-time modal, no back-button recovery, no logging of raw secret.

### 1.6 Team skill inventory

- OAuth consumed before; Week 03 implements hand-rolled RFC 6749 + 7636 PKCE in TypeScript.
- Zod + in-process OpenAPI generation chosen over hand-written spec; fitness tests as drift guard.
- SDK hand-written (not generated) for type quality; parity enforced by tests as routes grow.

---

## Phase 2: Architecture discovery and decisions

### 2.1 OAuth and authorization

| Decision | Choice | Status |
| --- | --- | --- |
| Web app flow | Authorization Code + PKCE | **Implemented** |
| CLI flow | Device Authorization Grant | **Planned** |
| Scope upgrades | Re-consent on expanded scope request | **Implemented** (new authorize with broader scope) |
| Consent UX | `/api/v1/oauth/authorize` with session cookie; `approve=1` query for automated tests | **Implemented** |
| Device verify UX | User enters `user_code` at dedicated verify URL (RFC 8628) | **Planned** |
| Refresh tokens | One-time-use with rotation from day one of post-MVP slice | **Planned** |
| Token errors | Missing/invalid → `401`; expired → `401 token_expired`; scope → `403` + `missing_scope` | **Implemented** |

### 2.2 Public API shape

| Decision | Choice | Status |
| --- | --- | --- |
| Error envelope | `{ code, message, details?, request_id }` on all `/api/v1` failures | **Implemented** |
| Pagination | Opaque base64 cursor `{ id, timestamp }`; `{ data, next_cursor }` | **Implemented** (documents) |
| Versioning policy | Additive in v1; breaking → `/api/v2/` | **Documented**; v1 only exists today |
| Static lists | `/openapi.json`, future `/scopes` may skip cursor pagination | **Accepted**; fitness test filters list routes |

### 2.3 Webhook reliability

| Decision | Choice | Status |
| --- | --- | --- |
| Signed payload | Raw body + timestamp in `Ship-Signature` header | **Planned** |
| Retry schedule | `1s, 4s, 16s, 1m, 5m, 30m` with jitter | **Planned** |
| 4xx vs 5xx | 4xx permanent → DLQ; 5xx/timeout → retry | **Planned** |
| Test strategy | Deterministic clock injection; no `setTimeout` in tests | **Planned** |
| Idempotency | Replay preserves `Idempotency-Key` | **Planned** |

### 2.4 SDK and developer experience

| Decision | Choice | Status |
| --- | --- | --- |
| SDK authoring | Hand-written TypeScript, fitness-tested against OpenAPI | **Partial** — documents + `me()` only |
| Error model | Discriminated union on `kind` | **Planned** — throws `Error` today |
| Pagination | Async iterators (`for await`) primary API | **Planned** |
| `ITokenStore` | File store for CLI; pluggable for browser | **Planned** |
| CLI location | `integrations/cli/` importing only `@ship/sdk` | **Planned** — directory does not exist yet |

### 2.5 Developer portal

| Decision | Choice | Status |
| --- | --- | --- |
| Data access | Portal consumes `/api/v1` like any OAuth client (dogfood) | **Planned** |
| Secret rotation | Old secret invalidated immediately on rotate | **Planned** |
| Delivery log UI | Server-side pagination; payload behind click-to-reveal | **Planned** |

### 2.6 Agent-as-citizen rewire

| Decision | Choice | Status |
| --- | --- | --- |
| Agent OAuth flow | Client credentials or device grant for first-party M2M (TBD at Epic 7) | **Open** |
| App seeding | Migration seeds first-party app in deployed envs | **Planned** |
| Scopes | Read-heavy minimum; write only where agent mutates state | **Planned** |
| Feature flag | Dual path until Part 2 tests pass flag on/off | **Planned** |

---

## Phase 3: Validation, cost, and deployment

### 3.1 Verification and fitness tests

**Implemented on `gfa2_wk6`:**

| Scenario | Test location |
| --- | --- |
| PKCE success + invalid verifier | `public-api-mvp.test.ts`, `e2e/oauth-pkce.spec.ts` |
| Route OpenAPI parity | `public-api-fitness.test.ts` |
| Scope declarations on bearer routes | `public-api-fitness.test.ts` |
| ApiError on failure paths | `public-api-fitness.test.ts` |
| OpenAPI 3.1 schema validation | `openapi-schema.test.ts` |
| Public/internal import boundary | `public-boundary.test.ts` |

**Not yet implemented (PRD testing scenarios):**

- Device flow + slow-down + `/api/v1/me`
- Webhook sign/tamper/retry/DLQ/replay
- SDK/spec method parity for full surface
- TTFE drill (`pnpm drill ttfe`) in CI

### 3.2 Cost and performance guardrails

- **Performance:** MVP perf gate enforces +10% on P95 latency, bundle size, query counts vs `perf-baseline.json`.
- **Platform AI cost:** $0 for platform layer; LLM only on user-initiated agent turns (unchanged from Part 2).
- **Production projection table:** Required in final submission `AI cost analysis` artifact—not yet written for Week 03.

### 3.3 Deployment and demo readiness

**Live today:**

| Check | URL |
| --- | --- |
| Deployed app | https://ship-web-jyqh.onrender.com/login |
| Public OpenAPI | https://ship-web-jyqh.onrender.com/api/v1/openapi.json |
| Static spec in repo | `docs/openapi.json` |

**Not ready:**

- Pre-registered grader OAuth app with credentials in README (manual admin registration documented in `README.md` / `DEPLOYMENT.md`)
- Developer portal
- Five-line demo loop (install SDK → device login → create doc → webhook tail)

**Grader one-command local verify:**

```bash
pnpm install
pnpm --filter @ship/api test
pnpm test:e2e --grep "OAuth Authorization Code + PKCE"
```

---

## Resolved and open questions

### Resolved on current branch

1. **Boundary lint:** Implemented as Vitest import scan in `public-boundary.test.ts` (not ESLint rule yet).
2. **SDK strategy:** Hand-written with typed clients; expand as routes land.
3. **OpenAPI path:** PRD `/api/v1/openapi.json` is live on Render deployment.

### Still open

1. Refresh-token family schema and invalidation mechanics.
2. Deterministic clock module location for webhook retry tests.
3. Agent OAuth flow choice (client credentials vs device grant).
4. ESLint/workspace rule blocking `integrations/*` → `api/src/` imports (PRD recommends both Vitest and lint).

---

## Definition of “architecturally ready” (PRD)

| Criterion | `gfa2_wk6` |
| --- | --- |
| OAuth + scope + token middleware with contract tests | **Yes** |
| `/api/v1` boundary enforced | **Yes** (import test) |
| OpenAPI generation + validation in CI | **Yes** |
| Webhooks sign/retry/DLQ/replay testable | **No** |
| SDK + CLI complete five-line story | **No** |
| Agent through public API with audit proof | **No** |

**Bottom line:** Pre-search decisions remain valid for remaining slices. MVP foundation is shipped and verifiable; pre-search should be read as **decisions + status**, not as claim of full PRD completion.

---

## MVP submit readiness (summary)

**Can `gfa2_wk6` be submitted as-is for the PRD § MVP hard gate?**  
**Yes, with caveats.** All ten MVP bullets are addressed in code/CI/deploy: grader read-only OAuth app is pre-registered and documented in [`README`](../../README.md) (`client_id` + portal secret handoff); full Playwright regression was run and logged ([`evidence/e2e-full-run-2026-06-01.log`](./evidence/e2e-full-run-2026-06-01.log)). The full suite is not 100% green (793/870 passed, 12 failed — mostly pre-existing specs; OAuth PKCE passes in isolation). Details: [`AI_CONVERSATION_REFERENCE.md`](./AI_CONVERSATION_REFERENCE.md) § MVP submission readiness.

**Full Week 03 PRD / final submission** (webhooks, CLI, TTFE, portal, video, social, cost analysis, epics) is **not** complete on this branch.

---

## Related artifacts

- [`docs/architecture.md`](../../docs/architecture.md) — module layout, diagrams, failure modes
- [`DELIVERABLES.md`](./DELIVERABLES.md) — grader checklist and proof URLs
- [`ARCHITECTURE_DEFENSE.md`](./ARCHITECTURE_DEFENSE.md) — Monday defense talk track
- [`AI_CONVERSATION_REFERENCE.md`](./AI_CONVERSATION_REFERENCE.md) — June 1 AI session index and outcomes
