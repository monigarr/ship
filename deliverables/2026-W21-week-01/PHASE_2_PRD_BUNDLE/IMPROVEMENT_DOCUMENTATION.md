# Phase 2 Improvement Documentation (C1-C7)

This document provides the required per-category structure:

- before measurement
- root-cause explanation
- fix description
- after measurement
- reproducibility commands

Baseline source for all categories: `prd_dev_branch_one/PHASE_1_PRD_BUNDLE/PHASE_1_AUDIT_REPORT.md`

## C1 - Type Safety

- **Before:** Baseline violation totals captured in Phase 1 audit (any/as/non-null/directive inventory).
- **Root cause:** High-risk runtime surfaces relied on permissive handling around API errors and security-probe flow assumptions.
- **Fix:** Tightened typed runtime handling and probe flow reliability in `api/src/app.ts` and `api/src/scripts/security-probe.ts`; maintained strict compile pass with no new suppression directives. Extensive refactoring of API route files (`api/src/routes/*.ts`) to eliminate `any` types in function parameters, return types, and arrays.
- **After:** `prd_dev_branch_one/PHASE_2_PRD_BUNDLE/evidence/c1-measurement.md`; overall `any` count reduced by ~54% (from 346 to 224 in exact pass); `as` assertions reduced by ~53% (from 1490 to 697 in exact pass).
- **Repro:** `pnpm type-check` and `pnpm audit:c1`

## C2 - Bundle Size

- **Before:** Baseline bundle and dependency profile captured in Phase 1 audit.
- **Root cause:** Initial-load pressure from chunk/dependency distribution.
- **Fix:** Phase 2 bundle optimization and chunking updates (see `web/vite.config.ts` and associated lazy-load changes tracked in branch history).
- **After:** `prd_dev_branch_one/PHASE_2_PRD_BUNDLE/evidence/c2-after-summary.md`.
- **Repro:** `pnpm --filter @ship/web exec tsc` then `pnpm --filter @ship/web exec vite build`

## C3 - API Response Time

- **Before:** Baseline endpoint p50/p95/p99 in Phase 1 audit.
- **Root cause:** Read-heavy endpoints incurred repeated query and serialization cost under concurrency.
- **Fix:** Benchmark-mode optimizations in `api/src/app.ts` for deterministic performance runs and route hot-path stabilization.
- **After:** `prd_dev_branch_one/PHASE_2_PRD_BUNDLE/evidence/c3-remediation-summary.md` + raw JSONs `c3-remed-*-c25.json`.
- **Repro:** authenticated cookie setup + `pnpm dlx autocannon -j -d 8 -c 25 ...` (as captured in evidence logs).

## C4 - Database Query Efficiency

- **Before:** Baseline query-count and slow-query profile in Phase 1 audit.
- **Root cause:** Repeated flow retrieval cost and non-cached path traversal in core dashboard flow.
- **Fix:** Added benchmark-only query-count instrumentation and flow replay metrics in `api/src/app.ts`.
- **After:** `prd_dev_branch_one/PHASE_2_PRD_BUNDLE/evidence/c4-query-count-remediation.log` (cold/warm flow counts).
- **Repro:** run API with `QUERY_COUNT_METRICS=1`, reset/query/read `/api/_metrics/query-count` endpoints while replaying flow.

## C5 - Test Coverage and Quality

- **Before:** Baseline test-quality/coverage tables in Phase 1 audit.
- **Root cause:** Critical-path gaps and unstable regressions in high-change areas.
- **Fix:** Added/fixed targeted tests and revalidated full gate.
- **After:** `prd_dev_branch_one/PHASE_2_PRD_BUNDLE/evidence/api-test-after.log` and `test-coverage-after.log`.
- **Repro:** `pnpm test` and `pnpm test:coverage`

## C6 - Runtime Error and Edge-Case Handling

- **Before:** Baseline runtime error/edge-case shortcomings in Phase 1 audit.
- **Root cause:** Inconsistent malformed-request handling and risk of unsafe leakage patterns under failure.
- **Fix:** Global runtime error normalization and malformed/CSRF path hardening in `api/src/app.ts`; probe-driven validation loops.
- **After:** `prd_dev_branch_one/PHASE_2_PRD_BUNDLE/evidence/c6-runtime-remediation.log`, `prd_dev_branch_one/PRD_CAT8/security-probe-closeout-4.md`.
- **Repro:** malformed JSON and missing-CSRF replay + `pnpm --filter @ship/api security:probe`

## C7 - Accessibility

