# Early Submission Demo Video Script — 2 min · SPEAK / SHOW ON SCREEN

**Checkpoint:** Early Submission (Friday) per [`PRD.md`](./PRD.md)  
**Grader path:** [`EARLY_SUBMISSION.md`](./EARLY_SUBMISSION.md) · **Tracker:** [`DELIVERABLES.md`](./DELIVERABLES.md)  
**Target length:** **~2:00** at normal speaking pace (~270 spoken words + screen action beats)  
**Branch / deploy:** `gfa2_wk6-final` → https://ship-web-jyqh.onrender.com

**Before you record:** Run `node scripts/platform/verify-deploy.mjs` — redeploy `gfa2_wk6-final` if `/oauth/device/*` or `/webhooks` are missing on live OpenAPI. Terminal font ≥14pt. Pause on `verified ✓` in `ship webhooks tail` (social screenshot frame).

---

## Copy-paste block (voice tool or teleprompter)

Copy the **SPEAK** block; cut video to each **SHOW** cue in order.

---

**SPEAK:**

I'm Monica. PlugForge is Week 03 on Ship — a contract-first developer platform: public API at `/api/v1`, OAuth, HMAC webhooks, the typed SDK, developer portal, and CLI.

The Early Submission rubric is Time-to-First-Event: from install to a verified signed webhook in the terminal. Contract proof, not endpoint count.

Live on Render. Open the generated OpenAPI spec — OAuth, documents, device flow, webhooks. MVP gates are green: bearer auth, ApiError shape, named scopes, cursor pagination, fitness tests.

Five-line demo. Set API URL and client ID, build the CLI, `ship login` — device flow, approve at `/oauth/device`. `ship docs create` writes through the SDK. Second terminal: `ship webhooks tail`, create another doc — `document.created`, `Ship-Signature`, verified.

Developer portal: apps, subscriptions, delivery log, Replay with idempotency.

Repo proof on `gfa2_wk6-final`: `docs/architecture.md`, pre-search, cost analysis, epics E1–E7, three discoveries, `mvp-gates` and `platform-gates` with TTFE in CI. Agent runs as a platform citizen — same OAuth path as external apps.

Small API that matches its spec. Proof over promises.

**SHOW ON SCREEN:**

| Cue | On screen |
| --- | --- |
| 1 | Title: **PlugForge · Week 03 Early Submission** · subtitle **TTFE** |
| 2 | Bullets: `/api/v1` · OAuth · Webhooks · SDK · Portal · CLI |
| 3 | Browser: `https://ship-web-jyqh.onrender.com/api/v1/openapi.json` — scroll OAuth, documents, `/oauth/device/*`, `/webhooks` |
| 4 | Flash: `ApiError` · `documents:read` scope · `docs/openapi.json` |
| 5 | Terminal: `export SHIP_API_URL=…` · `export SHIP_CLIENT_ID=…` · `pnpm install` · `pnpm --filter @ship/cli build` |
| 6 | Terminal: `ship login` — user code visible |
| 7 | Browser: `https://ship-web-jyqh.onrender.com/oauth/device` — enter code, approve |
| 8 | Terminal: `ship docs create --title "hello"` |
| 9 | Terminal 2: `ship webhooks tail` — create doc — **hold on `verified ✓`** |
| 10 | Browser: `https://ship-web-jyqh.onrender.com/developer` — delivery log → **Replay** |
| 11 | Quick: `deliverables/2026-W23-week-03/` · `docs/architecture.md` · `.github/workflows/platform-gates.yml` |
| 12 | End card: **ship-web-jyqh.onrender.com** · **gfa2_wk6-final** |

---

## Timed script (SPEAK ↔ SHOW)

