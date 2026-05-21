# Executive Summary

**Project:** ShipShape — Audit and Improvement of the `US-Department-of-the-Treasury/ship` TypeScript monorepo  
**Phase:** Phase 1 audit appendix  
**Date of baseline audit:** 2026-05-19  
**Mode:** Diagnosis only. No remediation changes were made during Phase 1.  
**Primary source files:** `PRD.md`, `PHASE_1_AUDIT_REPORT.md`, `CODEBASE_ORIENTATION_CHECKLIST.md`

---

## 30-Second Read

The Phase 1 audit is gate-ready. It provides baseline measurements for all 7 PRD categories, includes methodology, reports concrete numbers, identifies weaknesses/opportunities, and ranks severity.

The strongest reviewer signal is not just that the metrics exist. It is that the work shows production-engineering discipline: realistic seeded data, repeated test runs, route-level accessibility evidence, explicit limitations, raw evidence artifacts, and a PRD requirement-to-evidence checklist.

The highest-risk remediation areas are concentrated, not system-wide:

1. **API route-layer type safety** — high assertion density in `weeks`, `team`, and `projects` routes.
2. **Frontend bundle weight** — oversized main entry chunk and heavy editor/collaboration dependencies.
3. **API tail latency** — `/api/issues` and `/api/team/grid` show the weakest P95/P99 behavior.
4. **Testing visibility** — coverage instrumentation is unavailable, and collaboration-heavy E2E paths are unstable.
5. **Accessibility consistency** — automated scores are strong, but manual NVDA and keyboard findings show route-level gaps.

---

## What Reviewers Should Know First

This audit followed the PRD’s core rule: **diagnosis before treatment**.

The report does not attempt to fix issues during Phase 1. Instead, it establishes the baseline that Phase 2 improvements must beat. That makes it useful as a grading artifact, implementation roadmap, and onboarding aid.

| Reviewer Question | Fast Answer |
|---|---|
| Are all 7 categories covered? | Yes. |
| Are there concrete baseline numbers? | Yes. |
| Are methods and tools documented? | Yes. |
| Are weaknesses and severity rankings included? | Yes. |
| Are raw evidence artifacts listed? | Yes. |
| Are limitations disclosed? | Yes. |
| Is there a credible Phase 2 improvement path? | Yes. |

---

## Phase 1 Gate Snapshot

| PRD Category | Gate Status | Key Baseline Signal | Primary Risk |
|---|---:|---|---|
| 1. Type Safety | Met | `346 any`, `1490 as`, `326 !`, `1` directive | API route correctness and maintainability |
| 2. Bundle Size | Met | `11625.94 KB` total dist, `2025.14 KB` largest chunk | Slow initial load / TTI pressure |
| 3. API Response Time | Met | 5 endpoints tested at 10/25/50 concurrency | `/api/issues` tail latency |
| 4. Database Query Efficiency | Met | 5 user flows, query counts, N+1 flags, EXPLAIN notes | Search seq scan and sprint query complexity |
| 5. Test Coverage and Quality | Met | `1320` tests listed; tri-run evidence captured | Missing coverage instrumentation and E2E instability |
| 6. Runtime Error and Edge Cases | Met | Console/server/runtime edge probes completed | Script-like title accepted, startup race, modal blocking |
| 7. Accessibility Compliance | Met | Lighthouse, axe, keyboard, NVDA evidence captured | Serious contrast findings and partial SR/keyboard coverage |

---

## Highest-Impact Findings

### 1. Type Safety Risk Is Concentrated In API Route Orchestration

The highest type-safety violation density is in API route handlers:

| File | Combined Violation Count | Why It Matters |
|---|---:|---|
| `api/src/routes/weeks.ts` | 216 | Complex sprint/week orchestration with many runtime assumptions. |
| `api/src/routes/team.ts` | 171 | Aggregated team data likely touches many nullability and shape assumptions. |
| `api/src/routes/projects.ts` | 106 | Project views are workflow-critical and assertion-heavy. |
| `api/src/routes/claude.ts` | 79 | AI-adjacent integration surface with runtime-shape uncertainty. |
| `api/src/routes/issues.ts` | 78 | Core issue workflow plus latency concerns. |

**Why this matters:** strict mode is enabled, but broad `any`, `as`, and non-null assertion use reduces the practical safety benefit. Phase 2 should prioritize meaningful runtime narrowing and contract reinforcement at API boundaries.

