# Early Submission Demo Video Script — SPEAK / SHOW ON SCREEN

**Checkpoint:** Early Submission (Friday) per [`PRD.md`](./PRD.md)  
**Grader path:** [`EARLY_SUBMISSION.md`](./EARLY_SUBMISSION.md) · **Tracker:** [`DELIVERABLES.md`](./DELIVERABLES.md)  
**Target length:** 3–5 minutes (PRD demo video spec; same story proves Early + Final)  
**Branch / deploy:** `gfa2_wk6-final` → https://ship-web-jyqh.onrender.com

Record terminal at ≥14pt. Pause on `verified ✓` in `ship webhooks tail` for the social screenshot.

---

## Segment 0 — Cold open (0:00–0:20)

| SPEAK | SHOW ON SCREEN |
| --- | --- |
| I'm Monica. This is **PlugForge** — Week 03 on Ship: a contract-first developer platform, not a pile of endpoints. | Title: **PlugForge · Week 03 Early Submission** |
| The grade isn't endpoint count. It's whether a stranger can go from `pnpm install @ship/sdk` to a **verified signed webhook** in their terminal — following only published docs. | Subtitle: **Time-to-First-Event (TTFE)** |
| Today I'll show the live deploy, the five-line CLI story, the developer portal, and where the proof lives in the repo. | `gfa2_wk6-final` · `deliverables/2026-W23-week-03/` |

---

## Segment 1 — What we built (PRD arc) (0:20–0:50)

| SPEAK | SHOW ON SCREEN |
| --- | --- |
| Ship stays the domain source of truth. We added what third-party developers need: versioned **`/api/v1`**, OAuth with PKCE and device login, HMAC webhooks with retry and replay, typed **`@ship/sdk`**, a developer portal, and a CLI reference integration. | Bullets: `/api/v1` · OAuth · Webhooks · SDK · Portal · CLI |
| The architectural payoff: the Part 2 agent can run as a **platform citizen** — same OAuth app, same SDK, same rate limits and audit trail as any external integrator. | `SHIP_AGENT_USE_PUBLIC_API` (feature flag) |
| Platform traffic does **zero** LLM work. AI cost scales with agent turns, not API calls — see our cost write-up in the deliverables folder. | Link text: `AI_COST_ANALYSIS.md` |

---

## Segment 2 — MVP hard gate (already shipped) (0:50–1:15)

| SPEAK | SHOW ON SCREEN |
| --- | --- |
| Tuesday's MVP gate is green: OAuth app registration with **client_secret shown once** and hashed at rest; Authorization Code plus PKCE with a **negative test** — wrong verifier returns `invalid_grant`. | `POST /api/v1/oauth/apps` · Playwright `oauth-pkce.spec.ts` |
| Every `/api/v1` route uses bearer middleware: missing, invalid, and expired tokens return **401** with distinct codes. Insufficient scope returns **403** and names the **missing scope** — no opaque forbidden. | `ApiError { code, message, request_id }` |
| Documents expose list, get, and create behind scope middleware. Lists use **cursor pagination** `{ data, next_cursor }`. | `GET/POST /api/v1/documents` |
| OpenAPI 3.1 is **generated from route metadata**, not hand-written. CI fitness tests keep the spec, routes, and SDK in parity. | Live: `/api/v1/openapi.json` · static: `docs/openapi.json` |

---

## Segment 3 — Live deploy + grader entry (1:15–1:35)

| SPEAK | SHOW ON SCREEN |
| --- | --- |
| Production is on Render. Log in, then open the public OpenAPI spec — graders should see OAuth, documents, webhooks, and device paths. | Browser: https://ship-web-jyqh.onrender.com/login |
| If webhooks or device routes are missing on live, redeploy branch **`gfa2_wk6-final`** and run our verify script locally. | https://ship-web-jyqh.onrender.com/api/v1/openapi.json |
| Pre-registered grader OAuth app credentials are in the repo README — read-only scopes for manual testing. | README § Week 03 · `client_id` on screen (not secret) |

---

## Segment 4 — Five-line story / TTFE hero (1:35–3:00)