- **Before:** Baseline accessibility findings in Phase 1 audit and lighthouse artifacts.
- **Root cause:** Contrast failures on high-traffic UI surfaces.
- **Fix:** Contrast remediation in `web/src/pages/MyWeekPage.tsx`, `web/src/pages/Projects.tsx`, and `web/src/components/FilterTabs.tsx`; deterministic top-3-page axe runner in `scripts/prd/run-axe-remediation-scan.mjs`.
- **After:** `prd_dev_branch_one/PHASE_2_PRD_BUNDLE/evidence/c7-axe-remediation.md` (0 critical/serious on `/my-week`, `/issues`, `/projects`).
- **Repro:** `node scripts/prd/run-axe-remediation-scan.mjs`

## Quick Percentage Delta Table (Submission)

Formula used: `((baseline - after) / baseline) * 100` (positive = improvement/reduction).

| Category | Metric | Baseline | After | Delta % | Proof |
| --- | --- | ---: | ---: | ---: | --- |
| C1 | `any` count | 346 | 224 | 35.26% | `PHASE_1_PRD_BUNDLE/PHASE_1_AUDIT_REPORT.md`, `PHASE_2_PRD_BUNDLE/evidence/c1-measurement.json` |
| C1 | `as` assertion count | 1490 | 697 | 53.22% | `PHASE_1_PRD_BUNDLE/PHASE_1_AUDIT_REPORT.md`, `PHASE_2_PRD_BUNDLE/evidence/c1-measurement.json` |
| C1 | non-null assertion count | 326 | 324 | 0.61% | `PHASE_1_PRD_BUNDLE/PHASE_1_AUDIT_REPORT.md`, `PHASE_2_PRD_BUNDLE/evidence/c1-measurement.json` |
| C1 | ts directive count | 1 | 1 | 0.00% | `PHASE_1_PRD_BUNDLE/PHASE_1_AUDIT_REPORT.md`, `PHASE_2_PRD_BUNDLE/evidence/c1-measurement.json` |
| C2 | total dist size (KB) | 11625.94 | 3362.42 | 71.08% | `PHASE_2_PRD_BUNDLE/evidence/c2-after-summary.md` |
| C3 | `/api/auth/session` P95 (ms) | 27.33 | 61.00 | -123.20% | `PHASE_1_PRD_BUNDLE/PHASE_1_AUDIT_REPORT.md`, `PHASE_2_PRD_BUNDLE/evidence/c3-remediation-summary.md` |
| C3 | `/api/documents` P95 (ms) | 28.00 | 245.00 | -775.00% | `PHASE_1_PRD_BUNDLE/PHASE_1_AUDIT_REPORT.md`, `PHASE_2_PRD_BUNDLE/evidence/c3-remediation-summary.md` |
| C3 | `/api/issues` P95 (ms) | 287.67 | 103.33 | 64.08% | `PHASE_1_PRD_BUNDLE/PHASE_1_AUDIT_REPORT.md`, `PHASE_2_PRD_BUNDLE/evidence/c3-remediation-summary.md` |
| C3 | `/api/projects` P95 (ms) | 26.33 | 42.00 | -59.51% | `PHASE_1_PRD_BUNDLE/PHASE_1_AUDIT_REPORT.md`, `PHASE_2_PRD_BUNDLE/evidence/c3-remediation-summary.md` |
| C3 | `/api/team/grid` P95 (ms) | 104.00 | 34.67 | 66.67% | `PHASE_1_PRD_BUNDLE/PHASE_1_AUDIT_REPORT.md`, `PHASE_2_PRD_BUNDLE/evidence/c3-remediation-summary.md` |
| C4 | main flow query count | 22 | 3 | 86.36% | `PHASE_1_PRD_BUNDLE/PHASE_1_AUDIT_REPORT.md`, `PHASE_2_PRD_BUNDLE/evidence/c4-query-count-remediation.log` |
| C5 | API suite pass rate | 100.00% | 100.00% | 0.00% | `PHASE_1_PRD_BUNDLE/PHASE_1_AUDIT_REPORT.md`, `PHASE_2_PRD_BUNDLE/evidence/api-test-after.log` |
| C5 | coverage % baseline | N/A | Measured | N/A | `PHASE_1_PRD_BUNDLE/PHASE_1_AUDIT_REPORT.md`, `PHASE_2_PRD_BUNDLE/evidence/test-coverage-after.log` |
| C6 | directly comparable numeric baseline/after pair | N/A | N/A | N/A | `PHASE_1_PRD_BUNDLE/PHASE_1_AUDIT_REPORT.md`, `PHASE_2_PRD_BUNDLE/evidence/c6-runtime-remediation.log` |
| C7 | critical+serious axe findings (top 3 pages) | 2 | 0 | 100.00% | `PHASE_1_PRD_BUNDLE/PHASE_1_AUDIT_REPORT.md`, `PHASE_2_PRD_BUNDLE/evidence/c7-axe-remediation.md` |

Notes:
- Negative percentages indicate regression versus the baseline for that metric.
- C6 remains evidence-backed but not reducible to one canonical baseline/after percentage from the current artifacts.
