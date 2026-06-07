# Final Submission Demo Video Script — 3–4 min · SPEAK / SHOW ON SCREEN

**Checkpoint:** Final Submission (Sunday) per [`PRD.md`](./PRD.md)  
**Grader path:** [`FINAL_SUBMISSION.md`](./FINAL_SUBMISSION.md) · **Tracker:** [`DELIVERABLES.md`](./DELIVERABLES.md) · **URLs:** [`SUBMISSION_URLS.md`](./SUBMISSION_URLS.md)  
**Target length:** **~3:30** at natural speaking pace (≈140 wpm; ~480 spoken words + screen beats; fits 3–5 min PRD window with natural pauses and holds on key frames)  
**Branch / deploy:** `gfa2_wk6-final` → https://ship-web-jyqh.onrender.com (Render auto-deploy from GitLab master)  
**Voice anchor:** Composite from user chat style (direct "I" statements, exact PRD file refs, checklist mindset, "proof over promises", "small API that matches its spec") + early demo SPEAK rhythm. Expanded for platform-economy / agentic / high-assurance audience (Elon / xAI, Palmer Luckey / Anduril, US Treasury & federal agencies).

**Before you record:**  
`node scripts/platform/verify-deploy.mjs` (green)  
`node scripts/platform/run-prod-ttfe-smoke.mjs` (or manual with super-admin app)  
Terminal font ≥14pt, dark theme, minimal chrome.  
Pre-stage tabs: deployed login, live OpenAPI, `/oauth/device`, `/developer`, CI run on `gfa2_wk6-final`.  
Have two terminals ready for the parallel `webhooks tail` + create flow.  
Pause on `verified ✓` for social frame and for "this is the contract proving itself" beat.  
Upload unlisted; paste URL + social post URL into SUBMISSION_URLS and FINAL_SUBMISSION.

---

## Copy-paste block (voice tool or teleprompter)

Copy the **SPEAK** block; cut video to each **SHOW** cue in order. Record at conversational pace — breathe, let the verified frame land.

---

**SPEAK:**

I'm Monica. This is PlugForge — Week 03 final on Ship. We gave a collaborative document platform the surfaces a third-party developer or an autonomous agent can build on: versioned public REST at `/api/v1`, OAuth 2.0 with PKCE and device grant, HMAC-signed webhooks with retries, DLQ and replay, a typed SDK, developer portal, and CLI.

The PRD bar is Time-to-First-Event. From a clean terminal, following only published docs: `pnpm install @ship/sdk` to a verified signed webhook in minutes, not days. The CI drill runs on every PR and fails the build on regression.

This matters when agents act inside other systems — xAI and Tesla fleets, Anduril and Palmer Luckey's lattice, Treasury and federal rails that must survive oversight. The platforms that compound are the ones where integration is boring, auditable, and provable in one terminal session.

We drew a hard public/internal boundary. Public routes only under `/api/v1`. Lint rule kills cross-imports. Every failure returns the same `ApiError` with request ID. Scopes are data. OpenAPI is generated from route metadata — fitness tests assert parity. Hand-written specs drift; this one does not.

OAuth is the perimeter. Apps register, secret shown once, hashed at rest. PKCE for web, device grant for CLI. Refresh rotates; reuse revokes the family. Rate limits and full audit on every call.

Our own agent — FleetGraph — now authenticates as a first-class OAuth app using the SDK, same scopes, same audit rows. No privileged backdoor. Regulators and contractors can reason about exactly what it can do.

Webhooks carry the event contracts: `IEventBus` from domain writes, per-app subscriptions, `Ship-Signature: t=<unix>,v1=<hmac>`, 1s/4s/16s/1m/5m/30m backoff, DLQ after six failures, portal replay preserving the original idempotency key. `ship webhooks tail` streams and verifies with the same one-line helper the SDK gives every consumer.

The five-line story is the demo:

```bash
export SHIP_API_URL=https://ship-web-jyqh.onrender.com
export SHIP_CLIENT_ID=<your_app>
pnpm install @ship/sdk
pnpm --filter @ship/cli build
ship login
ship docs create --title "hello"
# second terminal
ship webhooks tail   # → document.created + verified ✓
```

Then the developer portal: apps, one-time secret rotate, subscriptions, delivery log, Replay. Signature still verifies.

Everything is in the repo — architecture with diagrams and failure modes, pre-search, cost analysis (platform does zero LLM work), per-epic proofs, three discoveries, mvp-gates + platform-gates + TTFE in CI, deployed perf probe, full E2E suite green. Evidence committed.