| SPEAK | SHOW ON SCREEN |
| --- | --- |
| This is the signature challenge: **Time-to-First-Event**. Five commands from a clean machine. | PRD headline: **Five-Line Developer Story** |
| First, install the SDK and build the CLI in the monorepo workspace. Point at the deployed API and your app's client ID. | Terminal — copy/paste block below |
| **`ship login`** uses the **Device Authorization Grant** — RFC 8628. The CLI prints a user code; you approve scopes in the browser. | `ship login` output: user code + verify URL |
| Open the device verify page, enter the code, approve. Polling honors **`slow_down`** — we test that in CI. | Browser: `/oauth/device` |
| **`ship docs create`** writes through the public API via the SDK — same contract external apps use. | `ship docs create --title "hello"` → document id |
| In a second terminal, **`ship webhooks tail`** streams deliveries. Create another document — watch **`document.created`** arrive. | Terminal 2: `ship webhooks tail` |
| Point at **`Ship-Signature: t=…,v1=…`** — Stripe-style timestamp plus HMAC. The SDK **`verifyWebhook()`** passes valid payloads; tampered body or stale timestamp fails. | Highlight: `verified ✓` (social post frame) |
| In CI, `pnpm drill:ttfe` runs this loop on every PR — under sixty seconds. On a clean machine with docs only, you have thirty minutes; we optimize for seconds. | `.github/workflows/platform-gates.yml` |

**Terminal block (Segment 4):**

```bash
export SHIP_API_URL=https://ship-web-jyqh.onrender.com
export SHIP_CLIENT_ID=<your_app_client_id>
pnpm install
pnpm --filter @ship/cli build
ship login
ship docs create --title "hello"
# second terminal:
ship webhooks tail
```

---

## Segment 5 — Webhooks + portal (PRD reliability) (3:00–3:45)

| SPEAK | SHOW ON SCREEN |
| --- | --- |
| Webhooks are event-driven: domain code publishes on writes — routes don't fake events. Subscriptions are per app; signing secret shown once. | Event types: `document.created`, `document.updated`, … |
| Delivery uses HMAC-SHA256, exponential backoff with jitter, dead-letter after six failures, and **replay** with the original **Idempotency-Key** for subscriber dedupe. | Retry: `1s → 4s → 16s → 1m → 5m → 30m` |
| Open the **developer portal** after login: register apps, rotate secrets once, manage subscriptions, browse the delivery log. | https://ship-web-jyqh.onrender.com/developer |
| Click **Replay** on a prior delivery — show success against a healthy endpoint. Portal consumes the **same public API** as integrators — dogfooding. | Delivery log row → Replay → 200 |
| Public responses include rate-limit headers; every call is audited with app, user, route, scope, status, latency. | `X-RateLimit-*` · audit in portal |

---

## Segment 6 — OAuth depth + integrations checklist (3:45–4:15)

| SPEAK | SHOW ON SCREEN |
| --- | --- |
| **Web apps** use Authorization Code plus **PKCE** — the secret never rides in the front channel. **CLI and headless tools** use device flow — no embedded browser in the terminal. | Side-by-side: PKCE vs Device (PRD table) |
| Refresh tokens are **one-time** with rotation; reuse of a stolen refresh **invalidates the whole family** — we drill that in tests. | `oauth-refresh.test.ts` |
| We shipped at least five PRD flows: CLI plus device E2E, refresh drill, webhook replay, and TTFE in CI. Slack and browser PKCE demo were cut — depth over breadth. | Checklist: CLI ✓ · Device ✓ · Refresh ✓ · Replay ✓ · TTFE ✓ |
| **`integrations/`** imports only **`@ship/sdk`** — never `api/src`. That's how agent-as-citizen stays real. | `public-boundary.test.ts` · workspace lint |

---

## Segment 7 — Architecture + written deliverables (4:15–4:40)

| SPEAK | SHOW ON SCREEN |
| --- | --- |
| Architecture is in **`docs/architecture.md`**: module layout, SOLID with file paths, composition root, public versus internal boundary, OAuth sequence diagrams, webhook pipeline, SDK surface, agent before/after, failure modes. | `docs/architecture.md` (scroll module tree) |
| Monday defense and Pre-Search phases 1–3 are in this deliverables folder, with the AI conversation attached as reference. | `ARCHITECTURE_DEFENSE.md` · `PRESEARCH.md` · `AI_CONVERSATION_REFERENCE.md` |
| Per-epic write-ups E1–E7 follow **before → fix → after → proof**. Epic 6 proof is TTFE green; Epic 7 proof is audit rows with OAuth app auth. | `epics/E1.md` … `epics/E7.md` |
| Three discoveries: device **`slow_down`** testing, Zod event bus before queue, and one-line **`verifyWebhook`** shared by CLI and tests. | `DISCOVERIES.md` (three bullets) |

---

## Segment 8 — CI proof + close (4:40–5:00)

