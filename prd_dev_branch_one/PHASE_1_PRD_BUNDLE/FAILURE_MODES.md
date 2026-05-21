# Failure Modes Catalog

**Purpose:** Document likely failure paths discovered or implied by the Phase 1 audit so Phase 2 work can reduce real operational risk.  
**Audience:** reviewers, maintainers, test authors, and implementers.  
**Principle:** a failure mode is useful only when it includes trigger, impact, detection, and mitigation.

---

## 30-Second Read

The highest-value failure modes to address are:

1. slow or unstable `/api/issues` behavior under concurrency
2. blocked editor interactions due to modal state
3. script-like issue titles accepted into storage
4. collaboration E2E instability under isolated environment setup
5. missing quantitative coverage during refactor-heavy work
6. sequential scan search degradation at larger data volumes
7. inconsistent accessibility workflow behavior despite strong automated scores

---

## Failure Mode Severity Legend

| Severity | Meaning |
|---|---|
| Critical | Can cause major workflow failure, compliance issue, security-sensitive exposure, or production instability. |
| High | Likely to degrade important workflows under realistic use or scale. |
| Medium | Creates confusion, operational friction, or future scaling risk. |
| Low | Localized or limited operational impact. |

---

## Catalog

### FM-01 — API Tail Latency In `/api/issues`

| Field | Detail |
|---|---|
| Severity | High |
| Trigger | Concurrent authenticated users requesting issue data. |
| Observed Signal | `/api/issues` had the weakest P95/P99 baseline among measured endpoints. |
| User Impact | Issue views may feel slow or inconsistent under moderate load. |
| Operational Impact | Performance regressions may be hard to notice without benchmark discipline. |
| Detection | Autocannon P50/P95/P99 runs at 10/25/50 concurrency. |
| Mitigation | Profile route, reduce unnecessary work, improve query/data shaping, rerun identical benchmark. |
| Proof Needed | Before/after P95 reduction of at least 20% if used for PRD target. |

---

### FM-02 — `/api/team/grid` Tail Variance

| Field | Detail |
|---|---|
| Severity | Medium / High |
| Trigger | Concurrent requests to team grid data. |
| Observed Signal | P95/P99 variance higher than healthier endpoints. |
| User Impact | Team grid may feel inconsistent during heavier usage. |
| Operational Impact | May become a secondary bottleneck after `/api/issues`. |
| Detection | Same endpoint benchmark family used in Phase 1. |
| Mitigation | Inspect aggregation path, reduce repeated work, validate response shape. |
| Proof Needed | Before/after benchmark table. |

---

### FM-03 — Search Query Degrades At Larger Data Volume

| Field | Detail |
|---|---|
| Severity | Medium |
| Trigger | More documents or frequent search usage. |
| Observed Signal | Search path relies on sequential scan behavior for `ILIKE`. |
| User Impact | Search becomes slower as document count grows. |
| Operational Impact | Database load increases disproportionately. |
| Detection | `EXPLAIN ANALYZE` and query timing under larger seeded data. |
| Mitigation | Add targeted index/search strategy; consider trigram/full-text approach if in scope. |
| Proof Needed | Before/after `EXPLAIN ANALYZE` and timing. |

---

### FM-04 — Sprint Board Query Complexity Scales Poorly

| Field | Detail |
|---|---|
| Severity | Medium |
| Trigger | Larger sprint/project/document relationship sets. |
| Observed Signal | Correlated subplans and repeated association counts. |
| User Impact | Sprint board load may degrade before simple list views. |
| Operational Impact | Increased DB CPU and query planning work. |
| Detection | `EXPLAIN ANALYZE`, query count logs, sprint-board flow timing. |
| Mitigation | Batch repeated counts, simplify aggregation, align indexes with predicates. |
| Proof Needed | Query count or slowest-query improvement. |

---

### FM-05 — Script-Like Issue Title Stored Successfully

| Field | Detail |
|---|---|
| Severity | High |
| Trigger | Authenticated `POST /api/issues` with `title: "<script>alert(1)</script>"`. |
| Observed Signal | Request returned `201` and stored literal script-like content. |
| User Impact | Currently depends on downstream rendering safety; future unsafe renderer could expose XSS risk. |
| Operational Impact | Security-review and trust concern. |
| Detection | Malformed input probe and rendered output inspection. |
| Mitigation | Enforce validation/sanitization policy or guarantee safe escaping at every render boundary. |
| Proof Needed | Before/after request behavior and rendering safety evidence. |

---

### FM-06 — Modal Blocks Editor Interaction

