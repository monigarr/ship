# Architecture Heatmap

**Purpose:** Identify where technical pressure is concentrated in the Ship monorepo.  
**Audience:** tired reviewers, future maintainers, and Phase 2 implementers.  
**Principle:** This is a prioritization map, not a rewrite proposal.

---

## 30-Second Read

The architecture is not broadly failing. The highest risks are concentrated in a small number of areas:

- assertion-heavy API route handlers
- oversized frontend entry bundle
- `/api/issues` and `/api/team/grid` latency behavior
- missing coverage instrumentation
- collaboration-heavy E2E instability
- authenticated accessibility consistency
- search query scaling risk

The strongest strategy is focused hardening, not architectural replacement.

---

## Heatmap Legend

| Level | Meaning |
|---|---|
| Critical  | Immediate architectural pressure or likely Phase 2 priority.  |
| High      | Important long-term scaling, correctness, or compliance risk. |
| Medium    | Contained but meaningful engineering risk.                    |
| Low       | Localized issue or positive/healthy area.                     |

---

## System Heatmap

| Area | Heat | Evidence Signal | Why It Matters | Best Next Action |
|---|---:|---|---|---|
| `api/src/routes/weeks.ts` | Critical | 216 combined type-safety violations | High route orchestration complexity and nullability risk. | Replace assertions with typed helpers and runtime guards. |
| `api/src/routes/team.ts` | Critical | 171 combined type-safety violations | Aggregated team data can hide shape assumptions. | Define response contracts and narrow input/output shapes. |
| `api/src/routes/projects.ts` | High | 106 combined type-safety violations | Core workflow surface with refactor risk. | Reduce `as` and `!` usage around known payloads. |
| `/api/issues` | Critical | P95 287.67 ms at 25 concurrency | Slowest key endpoint; direct PRD performance target. | Profile route, reduce avoidable work, benchmark again. |
| `/api/team/grid` | High | P95 104 ms, P99 144 ms | High variance relative to other endpoints. | Inspect aggregation/query path and cache/reduce repeated work if safe. |
| Frontend entry bundle | Critical | Largest chunk 2025.14 KB | Direct first-load and TTI risk. | Lazy-load editor-heavy and optional features. |
| Editor/collaboration bundle surface | High | `yjs`, editor ecosystem, highlight/emoji dependencies | Valuable feature set, but too expensive for initial load if eager. | Route-level and feature-level code splitting. |
| Search query path | High | `ILIKE` sequential scan behavior | Likely to degrade first with larger data. | Add targeted index/search strategy and EXPLAIN proof. |
| Sprint-board query shape | Medium | Correlated subplans / repeated association counts | Current time is low, but structure is expensive. | Simplify aggregation or batch counts. |
| Playwright collaboration flows | High | Tri-run instability and infrastructure-bound retries | CI confidence and collaboration regression risk. | Stabilize fixtures and isolate flaky clusters. |
| Coverage instrumentation | High | Coverage N/A due missing provider | Hard to prove test completeness or refactor safety. | Install/configure provider or add direct meaningful tests. |
| Accessibility route parity | High | 2 serious axe findings, partial NVDA/keyboard status | Compliance and usability risk on authenticated workflows. | Fix serious issues and add repeatable scan evidence. |
| Runtime error boundaries | Medium | No global app-shell catch-all observed | User-facing failures may not recover cleanly. | Add boundary coverage where route-level failure is plausible. |
| Startup readiness flow | Medium | `ECONNREFUSED` noise when API not ready | Confusing transient startup behavior. | Add readiness messaging or dev startup sequencing. |
| Shared type package | Low / strong | Shared contracts across packages | Positive architecture foundation. | Preserve; extend contracts where route assertions are reduced. |
| Authentication/session latency | Low / healthy | P95 27.33 ms at 25 concurrency | Stable baseline path. | Avoid unnecessary changes. |

---

## Heatmap By Layer

### Frontend

| Heat | Area | Summary |
|---|---|---|
| Critical  | Entry bundle | Initial load is the clearest frontend performance risk. |
| High      | Editor/collaboration dependencies | Heavy but valuable; should load only when needed. |
| High      | Accessibility parity | Automated scores are strong, but manual workflow results are mixed. |
| Medium    | Modal/editor interaction | Modal state can block editor interactions and tests. |

### Backend

| Heat | Area | Summary |
|---|---|---|
| Critical | API route type safety | Runtime assumptions are concentrated in core route handlers. |
| Critical | `/api/issues` latency | Best performance target for Phase 2. |
| High | `/api/team/grid` variance | Secondary endpoint target for P95 improvement. |
| Medium | Startup readiness | Noisy failure mode during dev startup sequencing. |

### Database

| Heat | Area | Summary |
|---|---|---|
| High | Search | Sequential scan behavior is a scale risk. |
| Medium | Sprint board | Query structure is more concerning than current timing. |
| Low | Current query timings | Baseline timings are low at current seeded volume. |

### Testing / CI

| Heat | Area | Summary |
|---|---|---|
| High | Coverage instrumentation | Missing quantitative coverage blocks objective completeness reporting. |
| High | E2E collaboration instability | Collaboration and isolated environment setup are repeated weak points. |
| Low | API suite stability | Repeated API runs appear stable. |

### Accessibility

| Heat | Area | Summary |
|---|---|---|
| High | Serious contrast findings | Must be fixed for credible compliance posture. |
| Medium | Keyboard completeness | Partial workflow coverage needs hardening. |
| Medium | Screen-reader walkthroughs | Route-level usability is uneven. |

---

## Strong Architectural Foundations To Preserve

| Foundation | Why It Matters |
|---|---|
| Unified document model | Consistent mental model across docs, issues, projects, and sprints. |
| Shared types | Reduces frontend/backend contract drift. |
| Server-authoritative collaboration model | Sensible production posture for offline-tolerant workflows. |
| Mature tool choices | React, Express, PostgreSQL, Docker, Terraform, Playwright are broadly maintainable. |
| Existing test investment | A large test suite exists; the gap is instrumentation and stability, not absence. |

---

## Top Remediation Clusters

| Cluster | Target | Why It Is High Leverage |
|---|---|---|
| Type boundary hardening | API route hotspots | Reduces runtime and refactor risk in core backend paths. |
| Initial-load optimization | Main frontend chunk | Produces visible performance improvement and direct PRD evidence. |
| Tail-latency reduction | `/api/issues`, `/api/team/grid` | Maps directly to measurable P95 target. |
| Test confidence | Coverage provider / meaningful tests | Improves safety of all other fixes. |
| Accessibility compliance | Serious axe findings and keyboard/SR gaps | Strong user-impact and compliance signal. |

---

## Final Heatmap Interpretation

The system is a strong brownfield candidate: stable enough to improve incrementally, complex enough to require discipline, and instrumented enough to support measurable before/after proof.

The best reviewer-facing message is:

> The audit found concentrated production risks, not generalized architectural failure. Phase 2 should preserve the working foundations and reduce the highest-risk hotspots with measured, reproducible improvements.
