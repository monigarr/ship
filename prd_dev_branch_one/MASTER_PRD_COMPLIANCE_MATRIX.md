# Master PRD Compliance Matrix

This matrix tracks strict requirement-to-evidence traceability for:

- `PHASE_2_PRD_BUNDLE/PRD.md` (Categories 1-7 + implementation/submission rules)
- `PRD_CAT8/PRD.md` (Category 8 security requirements)

Status legend: `Met` | `Partial` | `Missing` | `Pending Regeneration`

## Core Categories (Phase 2 PRD)

| Requirement ID | Requirement | Status | Implementation Evidence | Proof Artifact(s) | Reproduction Command(s) | Regression Test(s) |
| --- | --- | --- | --- | --- | --- | --- |
| C1 | Category 1 Type Safety baseline + measurable improvement | Met | `api/src/**`, `web/src/**`, `shared/src/**` | `PHASE_1_PRD_BUNDLE/PHASE_1_AUDIT_REPORT.md`, `PHASE_2_PRD_BUNDLE/evidence/c1-measurement.md`, `PHASE_2_PRD_BUNDLE/evidence/type-check-remediation.log`, `PHASE_2_PRD_BUNDLE/evidence/open-set-remediation-closeout.md` | `pnpm type-check`, `pnpm audit:c1` | `pnpm test`, `pnpm test:e2e` |
| C2 | Category 2 Bundle Size baseline + measurable improvement | Met | `web/vite.config.ts`, lazy-loaded page/components in `web/src/**` | `PHASE_1_PRD_BUNDLE/PHASE_1_AUDIT_REPORT.md`, `PHASE_2_PRD_BUNDLE/evidence/build-closeout.log`, `PHASE_2_PRD_BUNDLE/evidence/c2-after-summary.md` | `pnpm --filter @ship/web exec tsc` + `pnpm --filter @ship/web exec vite build` | `pnpm test`, targeted web tests |
| C3 | Category 3 API latency baseline + measurable improvement | Met | API route/query changes in `api/src/routes/**`, `api/src/db/**`, `api/src/app.ts` | `PHASE_1_PRD_BUNDLE/PHASE_1_AUDIT_REPORT.md`, `PHASE_2_PRD_BUNDLE/evidence/c3-remediation-summary.md`, `PHASE_2_PRD_BUNDLE/evidence/c3-remed-*-c25.json`, `PHASE_2_PRD_BUNDLE/evidence/open-set-remediation-closeout.md` | autocannon benchmark loop at c25 with authenticated session | API route tests + E2E flows |
| C4 | Category 4 DB query efficiency baseline + measurable improvement | Met | `api/src/app.ts`, `api/src/db/**`, route query refactors | `PHASE_1_PRD_BUNDLE/PHASE_1_AUDIT_REPORT.md`, `PHASE_2_PRD_BUNDLE/evidence/c4-query-count-remediation.log`, `PHASE_2_PRD_BUNDLE/evidence/open-set-remediation-closeout.md` | metrics-enabled flow replay with query counter | API tests for affected routes |
| C5 | Category 5 test coverage/quality baseline + improvements | Met | `e2e/**`, `api/src/**/*.test.ts`, `web/src/**/*.test.tsx` | `PHASE_1_PRD_BUNDLE/PHASE_1_AUDIT_REPORT.md`, `PHASE_2_PRD_BUNDLE/evidence/api-test-after.log`, `PHASE_2_PRD_BUNDLE/evidence/test-coverage-after.log` | `pnpm test`, `pnpm test:e2e`, `pnpm test:coverage` | full test suites |
| C6 | Category 6 runtime error/edge-case handling improvements | Met | `api/src/app.ts`, `api/src/collaboration/index.ts`, UI runtime handlers | `PHASE_1_PRD_BUNDLE/PHASE_1_AUDIT_REPORT.md`, `PHASE_2_PRD_BUNDLE/evidence/c6-runtime-remediation.log`, `PRD_CAT8/security-probe-closeout-4.md`, `PRD_CAT8/error-leakage-check.log`, `PHASE_2_PRD_BUNDLE/evidence/open-set-remediation-closeout.md` | targeted repro scripts + malformed-input replay + probe rerun | `e2e/error-handling.spec.ts`, collaboration tests |
| C7 | Category 7 accessibility compliance improvements | Met | `web/src/**`, accessibility-oriented E2E specs | `PHASE_2_PRD_BUNDLE/evidence/c7-axe-remediation.md`, `PHASE_2_PRD_BUNDLE/evidence/c7-axe-remediation.json`, `PHASE_2_PRD_BUNDLE/evidence/open-set-remediation-closeout.md` | deterministic axe-core scan on top-3 pages | accessibility E2E suite |