| Field | Detail |
|---|---|
| Severity | Medium |
| Trigger | User navigates to document with blocking modal state open and attempts editor interaction. |
| Observed Signal | Click interception and timeout until modal dismissed with Escape. |
| User Impact | Confusing blocked workflow; automation failures. |
| Operational Impact | E2E instability and false negatives in collaboration tests. |
| Detection | Playwright interaction path; manual modal/editor reproduction. |
| Mitigation | Improve modal state handling, focus management, or test setup cleanup. |
| Proof Needed | Before/after interaction reproduction. |

---

### FM-07 — Startup API Readiness Race

| Field | Detail |
|---|---|
| Severity | Medium |
| Trigger | Web dev server starts before API is ready. |
| Observed Signal | Repeated `ECONNREFUSED` proxy errors in dev output. |
| User Impact | Confusing first-load failures during local development. |
| Operational Impact | Onboarding friction and noisy debugging. |
| Detection | Start web before API readiness and load app. |
| Mitigation | Add readiness messaging, startup sequencing, or clearer user/developer error state. |
| Proof Needed | Before/after startup behavior and log comparison. |

---

### FM-08 — Missing Global Error Boundary Coverage

| Field | Detail |
|---|---|
| Severity | Medium |
| Trigger | Route-level runtime failure outside localized boundaries. |
| Observed Signal | Existing local boundaries do not appear to cover the full app shell. |
| User Impact | Possible blank or confusing failure states. |
| Operational Impact | Harder support/debug path for uncaught UI errors. |
| Detection | Inject or reproduce controlled route-level failure. |
| Mitigation | Add app-shell or route-level error boundary with useful recovery UI. |
| Proof Needed | Before/after failure reproduction. |

---

### FM-09 — Collaboration E2E Infrastructure Instability

| Field | Detail |
|---|---|
| Severity | High |
| Trigger | Full Playwright suite under isolated environment setup. |
| Observed Signal | Reproducible fail/flaky behavior across tri-run protocol. |
| User Impact | Indirect; weakens confidence in collaboration regression protection. |
| Operational Impact | CI time, false failures, and delayed delivery. |
| Detection | Three independent `pnpm test:e2e` runs with consistent settings. |
| Mitigation | Stabilize fixtures, reduce container/runtime coupling, isolate repeated failure clusters. |
| Proof Needed | Before/after tri-run summary. |

---

### FM-10 — Missing Coverage Instrumentation During Refactor Work

| Field | Detail |
|---|---|
| Severity | High |
| Trigger | Type, query, or route refactors without quantitative coverage visibility. |
| Observed Signal | Coverage unavailable because provider is missing. |
| User Impact | Indirect; regressions may escape. |
| Operational Impact | Lower confidence in Phase 2 changes. |
| Detection | Coverage command fails or reports N/A. |
| Mitigation | Configure provider or add targeted meaningful regression tests. |
| Proof Needed | Coverage report or 3 meaningful tests with pass output. |

---

### FM-11 — Accessibility Workflow Inconsistency

| Field | Detail |
|---|---|
| Severity | High |
| Trigger | Keyboard or screen-reader user navigates authenticated routes. |
| Observed Signal | Partial keyboard completeness; route-level NVDA findings; 2 serious contrast issues. |
| User Impact | Users may be blocked or slowed despite strong automated scores. |
| Operational Impact | Section 508/WCAG compliance risk. |
| Detection | Lighthouse, axe, keyboard traversal, manual screen-reader walkthrough. |
| Mitigation | Fix serious findings, improve labels/context, validate keyboard and SR workflows. |
| Proof Needed | Before/after axe/Lighthouse and manual notes. |

---

### FM-12 — Oversized Initial Frontend Load

| Field | Detail |
|---|---|
| Severity | High |
| Trigger | First visit or route load on constrained network/device. |
| Observed Signal | Largest chunk approximately 2 MB; total output over 11 MB. |
| User Impact | Slower initial load and time-to-interactive. |
| Operational Impact | Worse experience over enterprise VPNs or slow networks. |
| Detection | Production build output and bundle visualizer. |
| Mitigation | Lazy-load editor/collaboration-heavy features and optional dependencies. |
| Proof Needed | Before/after build size, chunk size, and visualizer output. |

---

## Failure Mode Prioritization

| Priority | Failure Mode | Reason |
|---:|---|---|
| 1 | FM-01 API tail latency | Direct PRD target and core workflow. |
| 2 | FM-12 oversized initial load | Direct PRD target and user-visible performance. |
| 3 | FM-10 coverage instrumentation | Protects every other fix. |
| 4 | FM-11 accessibility inconsistency | Compliance and user inclusion. |
| 5 | FM-05 script-like title accepted | Security-sensitive latent risk. |
| 6 | FM-09 E2E instability | CI and collaboration confidence. |
| 7 | FM-03 search scaling | 10x-scale bottleneck. |

---

## Final Note

A strong Phase 2 submission does not need to eliminate every possible failure mode.

It should fix the highest-leverage ones, prove the fixes under comparable conditions, and document the remaining risks clearly.
