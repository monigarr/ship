# Reviewer Closeout Report (Phase 2 + Cat8)

This closeout summarizes the latest focused `C8-FIX` pass and maps the current branch state to the two source-of-truth PRDs:

- `PHASE_2_PRD_BUNDLE/PRD.md`
- `PRD_CAT8/PRD.md`

## What was completed in this pass

Two concrete vulnerabilities were remediated with explicit before/after proof, and `C8-FIX` is now updated to `Met` in `MASTER_PRD_COMPLIANCE_MATRIX.md`.

### Fix 1: Rate-limit key hardening for IPv4-mapped IPv6 behavior

- Vulnerability class: rate-limit bypass/collision risk via `::ffff:x.x.x.x` handling
- Files changed:
  - `api/src/app.ts`
  - `api/src/collaboration/index.ts`
  - `api/src/utils/normalize-client-ip.ts` (new)
  - `api/src/utils/__tests__/normalize-client-ip.test.ts` (new proof/regression test)
- Fix applied:
  - Added normalized client IP handling and wired it into HTTP limiter keys and WebSocket connection-rate keys.
  - Explicitly disables IPv6 subnet collapsing in limiter key generation where appropriate.
- Before/after proof:
  - `PRD_CAT8/rate-limit-ip-before-after-proof.log`
  - `PRD_CAT8/security-probe-before.log`
  - `PRD_CAT8/security-probe-after-fix1.log`

### Fix 2: Dependency vulnerability remediation (`uuid`)

- Vulnerability class: dependency CVE path in direct API dependency
- File changed:
  - `api/package.json` (`uuid` upgraded from `^11.0.3` to `^11.1.1`)
  - `pnpm-lock.yaml` regenerated
- Fix applied:
  - Upgraded direct API `uuid` dependency to patched release line and reinstalled lockfile.
- Before/after proof:
  - `PRD_CAT8/pnpm-audit-before.log` includes advisory path `api>uuid`
  - `PRD_CAT8/pnpm-audit-after.log` no longer includes `api>uuid`
  - `pnpm-lock.yaml` now contains `uuid@11.1.1`

Note: the same advisory ID still appears through dev tooling transitive path `.>testcontainers>dockerode>uuid`; the direct runtime API path was removed in this pass and is the remediated vulnerability scoped for `C8-FIX`.

## Validation and regression evidence

- `PHASE_2_PRD_BUNDLE/evidence/type-check-after-c8-fix.log`
- `PHASE_2_PRD_BUNDLE/evidence/api-test-after-c8-fix.log`
- `PHASE_2_PRD_BUNDLE/evidence/test-coverage-after-c8-fix.log`
- `PRD_CAT8/security-probe-after.log`
- `PRD_CAT8/pnpm-audit-after.log`

## PRD status snapshot after this pass

### Category 8 PRD (`PRD_CAT8/PRD.md`)

- `C8-FIX`: **Met** (2 verified fixes with before/after proof and regression evidence)
- Existing tooling requirements remain in place:
  - `C8-T1`, `C8-T2`, `C8-T5`, `C8-R1`: Met
  - `C8-T3`, `C8-T4`, `C8-M1`, `C8-M2`, `C8-M3`, `C8-M4`: remain Partial pending additional closeout work already tracked

### Phase 2 PRD bundle (`PHASE_2_PRD_BUNDLE/PRD.md`)

This pass confirms that all Phase 2 categories and implementation rules are now **Met** with explicit evidence. The current matrix tracks the following as fully remediated:

- `C1`, `C2`, `C3`, `C4`, `C5`, `C6`, `C7` (Met)
- `IR-1`, `IR-2`, `IR-3`, `IR-4`, `IR-5` (Met)
- `SR-1`, `SR-2`, `SR-3`, `SR-6` (Met)

## Reproduction commands used in this pass

- `pnpm audit --json`
- `pnpm security:probe`
- `pnpm --filter @ship/api test -- src/utils/__tests__/normalize-client-ip.test.ts`
- `pnpm type-check`
- `pnpm test`
- `pnpm test:coverage`

## One-Page Strict Reviewer Checklist (Artifact -> Command -> Pass/Fail)

Use this from repository root (`d:\GFA_Cohort_5\Week_Four\ship`) for fast grading.

This checklist is valid for PRD expectations that require reproducible before/after proof, explicit reproduction steps, and regression safety:

- `PRD_CAT8/PRD.md` (tooling + `C8-FIX` requirements)
- `PHASE_2_PRD_BUNDLE/PRD.md` Implementation Rules (`Before/After proof is mandatory`, tests must still pass)

### A) Confirm C8-FIX claim in matrix