## Category 8 Security (Cat8 PRD)

| Requirement ID | Requirement | Status | Implementation Evidence | Proof Artifact(s) | Reproduction Command(s) | Regression Test(s) |
| --- | --- | --- | --- | --- | --- | --- |
| C8-T1 | Runnable security probe tool (single command) | Met | `api/src/scripts/security-probe.ts`, `api/src/scripts/security-probe-targets.ts`, root/api package scripts | `PRD_CAT8/security-probe-remediation.log` | `pnpm security:probe` | `api/src/scripts/security-probe.test.ts`, `e2e/security.spec.ts` |
| C8-T2 | Probe covers auth/session surface | Met | `api/src/scripts/security-probe.ts` auth/session probe functions | `PRD_CAT8/security-probe-report.json`, `PRD_CAT8/security-probe-report.md` | `pnpm security:probe` | auth + security tests |
| C8-T3 | Probe covers websocket validation surface | Met | `api/src/scripts/security-probe.ts` websocket probes | `PRD_CAT8/security-probe-report.json`, `PRD_CAT8/security-probe-report.md` | `pnpm security:probe` | websocket/collab tests |
| C8-T4 | Probe covers input sanitization surface | Met | `api/src/scripts/security-probe.ts`, `api/src/scripts/security-probe-targets.ts` | `PRD_CAT8/security-probe-report.json`, `PRD_CAT8/security-probe-report.md` | `pnpm security:probe` | route tests + security E2E |
| C8-T5 | Probe covers dependency CVEs via audit parsing | Met | `api/src/scripts/security-probe.ts` dependency audit + feature impact mapping | `PRD_CAT8/pnpm-audit-prod-remediated.json`, `PRD_CAT8/dependency-feature-impact.md` | `pnpm security:probe`, `pnpm audit --prod --json` | `pnpm security:ci:dependencies` |
| C8-R1 | Structured report JSON/MD with severity + repro steps | Met | `api/src/scripts/security-probe.ts` report writers | `PRD_CAT8/security-probe-report.json`, `PRD_CAT8/security-probe-report.md` | `pnpm security:probe` | n/a |
| C8-M1 | Manual review: CORS/CSP | Met | `api/src/app.ts` (`helmet` CSP + CORS config) | `PRD_CAT8/manual-review-closeout.md`, `PRD_CAT8/cors-csp-headers.log`, `PRD_CAT8/cors-origin-check.log` | manual curl + browser policy checks | security tests |
| C8-M2 | Manual review: secret exposure | Met | env/config handling in `api/src/config/**` and process env usage | `PRD_CAT8/manual-review-closeout.md` | secret scan + bundle inspection | secrets scan checks |
| C8-M3 | Manual review: rate limiting | Met | `api/src/app.ts` (`loginLimiter`, `apiLimiter`), `api/src/collaboration/index.ts` | `PRD_CAT8/manual-review-closeout.md`, `PRD_CAT8/security-probe-closeout-4.md` | request burst tests | security + API tests |
| C8-M4 | Manual review: verbose error leakage | Met | `api/src/app.ts` global error handler + route-level error responses | `PRD_CAT8/manual-review-closeout.md`, `PRD_CAT8/error-leakage-check.log` | malformed input probes | error-handling tests |
| C8-FIX | Fix >=2 verified vulnerabilities with before/after proof | Met | `api/src/app.ts`, `api/src/collaboration/index.ts`, `api/src/scripts/security-probe.ts`, `.github/workflows/*.yml`, `scripts/ci/*.mjs`, `api/package.json`, `web/package.json` | `PRD_CAT8/pnpm-audit-prod-post-upgrade.json`, `PRD_CAT8/pnpm-audit-prod-remediated.json`, `PRD_CAT8/dependency-feature-impact.md`, `PRD_CAT8/security-probe-remediation.log`, `PHASE_2_PRD_BUNDLE/evidence/type-check-security-remediation.log`, `PHASE_2_PRD_BUNDLE/evidence/test-security-remediation.log` | `pnpm security:ci:dependencies`, `pnpm audit --prod --json`, `pnpm security:probe` | `pnpm type-check`, `pnpm test` |

