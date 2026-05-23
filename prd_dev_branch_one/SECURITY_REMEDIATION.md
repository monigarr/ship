# Security Remediation Closeout

Date: 2026-05-22  
Branch: `gfa2_wk4_phase2`

## Why this remediation was executed

This remediation was executed to align the branch with both:

1. The repository's legacy security controls in `SECURITY.md` (fail-closed scanning, CI enforcement, current attestation), and
2. Cat8/Phase2 PRD requirements for active security probing, manual review, and verified vulnerability reduction.

The goal was to produce production-ready controls and evidence, not suppression rules or bypasses.

## What was implemented

## 1) CI gates first (required security enforcement)

- Added GitHub Actions workflows:
  - `.github/workflows/secrets-scan.yml`
  - `.github/workflows/attestation-check.yml`
  - `.github/workflows/dependency-audit.yml`
- Added CI validators:
  - `scripts/ci/validate-attestation.mjs`
  - `scripts/ci/check-prod-audit.mjs`
- Wired reproducible local scripts in `package.json`:
  - `security:ci:attestation`
  - `security:ci:dependencies`
- Updated policy text in `SECURITY.md` to document attestation freshness rule enforced in CI.

## 2) Cat8 probe expansion (auth/session, websocket, input, dependency mapping)

- Expanded `api/src/scripts/security-probe.ts` with:
  - multi-route unauthenticated access matrix,
  - session token format/uniqueness checks,
  - session fixation and replay behavior checks,
  - expiry metadata coherence checks,
  - broader reflected/stored input probing coverage,
  - dependency advisory -> feature-impact evidence.
- Added input target inventory:
  - `api/src/scripts/security-probe-targets.ts`
- Added regression/unit tests:
  - `api/src/scripts/security-probe.test.ts`
- Tightened permissive assertions in:
  - `e2e/security.spec.ts`
- Updated operator documentation:
  - `docs/security-probe-tooling.md`

## 3) Dependency burn-down (high/critical first)

- Upgraded/realigned dependencies in:
  - `api/package.json`
  - `web/package.json`
  - `pnpm-lock.yaml`
- Reduced production advisory exposure by moving MCP SDK to API devDependencies (developer/operator path, not production runtime path).
- Captured package-to-feature mapping:
  - `PRD_CAT8/dependency-feature-impact.md`
- Enforced production guardrail:
  - `pnpm security:ci:dependencies`
  - `.github/workflows/dependency-audit.yml`

## Evidence regenerated

- `PHASE_2_PRD_BUNDLE/evidence/type-check-security-remediation.log`
- `PHASE_2_PRD_BUNDLE/evidence/test-security-remediation.log`
- `PRD_CAT8/security-probe-remediation.log`
- `PRD_CAT8/security-probe-report.json`
- `PRD_CAT8/security-probe-report.md`
- `PRD_CAT8/pnpm-audit-prod-post-upgrade.json`
- `PRD_CAT8/pnpm-audit-prod-remediated.json`
- `PRD_CAT8/dependency-audit-remediation.log`

## Final security outcome

- Production dependency audit state: `high=0`, `critical=0` (see `pnpm-audit-prod-remediated.json`).
- Probe remains single-command runnable (`pnpm security:probe`) and writes structured JSON + Markdown output.
- CI now contains explicit, fail-closed security checks required for merge readiness.

## Compliance docs updated

- `MASTER_PRD_COMPLIANCE_MATRIX.md`
- `STRICT_REQUIREMENT_CHECKLIST.md`
- `FINAL_COMPLIANCE_STATUS.md`
- `PRD_CAT8/manual-review-closeout.md`