| SPEAK | SHOW ON SCREEN |
| --- | --- |
| **`mvp-gates.yml`** guards Tuesday scope: unit tests, OpenAPI schema, PKCE Playwright, perf within ten percent of Part 1 baseline. | GitHub Actions: `mvp-gates.yml` |
| **`platform-gates.yml`** adds platform unit tests and the TTFE drill. Evidence logs are under **`deliverables/.../evidence/`**. | `platform-gates.yml` · `platform-tests-CONFIRM.log` |
| Early submission handoff is **`EARLY_SUBMISSION.md`**. Sunday adds demo video URL and social post — same five-line proof. | `EARLY_SUBMISSION.md` → `FINAL_SUBMISSION.md` |
| Small public API that matches its spec beats a sprawling API that lies. Proof over promises — the TTFE drill is the rubric. | End card: **PlugForge · ship-web-jyqh.onrender.com** |

---

## On-screen-only reference card (optional B-roll)

| Label | Value |
| --- | --- |
| App | https://ship-web-jyqh.onrender.com/login |
| OpenAPI | https://ship-web-jyqh.onrender.com/api/v1/openapi.json |
| Developer portal | `/developer` |
| Device verify | `/oauth/device` |
| Verify deploy | `node scripts/platform/verify-deploy.mjs` |
| TTFE (local) | `pnpm drill:ttfe` + `TTFE_BASE_URL` / `TTFE_CLIENT_ID` |
| Repo deliverables | `deliverables/2026-W23-week-03/` |

---

## PRD Early Submission coverage map

| PRD / Early requirement | Segment |
| --- | --- |
| MVP OAuth, PKCE, bearer, documents, ApiError, OpenAPI, SDK `me()` | 2 |
| Device Authorization Grant + CLI | 4, 6 |
| Webhooks sign / retry / DLQ / replay | 4, 5 |
| Developer portal (apps, secrets, subscriptions, log, replay) | 5 |
| TTFE / five-line story | 4 |
| Rate limits + audit trail | 5 |
| Agent-as-citizen (Epic 7) | 1, 6 |
| Architecture doc + defense + pre-search | 7 |
| AI cost analysis + epics + three discoveries | 1, 7 |
| Deployed URL + grader OAuth app | 3 |
| CI (`mvp-gates`, `platform-gates`, TTFE) | 4, 8 |
| ≥5 integrations/flows | 6 |
| Public/internal boundary + OpenAPI↔SDK parity | 2, 6 |

**Upload (Final):** Add unlisted video URL to [`FINAL_SUBMISSION.md`](./FINAL_SUBMISSION.md) and [`DELIVERABLES.md`](./DELIVERABLES.md).

---

## Version B — ~20% tighter (spoken only)

PlugForge is Week 03: contract-first platform on Ship — `/api/v1`, OAuth, webhooks, SDK, portal, CLI. The rubric is TTFE: install SDK to verified webhook, not endpoint count.

MVP is green: PKCE with negative verifier, bearer 401s, scoped documents, generated OpenAPI, fitness tests. Live on Render — OpenAPI, README grader app, redeploy `gfa2_wk6-final` if routes lag.

Five-line demo: set `SHIP_API_URL` and `SHIP_CLIENT_ID`, build CLI, `ship login` via device flow at `/oauth/device`, `ship docs create`, `ship webhooks tail` — show `Ship-Signature` and `verified ✓`. CI runs `pnpm drill:ttfe` under sixty seconds.

Portal: apps, secrets once, subscriptions, delivery log, Replay with idempotency key. Webhooks: HMAC, backoff, DLQ, domain-published events. Refresh rotation kills stolen families. Five flows shipped; integrations import only `@ship/sdk`.

Written proof: `docs/architecture.md`, defense, pre-search, epics E1–E7, cost analysis, three discoveries. `mvp-gates` plus `platform-gates` with evidence logs. Early handoff: `EARLY_SUBMISSION.md`. Match the spec, prove TTFE — done.

---

## Version C — Phrases intentionally avoided

| Avoided | Why |
| --- | --- |
| "Production-ready platform" | Early/Final prove via deploy + CI logs, not adjective |
| "Robust / scalable / innovative" | Replace with TTFE timing, retry schedule, fitness tests |
| "Mission-critical architecture-first" | Use public/internal boundary and file paths instead |
| "Comprehensive API surface" | PRD prefers small API that matches spec |
| "AI-powered platform" | PRD: platform is LLM-free; agent cost is separate |
| "Seamless developer experience" | Show device flow + `verifyWebhook` line instead |