## Implementation Rules and Submission Requirements

| Requirement ID | Requirement | Status | Evidence |
| --- | --- | --- | --- |
| IR-1 | Before/after proof for every improvement | Met | `PHASE_2_PRD_BUNDLE/evidence/open-set-remediation-closeout.md`, `PHASE_2_PRD_BUNDLE/IMPROVEMENT_DOCUMENTATION.md`, `IMPLEMENTATION_RULES_CLOSEOUT.md` |
| IR-2 | Existing tests pass after changes | Met | `PHASE_2_PRD_BUNDLE/evidence/final-gate-summary.md`, `PHASE_2_PRD_BUNDLE/evidence/type-check-security-remediation.log`, `PHASE_2_PRD_BUNDLE/evidence/test-security-remediation.log`, `PRD_CAT8/dependency-audit-remediation.log` |
| IR-3 | Reasoning documented per improvement | Met | `PHASE_2_PRD_BUNDLE/IMPROVEMENT_DOCUMENTATION.md`, `IMPLEMENTATION_RULES_CLOSEOUT.md`, `REVIEWER_CLOSEOUT_REPORT.md` |
| IR-4 | No cosmetic-only changes counted | Met | `IMPLEMENTATION_RULES_CLOSEOUT.md`, `PHASE_2_PRD_BUNDLE/evidence/open-set-remediation-closeout.md` |
| IR-5 | Commit discipline and logical separation | Met | `IMPLEMENTATION_RULES_CLOSEOUT.md`, `REPO_FORK_BRANCH_EVIDENCE.md` |
| D-1 | Discovery requirement with file path + line range + reflection | Met | `DISCOVERY_WRITEUP.md` |
| SR-1 | Audit report baseline completeness | Met | `PHASE_1_PRD_BUNDLE/PHASE_1_AUDIT_REPORT.md` |
| SR-2 | Improvement documentation for all categories | Met | `PHASE_2_PRD_BUNDLE/IMPROVEMENT_DOCUMENTATION.md` |
| SR-3 | Discovery write-up (3 discoveries) | Met | `DISCOVERY_WRITEUP.md` |
| SR-4 | Demo/presentation artifacts | Partial | `DEMO_VIDEO_PACKAGE.md`, `EXTERNAL_INPUT_NEEDED.md` (final recording URL/file pending) |
| SR-5 | AI cost analysis + deployment evidence | Partial | `AI_COST_ANALYSIS.md`, `DEPLOYMENT_EVIDENCE.md`, `SOCIAL_POST_EVIDENCE.md`, `EXTERNAL_INPUT_NEEDED.md` (public deploy URL + published social link pending) |
| SR-6 | Forked repo with clear branches and setup guide | Met | `README.md`, `REPO_FORK_BRANCH_EVIDENCE.md` |

## Consolidation Notes

- This file is intentionally updated throughout consolidation as statuses progress.
- Final acceptance requires all `Missing` and `Pending Regeneration` items to be resolved or explicitly justified as non-blocking.