| Time | SPEAK | SHOW ON SCREEN |
| --- | --- | --- |
| **0:00–0:12** | I'm Monica. PlugForge is Week 03 on Ship — a contract-first developer platform: public API at `/api/v1`, OAuth, HMAC webhooks, the typed SDK, developer portal, and CLI. | Title: **PlugForge · Week 03 Early Submission** |
| **0:12–0:22** | The Early Submission rubric is **Time-to-First-Event**: from install to a **verified signed webhook** in the terminal. Contract proof, not endpoint count. | Subtitle: **TTFE** · `gfa2_wk6-final` |
| **0:22–0:35** | Live on Render. Open the **generated OpenAPI** spec — OAuth, documents, device flow, webhooks. | Browser: `/api/v1/openapi.json` |
| **0:35–0:45** | MVP gates are green: bearer auth, **ApiError** shape, named scopes, cursor pagination, fitness tests. | Flash: `401`/`403` · `{ data, next_cursor }` · `docs/openapi.json` |
| **0:45–1:05** | Five-line demo. Set API URL and client ID, build the CLI, **`ship login`** — device flow, approve at `/oauth/device`. | Terminal env + `pnpm install` + `ship login` |
| **1:05–1:15** | **`ship docs create`** writes through the SDK and public API. | `ship docs create --title "hello"` |
| **1:15–1:35** | Second terminal: **`ship webhooks tail`**, create another doc — **`document.created`**, **`Ship-Signature`**, **verified**. | Terminal 2 — **pause on `verified ✓`** |
| **1:35–1:48** | Developer portal: apps, subscriptions, delivery log, **Replay** with idempotency. | `/developer` → Replay click |
| **1:48–1:58** | Repo proof: architecture doc, pre-search, cost analysis, epics, discoveries, **mvp-gates** + **platform-gates** with TTFE in CI. Agent uses same OAuth path as external apps. | `deliverables/2026-W23-week-03/` · `platform-gates.yml` |
| **1:58–2:00** | Small API that matches its spec. Proof over promises. | End card: **ship-web-jyqh.onrender.com** |

---

## Terminal commands (have these ready)

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

## PRD Early Submission coverage (what this video proves)

| PRD / Early requirement | Video beat |
| --- | --- |
| MVP: OAuth, PKCE, bearer, documents, ApiError, OpenAPI, SDK | 0:22–0:45 |
| Device Authorization Grant + CLI | 0:45–1:05 |
| TTFE / five-line story | 0:45–1:35 |
| Webhooks: sign, verify, delivery | 1:15–1:35 |
| Developer portal (apps, log, replay) | 1:35–1:48 |
| Deployed URL + live OpenAPI | 0:22–0:35 |
| CI (`mvp-gates`, `platform-gates`, TTFE) | 1:48–1:58 |
| Architecture + pre-search + epics + discoveries + cost | 1:48–1:58 |
| Agent-as-citizen (Epic 7) | 1:48–1:58 (one line) |
| ≥5 integration flows (CLI, device, refresh, replay, TTFE) | Implied by demo + repo flash |

**Not in this 2 min cut (repo only):** Architectural Defense, full OAuth PKCE browser flow, refresh-token drill, rate-limit headers, audit trail UI — graders find these in [`DELIVERABLES.md`](./DELIVERABLES.md) and evidence logs.

**Final submission adds:** Paste unlisted video URL into [`SUBMISSION_URLS.md`](./SUBMISSION_URLS.md) and [`FINAL_SUBMISSION.md`](./FINAL_SUBMISSION.md).

---

## Recording checklist

1. [ ] `node scripts/platform/verify-deploy.mjs` passes (redeploy if not).
2. [ ] OAuth app with `documents:write` + `webhooks:manage` (not read-only grader app).
3. [ ] Webhook subscription active before `webhooks tail`.
4. [ ] Pre-stage browser tabs: login, OpenAPI, `/oauth/device`, `/developer`.
5. [ ] Upload unlisted; paste URL into `SUBMISSION_URLS.md`.

---

## Phrases to avoid

| Avoid | Say instead |
| --- | --- |
| "Production-ready platform" | TTFE drill + live OpenAPI |
| "Robust / innovative" | Fitness tests, `verifyWebhook`, retry schedule |
| "Comprehensive API" | Small API that matches its spec |
| "AI-powered platform" | Platform is LLM-free; agent is separate |