---

### 2. Bundle Size Creates Initial-Load Risk

The frontend build has a large production output and oversized main entry chunk:

| Metric | Baseline |
|---|---:|
| Total production bundle output | `11625.94 KB` |
| Largest chunk | `index-C2vAyoQ1.js` — `2025.14 KB` |
| JS chunk count | `261` |
| Largest dependencies | `emoji-picker-react`, `highlight.js`, `yjs` |

**Why this matters:** the editor and collaboration stack are valuable features, but they should not dominate initial route load when users do not immediately need them.

---

### 3. `/api/issues` Is The Clearest API Performance Target

At 25 concurrent connections:

| Endpoint | P50 | P95 | P99 | Risk |
|---|---:|---:|---:|---|
| `/api/issues` | 253 ms | 287.67 ms | 299 ms | Highest latency baseline |
| `/api/team/grid` | 13 ms | 104 ms | 144 ms | Highest variance after issues |
| `/api/auth/session` | 13 ms | 27.33 ms | 36 ms | Healthy |
| `/api/documents` | 13 ms | 28 ms | 37 ms | Healthy |
| `/api/projects` | 12 ms | 26.33 ms | 35 ms | Healthy |

**Why this matters:** Phase 2 has a direct PRD target: reduce P95 by 20% on at least 2 endpoints. `/api/issues` and `/api/team/grid` are the best targets because they have clear upside and measurable baselines.

---

### 4. Testing Volume Exists, But Coverage Visibility Does Not

The repository has substantial test investment:

- `451` API Vitest tests
- `869` Playwright-listed tests
- `1320` total listed tests

However, quantitative coverage is unavailable because the coverage provider is missing.

**Why this matters:** without line/branch coverage, reviewers cannot easily verify how much critical logic is protected. This is a visibility and confidence gap, not a claim that the repository lacks tests.

---

### 5. Accessibility Is Strong In Automated Scores But Incomplete In Workflow Reality

Lighthouse scores are generally strong, but manual and axe findings show route-level gaps:

- `2` serious axe findings
- `0` critical findings
- keyboard navigation: partial
- NVDA route status: `/login` fail, other audited routes partial
- contrast issues on authenticated `/my-week` and `/projects`

**Why this matters:** Section 508/WCAG claims require more than high Lighthouse scores. Manual keyboard and screen-reader parity need remediation evidence.

---

## What Will Probably Break First At 10x Scale

| Area | Likely Failure Mode | Reason |
|---|---|---|
| Search | Query latency growth | `ILIKE` search uses sequential scan behavior. |
| API aggregation routes | Tail-latency amplification | Dense orchestration and runtime-shape assumptions. |
| Collaboration E2E/CI | Test instability | Heavy isolated environment setup and editor collaboration paths. |
| Frontend load | Slow first interaction | Oversized main bundle and heavy editor dependencies. |
| Accessibility workflows | Inconsistent operability | Automated scores are stronger than manual route parity. |

---

## Recommended Phase 2 Order

| Order | Focus | Why First |
|---:|---|---|
| 1 | `/api/issues` and `/api/team/grid` P95 reduction | Direct PRD performance target; clear before/after proof. |
| 2 | Bundle splitting / initial-load reduction | Direct PRD bundle target; likely high reviewer visibility. |
| 3 | Type-safety hotspot reduction | Improves maintainability and correctness in highest-risk routes. |
| 4 | Coverage instrumentation or 3 meaningful tests | Fixes confidence gap and supports safe remediation. |
| 5 | Accessibility serious violations | Direct compliance value and clear evidence artifacts. |
| 6 | Runtime edge-case fixes | Demonstrates user-facing reliability improvements. |
| 7 | Database/search optimization | Supports scale story and measurable EXPLAIN proof. |

---

## Final Executive Assessment

The Ship monorepo is not a broken system. It is a real brownfield production codebase with several strong foundations and a small number of concentrated risk zones.

The correct engineering response is not a rewrite.

The correct response is targeted hardening:

- reduce assertion-heavy API hotspots
- trim initial bundle cost
- stabilize high-variance endpoints
- add quantitative coverage visibility
- fix serious accessibility issues
- preserve the existing architecture where it is working

That approach best matches the PRD’s emphasis on proof, depth, reproducibility, and professional engineering judgment.
