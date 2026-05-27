# Remediation Priority Plan

**Purpose:** Convert Phase 1 findings into a Phase 2 execution plan that matches PRD expectations for measurable improvement, technical depth, documentation clarity, and commit discipline.  
**Mode:** Planning document only. It does not claim remediation has already been completed.  
**Primary rule:** every Phase 2 fix must include before/after proof under comparable conditions.

---

## 30-Second Read

Recommended order:

1. Reduce P95 on `/api/issues` and `/api/team/grid`.
2. Reduce initial frontend bundle cost with code splitting.
3. Remove meaningful type-safety violations in API route hotspots.
4. Restore coverage visibility or add 3 meaningful critical-path tests.
5. Fix serious accessibility findings on key authenticated pages.
6. Fix 3 runtime/error-handling gaps with reproduction evidence.
7. Improve database/search query behavior with EXPLAIN proof.

This order maximizes measurable reviewer-visible progress while reducing production risk.

---

## PRD Target Map

| Category | PRD Improvement Target | Best Phase 2 Target |
|---|---|---|
| Type Safety | Eliminate 25% of violations with meaningful types | API route hotspots: `weeks`, `team`, `projects`, `issues` |
| Bundle Size | Reduce total bundle 15% or initial load 20% | Lazy-load editor-heavy and optional dependencies |
| API Response Time | Reduce P95 by 20% on at least 2 endpoints | `/api/issues`, `/api/team/grid` |
| Database Efficiency | Reduce query count 20% on one flow or slowest query 50% | Search `ILIKE` path or sprint-board aggregation |
| Test Coverage/Quality | Add 3 meaningful tests or fix 3 flaky tests | Coverage instrumentation plus collaboration/offline/a11y tests |
| Runtime/Error Handling | Fix 3 gaps, at least one user-facing confusion/data-loss scenario | Script-like title handling, modal blocking, startup readiness UX |
| Accessibility | Improve lowest Lighthouse 10+ or fix all Critical/Serious on 3 key pages | Serious contrast findings and route workflow parity |

---

## Priority 1 — API Response Time

### Target

- `/api/issues`
- `/api/team/grid`

### Why First

These are the clearest performance targets. They have direct P95/P99 baselines and map cleanly to the PRD’s requirement for a 20% P95 reduction on at least 2 endpoints.

### Suggested Work

- Profile route handlers before changing code.
- Identify repeated queries, over-fetching, avoidable transformations, or expensive aggregation.
- Preserve response shape.
- Run the same benchmark commands after remediation.

### Required Proof

| Evidence | Required |
|---|---|
| Same seeded data volume | Yes |
| Same concurrency level | Yes |
| Same benchmark tool | Yes |
| Before/after P50/P95/P99 table | Yes |
| Root-cause explanation | Yes |

### Commit Strategy

One commit per endpoint or one branch named clearly, for example:

```bash
git checkout -b phase2-api-latency-issues-team-grid
```

---

## Priority 2 — Bundle Size / Initial Load

### Target

- frontend entry chunk
- editor/collaboration dependencies
- optional UI packages such as emoji/highlight-related surfaces

### Why Second

Bundle optimization is reviewer-visible and has a direct PRD target. The largest chunk is over 2 MB, so code splitting can produce a clear before/after result.

### Suggested Work

- Lazy-load editor-heavy routes/components.
- Separate optional UI tools from initial shell.
- Check mixed static/dynamic imports that prevent splitting.
- Keep functionality intact.

### Required Proof

| Evidence | Required |
|---|---|
| Before/after production build output | Yes |
| Largest chunk before/after | Yes |
| Initial route bundle before/after | Preferred |
| Treemap or visualizer output | Yes |
| Confirmation functionality was preserved | Yes |

### Avoid

- removing functionality just to shrink the bundle
- changing styling without bundle impact
- optimizing only source maps while ignoring runtime JS

---

## Priority 3 — Type Safety Hotspots

### Target

- `api/src/routes/weeks.ts`
- `api/src/routes/team.ts`
- `api/src/routes/projects.ts`
- `api/src/routes/issues.ts`

### Why Third

This reduces correctness and maintainability risk in the most concentrated backend hotspots.

### Suggested Work

- Replace unsafe `any` with domain-specific interfaces.
- Use `unknown` only when paired with real narrowing.
- Add typed helper functions for repeated response shapes.
- Reduce non-null assertions by checking and handling missing data.
- Prefer shared contracts where appropriate.