The grade is the same one the market will use: does a developer or an agent trust the contract enough to ship on day one? TTFE answers without marketing.

Small API that matches its spec beats one that contradicts itself. An agent through the front door beats a privileged shortcut. Depth over breadth. Proof over promises.

---

**SHOW ON SCREEN:**

| Cue | On screen |
| --- | --- |
| 1 | Title: **PlugForge · Final Submission** · subtitle **TTFE + Agent as Citizen** · `gfa2_wk6-final` |
| 2 | Split: five-line story in monospace + "3:30 at natural pace" |
| 3 | Browser: `https://ship-web-jyqh.onrender.com/api/v1/openapi.json` — scroll to OAuth, /documents, /webhooks, device grant, rate limits |
| 4 | Flash cards: `ApiError {code, message, details?, request_id}` · `documents:write` · cursor pagination `{data, next_cursor}` · generated spec (no hand-write) |
| 5 | Terminal prep: `export SHIP_API_URL=...` `export SHIP_CLIENT_ID=...` `pnpm install @ship/sdk` `pnpm --filter @ship/cli build` |
| 6 | Terminal: `ship login` — device code printed, verify URL |
| 7 | Browser: `https://ship-web-jyqh.onrender.com/oauth/device` — paste code, approve (show consent) |
| 8 | Terminal: `ship docs create --title "hello"` → JSON response |
| 9 | Two terminals side-by-side: left `ship webhooks tail --signing-secret=...` ; right another `ship docs create` ; hold frame on `document.created` + `verified ✓` |
| 10 | Browser: `https://ship-web-jyqh.onrender.com/developer` — apps list, rotate secret (one-time UX), active subscription, delivery log with Replay button click, replay succeeds |
| 11 | Architecture proof: `docs/architecture.md` — public/internal mermaid, OAuth sequence, webhook pipeline, agent-before/after |
| 12 | CI: `.github/workflows/platform-gates.yml` run on `gfa2_wk6-final` (green) + TTFE job timing <60s |
| 13 | Evidence: `deliverables/2026-W23-week-03/evidence/` — `deploy-verify-*.log`, `prod-ttfe-smoke-*.log`, `perf-regression-*.log`, `e2e-full-run-CONFIRM.log` (854 passed) |
| 14 | Cost + discoveries: `AI_COST_ANALYSIS.md` table + `DISCOVERIES.md` (device grant, event registry, verifyWebhook) |
| 15 | End card: live URL · OpenAPI URL · repo (GitLab + GitHub PRs) · "Proof over promises." |

---

## Timed script (SPEAK ↔ SHOW)

| Time | SPEAK | SHOW ON SCREEN |
| --- | --- | --- |
| **0:00–0:18** | I'm Monica. This is PlugForge — the Week 03 final submission on Ship. We took a working collaborative document platform and gave it the surfaces a third-party developer or an autonomous agent needs to build on top of it with confidence... | Title: **PlugForge · Final Submission** · TTFE + Agent as Citizen |
| **0:18–0:35** | The PRD set one bar that matters more than endpoint count: Time-to-First-Event. From a clean terminal... to a verified signed webhook in minutes. The CI version runs on every PR. | Five-line story card + "CI drill <60s" |
| **0:35–0:55** | This is not academic. When the next layer of the economy is built by agents... Elon / xAI / Tesla, Anduril / Palmer Luckey, Treasury and federal agencies... the platforms that compound are the ones where integration is boring, auditable, and provable in a single terminal session. | Audience logos / wordmarks (fair use) + "agentic + high-assurance" |
| **0:55–1:20** | We didn't add "an API." We drew a hard public/internal boundary. ... OAuth is not a feature. It is the perimeter. ... Even our own agent now runs as a first-class platform citizen. No privileged backdoor. | OpenAPI scroll (OAuth + device + webhooks) · flash `ApiError` + scopes + generated note · mermaid public/internal boundary |
| **1:20–1:45** | Webhooks are where the rubber meets the road... signed, retry schedule, DLQ, replay with idempotency key... the CLI `ship webhooks tail` streams and verifies in one line. | Two-terminal live flow: `ship webhooks tail` + create → hold on `verified ✓` |
| **1:45–2:05** | The five-line story is the demo... (paste the bash block) | Monospace five-liner + "from clean machine" |
| **2:05–2:25** | Then in the developer portal you list apps, rotate a secret, manage subscriptions, browse the delivery log, and hit Replay... | `/developer` → apps → rotate (one-time) → deliveries → click Replay → success |
| **2:25–2:50** | All of it is in the repo: architecture doc with diagrams and failure modes... pre-search... cost analysis... per-epic proofs... three discoveries... CI gates... performance probe on the deployed instance... full E2E suite passes. | `docs/architecture.md` open + CI green + evidence logs list + cost table + DISCOVERIES |
| **2:50–3:10** | The grade the PRD sets is the same grade the market will set: does a developer — or an agent — trust the contract enough to ship against it on day one? The TTFE drill is the only metric that answers that without marketing. | Hold on `verified ✓` frame + "TTFE is the rubric" |
| **3:10–3:30** | Small API that matches its spec beats a sprawling one that contradicts itself. An agent that goes through the front door beats one with a privileged shortcut. Depth over breadth. Proof over promises. | End card: URLs + "ship-web-jyqh.onrender.com/api/v1/openapi.json" + repo links |

