# Reproducibility Guide

**Purpose:** Help reviewers and future maintainers reproduce the Phase 1 audit measurements quickly and consistently.  
**Audience:** time-constrained reviewers, Phase 2 implementers, and engineers validating before/after claims.  
**Principle:** A measurement is only useful if someone else can rerun it.

---

## 30-Second Read

Use the same environment, seeded data volume, route set, benchmark commands, and evidence artifacts when comparing Phase 1 baselines to Phase 2 improvements.

The most important reproducibility rule:

> Do not compare Phase 2 improvements against a different database volume, concurrency level, machine state, or command family without clearly disclosing the difference.

---

## Baseline Environment

| Tool | Baseline Version |
|---|---:|
| Node | `v22.22.0` |
| pnpm | `10.27.0` |
| Docker | `29.4.2` |

Audit scope:

```text
web/
api/
shared/
```

Repository path used during audit:

```text
D:\GFA_Cohort_5\Week_Four\ship
```

---

## Baseline Data Volume

The PRD requires realistic seeded data for performance testing. Stock seed data did not fully satisfy the target volume, so the baseline used augmented data.

| Entity | Baseline Count |
|---|---:|
| Documents | 557 |
| Issues | 104 |
| Users | 20 |
| Sprints | 35 |

Minimum PRD load target:

```text
500+ documents
100+ issues
20+ users
10+ sprints
```

---

## Setup Sequence

Run from repository root.

```bash
pnpm install
docker compose up -d
pnpm db:seed
```

Verify local toolchain:

```bash
node -v
pnpm -v
docker --version
```

Verify database counts with containerized `psql` or the project’s preferred DB access command.

---

## Category 1 — Type Safety

### Measurement Intent

Count type-safety weakening patterns across `web/src`, `api/src`, and `shared/src`.

### Baseline Metrics

| Metric | Baseline |
|---|---:|
| Total `any` types | 346 |
| Total type assertions, `as` | 1490 |
| Total non-null assertions, `!` | 326 |
| Total `@ts-ignore` / `@ts-expect-error` | 1 |
| Strict mode enabled | Yes |

### Suggested Reproduction Commands

Use a static scan script or equivalent grep/AST tooling for:

```text
any
 as 
!
@ts-ignore
@ts-expect-error
```

Then run:

```bash
pnpm type-check
```

### Required Before/After Evidence

- total counts
- package breakdown: `web`, `api`, `shared`
- top 5 violation-dense files
- confirmation that `pnpm type-check` passes

---

## Category 2 — Bundle Size

### Measurement Intent

Measure production frontend output and identify large dependencies/chunks.

### Baseline Metrics

| Metric | Baseline |
|---|---:|
| Total production bundle output | `11625.94 KB` |
| Largest chunk | `index-C2vAyoQ1.js`, `2025.14 KB` |
| JS chunk count | `261` |

Largest dependency signals:

```text
emoji-picker-react: 399.6 KB
highlight.js:       377.94 KB
yjs:                264.93 KB
```

### Reproduction Commands

```bash
pnpm --filter @ship/web exec vite build --sourcemap
pnpm dlx vite-bundle-visualizer
pnpm dlx depcheck --json
```

### Required Before/After Evidence

- total output size
- largest chunk name and size
- number of JS chunks
- treemap or analyzer output
- unused dependency scan notes

---

## Category 3 — API Response Time

### Measurement Intent

Benchmark 5 important authenticated API endpoints under realistic concurrent load.

### Endpoint Set

```text
/api/auth/session
/api/documents
/api/issues
/api/projects
/api/team/grid
```

### Baseline At 25 Concurrent Connections

| Endpoint | P50 | P95 | P99 |
|---|---:|---:|---:|
| `/api/auth/session` | 13 ms | 27.33 ms | 36 ms |
| `/api/documents` | 13 ms | 28.00 ms | 37 ms |
| `/api/issues` | 253 ms | 287.67 ms | 299 ms |
| `/api/projects` | 12 ms | 26.33 ms | 35 ms |
| `/api/team/grid` | 13 ms | 104.00 ms | 144 ms |

### Reproduction Command Family

```bash
pnpm dlx autocannon -j -d 8 -c <10|25|50> \
  -H "Cookie: <session_id>" \
  "http://localhost:3000<endpoint>"
```

### Required Before/After Evidence

- same endpoint set
- same concurrency levels: 10, 25, 50
- same seed volume
- same authenticated session method
- P50/P95/P99 table
- root-cause explanation for slow endpoints

### Method Note

P95 was derived by interpolation between available autocannon percentile outputs. Preserve the same method for before/after comparisons unless explicitly changing and documenting the method.

---

## Category 4 — Database Query Efficiency

### Measurement Intent