### Required Proof

| Evidence | Required |
|---|---|
| Before/after violation count | Yes |
| Package/file breakdown | Yes |
| Type-check passes | Yes |
| Existing tests still pass or justified | Yes |
| Explanation of meaningful type improvements | Yes |

### Success Looks Like

A reviewer can inspect the diff and see actual correctness improvement, not just type silence.

---

## Priority 4 — Test Coverage And Quality

### Target

Pick one of two paths:

1. configure coverage instrumentation, or
2. add/fix 3 meaningful tests tied to real risks.

### Best Tests To Add

| Test Area | Risk Mitigated |
|---|---|
| Offline reconnect data survival | Prevents collaboration data-loss regressions. |
| Dual-user same-document edit convergence | Protects core CRDT/collaboration behavior. |
| Screen-reader/keyboard workflow assertion | Protects accessibility beyond Lighthouse. |
| Script-like issue title rendering safety | Protects latent XSS-adjacent path. |
| Modal/editor interaction path | Protects against blocked editor workflows. |

### Required Proof

- test names and files
- before gap explanation
- after pass output
- risk-mitigation comment in each test
- flaky-test root cause if fixing existing tests

---

## Priority 5 — Accessibility Compliance

### Target

- authenticated `/my-week`
- authenticated `/projects`
- `/login` screen-reader workflow
- keyboard traversal completeness

### Why Fifth

Accessibility is a compliance and human-usability issue. Automated scores are not enough; route-level workflow quality matters.

### Suggested Work

- Fix serious contrast findings.
- Re-run axe on key routes.
- Add labels/context for controls with unclear spoken purpose.
- Validate keyboard traversal with Tab, Enter, Escape, and arrow keys.
- Preserve visible design intent while improving contrast and semantics.

### Required Proof

| Evidence | Required |
|---|---|
| Before/after axe result | Yes |
| Before/after Lighthouse if applicable | Yes |
| Manual keyboard notes | Yes |
| Manual screen-reader notes | Strongly recommended |

---

## Priority 6 — Runtime Error And Edge Cases

### Target

Fix 3 gaps, at least one with real user-facing confusion or data-loss potential.

Recommended candidates:

| Gap | Why It Matters |
|---|---|
| Script-like issue title accepted | Latent XSS-adjacent risk if downstream rendering changes. |
| Modal blocking editor interaction | Can confuse users and break collaboration workflows. |
| Startup API readiness race | Causes confusing transient app failures. |
| Missing app-shell error boundary | Can leave broad route failures poorly handled. |

### Required Proof

- reproduction steps
- before behavior
- fix summary
- after behavior
- screenshot or recording if available
- server/browser log comparison if relevant

---

## Priority 7 — Database Efficiency

### Target

- search content flow
- sprint-board query path

### Why Seventh

Current query timings are low, so this is important but not the first fire. It matters most for the 10x scale story.

### Suggested Work

- Add or adjust index strategy for search path.
- Consider trigram/full-text search if appropriate and within scope.
- Reduce repeated correlated subplans in sprint-board query.
- Prove with `EXPLAIN ANALYZE` before and after.

### Required Proof

| Evidence | Required |
|---|---|
| Before/after query count or slowest query time | Yes |
| Before/after EXPLAIN ANALYZE | Yes |
| Same data volume | Yes |
| Explanation of inefficient pattern | Yes |

---

## Suggested Branch / Commit Plan

| Branch | Purpose |
|---|---|
| `phase2-api-latency` | `/api/issues` and `/api/team/grid` P95 improvements |
| `phase2-bundle-splitting` | frontend initial-load reduction |
| `phase2-type-safety-api-routes` | meaningful API route type reductions |
| `phase2-test-confidence` | coverage instrumentation or 3 meaningful tests |
| `phase2-accessibility-serious-fixes` | serious axe/contrast and workflow fixes |
| `phase2-runtime-edge-cases` | runtime/error-handling gaps |
| `phase2-db-query-efficiency` | query count or slowest-query improvements |

---

## Final Recommendation

Do not attempt to fix everything superficially.

The strongest Phase 2 story is:

1. pick the highest-risk targets,
2. preserve behavior,
3. show before/after proof,
4. explain root cause,
5. commit cleanly.

That is the path most aligned with the PRD’s scoring model.