*(Natural pauses, zoom on verified, and portal replay clicks easily stretch spoken delivery to 4:00 while staying under the PRD 5-min ceiling. Speak slightly slower on the "This matters when..." and "No privileged backdoor" lines.)*

---

## Terminal commands (have these ready — test live before record)

```bash
# prep (one-time per machine)
export SHIP_API_URL=https://ship-web-jyqh.onrender.com
export SHIP_CLIENT_ID=<your_app_client_id_with_documents_write_webhooks_manage>
pnpm install
pnpm --filter @ship/sdk build
pnpm --filter @ship/cli build

# flow A — login + create
ship login
ship docs create --title "hello from final"

# flow B — tail (second terminal, before the create above if you want to catch the event live)
ship webhooks tail --interval 1500 --timeout 45000
# (or set SHIP_WEBHOOK_SIGNING_SECRET from the portal subscription)
```

For full super-admin prod smoke (records the app + device code for graders if needed):

```bash
SHIP_PROD_EMAIL=... SHIP_PROD_PASSWORD=... node scripts/platform/run-prod-ttfe-smoke.mjs
```

---

## PRD Final Submission coverage (what this video + repo prove)

| PRD / Final requirement | Video / repo beat |
| --- | --- |
| Demo video 3–5 min: five-line story + portal replay | 1:45–2:25 (live) + 2:05–2:25 (portal) |
| Deployed + live OpenAPI + grader OAuth app | 0:55 + end card + SUBMISSION_URLS |
| Architecture doc (1–2 pp, all required sections) | 2:25–2:50 + `docs/architecture.md` |
| Pre-search (3 phases) + AI conv ref | `PRESEARCH.md` + `AI_CONVERSATION_REFERENCE.md` |
| OpenAPI live + static + schema validated | Browser cue + `openapi-schema.test.ts` |
| AI cost analysis + assumptions | 2:25 cue + `AI_COST_ANALYSIS.md` |
| Per-epic write-ups E1–E7 | `epics/` + 2:25 |
| Three discoveries | 2:25 + `DISCOVERIES.md` |
| Social post + TTFE screenshot | Post-recording; hold `verified ✓` |
| Evidence logs + CI (mvp-gates + platform-gates + TTFE) | 2:25–2:50 + `.github/workflows/` |
| ≥5 integration flows (CLI device, refresh drill, replay, TTFE, agent rewire) | Implied by full demo + Epic 7 callout + test logs |
| Agent-as-citizen (Epic 7) | 1:10–1:20 (explicit) + architecture before/after |
| Public/internal boundary + lint enforcement | 0:55 + architecture diagram |
| All MVP hard gates | 0:55–1:20 + DELIVERABLES tracker |

---

## Recording checklist (final)

1. [ ] `node scripts/platform/verify-deploy.mjs` passes clean on current `gfa2_wk6-final` deploy.
2. [ ] OAuth app with `documents:write` + `webhooks:manage` (not the read-only grader one).
3. [ ] Webhook subscription created and signing secret noted before tail.
4. [ ] Two terminals + browser tabs pre-staged (login, openapi, device, developer, recent CI).
5. [ ] Record at natural pace; hold `verified ✓` 3–4 seconds; click Replay in portal and wait for success frame.
6. [ ] Upload unlisted to YouTube/Loom; paste URL into SUBMISSION_URLS.md and FINAL_SUBMISSION.md.
7. [ ] Screenshot the tail verified for social; post tagging @GauntletAI; paste post URL.

---

## VERSION B — ~20% tighter (~2:50 spoken)

Use this if you need to hit closer to 3 min or for a shorter cut.

**SPEAK (tight):**