Count SQL queries and inspect slowest query behavior across 5 common user flows.

### Logging Setup

```sql
ALTER SYSTEM SET log_statement='all';
ALTER SYSTEM SET log_min_duration_statement=0;
SELECT pg_reload_conf();
```

### Baseline Flows

| User Flow | Total Queries | Slowest Query | N+1 Detected |
|---|---:|---:|---|
| Load main page | 22 | 2.68 ms | No |
| View a document | 4 | 0.77 ms | No |
| List issues | 5 | 1.78 ms | No |
| Load sprint board | 10 | 3.40 ms | No |
| Search content | 5 | 0.96 ms | No |

### Required Before/After Evidence

- same user flows
- query counts
- slowest query timing
- N+1 status
- `EXPLAIN ANALYZE` output
- explanation of what changed and why

---

## Category 5 — Test Coverage And Quality

### Measurement Intent

Assess test volume, pass/fail/flaky state, runtime, coverage visibility, and critical gaps.

### Baseline Summary

| Metric | Baseline |
|---|---|
| Total tests | 451 API Vitest + 869 Playwright listed = 1320 |
| API tri-run | Stable; no observed flakes |
| Playwright tri-run | Reproducible fail/flaky behavior |
| Coverage | N/A, missing `@vitest/coverage-v8` |

### Reproduction Commands

```bash
pnpm test
PLAYWRIGHT_WORKERS=1 pnpm test:e2e
```

Run the relevant suite 3 times for flake assessment.

### Required Before/After Evidence

- total tests
- pass/fail/flaky count
- suite runtime
- critical uncovered flows
- coverage percentage if instrumentation is enabled
- test comments explaining risk mitigated

---

## Category 6 — Runtime Error And Edge Cases

### Measurement Intent

Validate behavior under normal usage, malformed input, disconnect/reconnect, concurrent editing, and slow network conditions.

### Baseline Signals

| Metric | Baseline |
|---|---|
| Console errors during normal usage | 5 |
| Server unhandled promise rejections | 0 observed |
| Network disconnect recovery | Pass |
| Missing error boundaries | Listed in report |
| Silent failures | Startup race, modal blocking, script-like title accepted |

### Reproduction Targets

- start web before API readiness and observe proxy failures
- attempt editor interaction with blocking modal present
- POST `/api/issues` with empty, overlong, and script-like titles
- edit same document in two sessions
- emulate 3G network on major authenticated routes

### Required Before/After Evidence

- exact reproduction steps
- before behavior
- after behavior
- screenshots or recordings where useful
- browser/server log notes

---

## Category 7 — Accessibility Compliance

### Measurement Intent

Verify accessibility with automated and manual methods.

### Baseline Summary

| Metric | Baseline |
|---|---|
| Lighthouse unauthenticated routes | mostly 98 |
| Authenticated parity | `/my-week` 96; `/issues`, `/projects`, `/docs` 100 |
| Critical violations | 0 |
| Serious violations | 2 |
| Keyboard navigation | Partial |
| NVDA walkthrough | `/login` fail; other audited routes partial |

### Reproduction Commands / Methods

- Lighthouse audits on major routes
- axe-core scans on authenticated routes
- keyboard traversal with Tab, Enter, Escape, arrow keys
- manual NVDA or equivalent screen-reader walkthrough
- contrast inspection against WCAG 2.1 AA expectations

### Required Before/After Evidence

- route-by-route Lighthouse results
- axe violation count by severity
- keyboard notes
- screen-reader notes
- contrast-fix evidence

---

## Evidence Artifacts To Preserve

Keep these outputs with the submission where available:

```text
prd_dev_branch_one/lighthouse-login.json
prd_dev_branch_one/lighthouse-my-week.json
prd_dev_branch_one/lighthouse-issues.json
prd_dev_branch_one/lighthouse-projects.json
prd_dev_branch_one/lighthouse-docs.json
prd_dev_branch_one/lighthouse-auth-my-week.json
prd_dev_branch_one/lighthouse-auth-issues.json
prd_dev_branch_one/lighthouse-auth-projects.json
prd_dev_branch_one/lighthouse-auth-docs.json
tri-run-playwright-run1.log
tri-run-playwright-run2.log
prd_dev_branch_one/tri-run-playwright-runA.log
```

---

## Final Reproducibility Checklist

Before claiming improvement, confirm:

- [ ] same branch baseline is clearly identified
- [ ] same hardware/environment caveats are disclosed
- [ ] same data volume is used
- [ ] same command family is used
- [ ] same routes/flows are measured
- [ ] tests still pass or failures are justified
- [ ] raw artifacts are saved
- [ ] root cause is documented
- [ ] tradeoffs are documented

This checklist protects the credibility of the Phase 2 improvement story.