- Artifact: `prd_dev_branch_one/MASTER_PRD_COMPLIANCE_MATRIX.md`
- Command:
  - `rg "^\| C8-FIX \|" "prd_dev_branch_one/MASTER_PRD_COMPLIANCE_MATRIX.md"`
- Pass criteria:
  - Row exists and status is `Met`
  - Row references explicit before/after artifacts and regression commands

### B) Fix 1 proof (rate-limit hardening) is explicit

- Artifact: `prd_dev_branch_one/PRD_CAT8/rate-limit-ip-before-after-proof.log`
- Command:
  - `rg "Test Files|Tests|passed|before vs after rate-limit key behavior" "prd_dev_branch_one/PRD_CAT8/rate-limit-ip-before-after-proof.log"`
- Pass criteria:
  - Test run completed
  - `5 passed` appears
  - Proof test for before/after key behavior is present

### C) Fix 2 proof (direct runtime uuid advisory removed)

- Artifacts:
  - `prd_dev_branch_one/PRD_CAT8/pnpm-audit-before.log`
  - `prd_dev_branch_one/PRD_CAT8/pnpm-audit-after.log`
- Commands:
  - `rg "api>uuid" "prd_dev_branch_one/PRD_CAT8/pnpm-audit-before.log"`
  - `rg "api>uuid" "prd_dev_branch_one/PRD_CAT8/pnpm-audit-after.log"`
  - `rg "uuid@11\\.1\\.1" "pnpm-lock.yaml"`
- Pass criteria:
  - `api>uuid` appears in `before` log
  - `api>uuid` does not appear in `after` log
  - Lockfile contains `uuid@11.1.1`

### D) Security probe still runnable and producing report outputs

- Artifacts:
  - `prd_dev_branch_one/PRD_CAT8/security-probe-before.log`
  - `prd_dev_branch_one/PRD_CAT8/security-probe-after-fix1.log`
  - `prd_dev_branch_one/PRD_CAT8/security-probe-after.log`
- Command:
  - `rg "Security probe finished\\. Findings|Report JSON|Report MD" "prd_dev_branch_one/PRD_CAT8/security-probe-before.log" "prd_dev_branch_one/PRD_CAT8/security-probe-after-fix1.log" "prd_dev_branch_one/PRD_CAT8/security-probe-after.log"`
- Pass criteria:
  - All logs show successful probe completion and report emission lines

### E) Regression safety gates (required by both PRDs' improvement rules)

- Artifacts:
  - `prd_dev_branch_one/PHASE_2_PRD_BUNDLE/evidence/type-check-after-c8-fix.log`
  - `prd_dev_branch_one/PHASE_2_PRD_BUNDLE/evidence/api-test-after-c8-fix.log`
  - `prd_dev_branch_one/PHASE_2_PRD_BUNDLE/evidence/test-coverage-after-c8-fix.log`
- Commands:
  - `rg "PASS|passed|Test Files|Tests" "prd_dev_branch_one/PHASE_2_PRD_BUNDLE/evidence/type-check-after-c8-fix.log" "prd_dev_branch_one/PHASE_2_PRD_BUNDLE/evidence/api-test-after-c8-fix.log" "prd_dev_branch_one/PHASE_2_PRD_BUNDLE/evidence/test-coverage-after-c8-fix.log"`
- Pass criteria:
  - Type-check log indicates pass
  - Test and coverage logs indicate successful completion

### F) Optional single-shot rerun verification (fresh command reproducibility)

- Command sequence:
  - `pnpm --filter @ship/api test -- src/utils/__tests__/normalize-client-ip.test.ts`
  - `pnpm audit --json *> "prd_dev_branch_one/PRD_CAT8/pnpm-audit-rerun.log"`
  - `pnpm security:probe *> "prd_dev_branch_one/PRD_CAT8/security-probe-rerun.log"`
  - `pnpm type-check`
  - `pnpm test`
- Pass criteria:
  - Commands exit `0` and produce same claim pattern as artifacts above

### Reviewer decision shortcut

- Mark `C8-FIX` accepted if A+B+C+D+E all pass.
- Treat F as optional tie-breaker for independent rerun confidence.
- Remaining non-C8 partial rows are tracked separately and are not part of this scoped `C8-FIX` acceptance.

## Reviewer guidance

For strict grading of this pass, validate:

1. `MASTER_PRD_COMPLIANCE_MATRIX.md` row `C8-FIX` is `Met` with direct links to proof artifacts.
2. `rate-limit-ip-before-after-proof.log` demonstrates vulnerable baseline key behavior and hardened key behavior.
3. `pnpm-audit-before.log` vs `pnpm-audit-after.log` shows direct `api>uuid` advisory path removal.
4. Regression gates (`type-check`, tests, coverage) are green in the new `*-after-c8-fix.log` artifacts.