I'm Monica. PlugForge final on Ship: public `/api/v1`, OAuth for everyone including our agent, signed webhooks with retry and replay, typed SDK, CLI, developer portal.

The PRD bar is Time-to-First-Event: clean terminal, `pnpm install @ship/sdk`, `ship login`, create a doc through the public API, receive a signature-verified webhook in the same terminal in seconds. CI runs the same drill on every PR.

This is the contract that matters when agents are the integrators — xAI, Anduril, Treasury rails, any high-stakes system where a backdoor or a drift bug is not an option.

Hard public/internal boundary. Generated OpenAPI with fitness parity. Device grant + PKCE + refresh rotation + stolen-token family revoke. Rate limits and audit on every call. Our agent uses the SDK and the same OAuth path — no special access. Webhooks: Stripe-style sig, exponential backoff, DLQ, portal replay preserving idempotency key. `ship webhooks tail` verifies in one line.

Five-line proof on the live instance, then portal replay. Architecture, cost model, discoveries, and CI gates are all in the repo. Evidence logs committed.

Small surface that matches its spec. Agents as citizens. Proof over promises.

**SHOW (tight, same cues compressed):**

1. Title + TTFE
2. OpenAPI scroll + ApiError + scopes
3. Terminal exports + install + build
4. `ship login` + browser approve
5. `ship docs create` + two-term `webhooks tail` → hold `verified ✓`
6. `/developer` → Replay
7. `docs/architecture.md` + CI green + evidence dir
8. End card with URLs

---

## Phrases intentionally avoided (per technical video script discipline + target audience signal)

| Avoid | Reason / Say instead |
| --- | --- |
| "production-ready" / "enterprise-grade" / "battle-tested" | No load evidence at this scale; use "CI gates + TTFE drill + deployed parity" |
| "robust" / "reliable" (standalone) | Tie to concrete: "retry schedule", "family revoke on refresh reuse", "verifyWebhook in SDK + CLI + tests" |
| "innovative" / "cutting-edge" / "next-gen" | Signals hype; use "contract-first", "agent as citizen", "generated spec with fitness test" |
| "mission-critical" / "zero-trust" (vague) | Use "no privileged backdoor", "public audit rows for the agent", "timestamp + HMAC prevents replay" |
| "scalable architecture" | We have perf regression within +10% and in-memory deliverer for demo; say "bounded fanout assumptions in cost analysis" |
| "AI-powered platform" | The platform is LLM-free by design; the agent is a normal OAuth client. Say "platform itself does zero LLM work" |
| "game-changing" / "revolutionary" | Empty; the revolution is boring contracts that hold under CI and in a 30-second terminal loop |
| "comprehensive" / "full-featured" | PRD explicitly says small matching spec > sprawling contradictory; avoid |
| "easy to use" | Replace with "TTFE under 60s in CI", "pleasant SDK surface", "one-line verify" |

---

## Why this framing works for the target viewers (notes for you, not in video)

- Elon / xAI / Tesla: velocity of composition for agent swarms, SDK as the on-ramp, TTFE as the true north for "how fast can a new agentic workflow ship".
- Palmer Luckey / Anduril: defense-grade authz (OAuth + scopes + no backdoors), signed events with replay for audit/latency, stolen token detection, public audit trail, deterministic CI proof.
- US Treasury / federal: rate-limit headers + full audit log as compliance artifacts, idempotency + replay for financial-style exactly-once concerns, generated spec + parity tests = no "it worked in staging" surprises, cost model shows platform cost is separate from LLM cost.
- Internet business / platform economies: explicit nod to the "hinge moment" Stripe etc. crossed; the moat is DX + verifiable contracts + least-privilege by default, not feature count.
- Billionaire economies: compounding happens when other people's (or other agents') developers win fast and safely.

The concrete demo never lies. The visionary language is anchored to the five-line loop and the agent rewire. No word salad.

---

## Post-recording actions

- Paste YouTube/Loom unlisted URL into `SUBMISSION_URLS.md` and `FINAL_SUBMISSION.md`.
- Post social with `verified ✓` screenshot, tag `@GauntletAI`, paste post URL.
- If you want a 60-second highlight cut (just the live TTFE + verified + one replay click), the tight version above compresses cleanly.

**Depth over breadth. Proof over promises. The TTFE drill is the rubric.**

---

*This script was generated following the technical-video-script-panel discipline after reading the skill, PRD, architecture, epics, CLI/TTFE sources, cost analysis, discoveries, existing early script (as voice anchor), and recent chat transcripts for natural phrasing. All claims map to committed evidence on `gfa2_wk6-final`.*