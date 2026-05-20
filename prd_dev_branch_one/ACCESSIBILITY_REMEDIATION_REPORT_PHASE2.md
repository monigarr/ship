# Accessibility Remediation Report (PRD Category 7)

Date: 2026-05-19  
Scope: PRD Category 7 (Accessibility Compliance)  
Repository context: local branch evidence aligned to Phase 1 findings

## Objective

Close documented Category 7 gaps and provide reproducible evidence for:
- automated accessibility scanning,
- keyboard navigation completeness,
- color-contrast compliance,
- explicit screen-reader verification workflow.

## Baseline Context (from Phase 1 Audit)

Source: `prd_dev_branch_one/PHASE_1_AUDIT_REPORT.md`

- Lighthouse accessibility (auth parity): `/my-week` 96, `/issues` 100, `/projects` 100, `/docs` 100.
- axe Critical/Serious: 2 serious, 0 critical.
- Keyboard completeness: Partial.
- Known contrast findings:
  - `/my-week` selector equivalent to `bg-accent/20 py-0.5 px-1.5`.
  - `/projects` filter-chip selector equivalent to `bg-muted/30 ml-1 px-1.5`.
- Manual screen-reader evidence: not captured at initial baseline time.

## Remediation Changes Implemented

### Contrast fixes

- `web/src/pages/MyWeekPage.tsx`
  - Updated current-week badge from low-contrast accent tint treatment to solid accent background with white text.
- `web/src/components/FilterTabs.tsx`
  - Updated inactive count-chip styling from muted-on-muted to border-backed foreground text.

### Keyboard-only operability and focus behavior

- `web/src/pages/App.tsx`
  - Added explicit `aria-label` values to icon-only workspace switcher and logout controls.
  - Updated hover-revealed action buttons in issue/project/program sidebars to also reveal on keyboard focus (`focus` and `focus-visible` opacity states).

### Accessibility test hardening

- `e2e/accessibility.spec.ts`
  - Added PRD major-page gate tests for authenticated `/my-week`, `/issues`, `/projects`, `/docs`:
    - zero critical/serious axe violations,
    - zero color-contrast violations.
  - Hardened login helper for both setup-first and normal sign-in flows.
- `e2e/accessibility-remediation.spec.ts`
  - Expanded automated WCAG AA full-scan coverage to include `/my-week` and `/projects`.

### Cross-platform test execution support used for evidence runs

- `api/package.json` build script updated to Node-based copy commands (Windows-safe).
- `web/package.json` build script updated to Windows-safe build invocation.
- `e2e/fixtures/isolated-env.ts` preview-server spawn updated to shell command invocation compatible with Windows workers.

## Verification Evidence (Post-Remediation)

### Commands executed

1. `pnpm --filter @ship/web type-check`  
   - Result: pass.

2. `PLAYWRIGHT_WORKERS=1 pnpm test:e2e -- e2e/accessibility.spec.ts --project=chromium --grep "PRD Category 7"`  
   - Result: pass (`2 passed`).
   - Confirms strict PRD major-page gate tests.

3. `PLAYWRIGHT_WORKERS=1 pnpm test:e2e -- e2e/accessibility-remediation.spec.ts --project=chromium --grep "Automated axe-core Full Scan"`  
   - Result: pass (`5 passed`).
   - Confirms WCAG full-scan coverage for login/docs/issues/my-week/projects.

### PRD metric status after remediation

- Lighthouse accessibility score per page: unchanged in this verification run (no new Lighthouse JSON captured during this pass).
- Total critical/serious violations (major pages): 0 in executed PRD gate scan subset.
- Keyboard navigation completeness: improved in code and test coverage; automated assertions pass in targeted suites.
- Color-contrast failures: none detected in executed major-page PRD gate tests.
- Missing ARIA labels/roles: no critical/serious ARIA blockers observed in executed scans.

## Screen Reader Evidence

### Execution status

- Automated proxy checks are present (aria-live/status/labels and keyboard interaction tests).
- Manual NVDA walkthrough was executed by a human operator and recorded below.
- This closes the earlier evidence gap for manual verification capture.

### Reproducible manual protocol (final human validation)

Use NVDA (Windows) and run these routes in order:
1. `/login`
2. `/my-week`
3. `/issues`
4. `/projects`
5. `/docs`

For each route, validate:
- Landmarks are announced logically (`nav`, `main`, complementary sidebars).
- Page heading and major section headings are announced in hierarchy.
- Interactive controls are reachable via keyboard-only navigation.
- Hover-revealed controls are reachable and operable on focus.
- Status/alert/live-region updates are announced (sync status, errors, confirmations).
- No control is color-only without accessible name/semantic cue.

### Manual NVDA evidence table

| Route | Landmarks Announced | Controls Operable | Status Announcements | Notes |
|---|---|---|---|---|
| /login | Fail | Fail | Fail | Route failed overall. |
| /my-week | Partial | Partial | Partial | Usable but incomplete coverage/announcements. |
| /issues | Partial | Partial | Partial | Usable but incomplete coverage/announcements. |
| /projects | Partial | Partial | Partial | Usable but incomplete coverage/announcements. |
| /docs | Partial | Partial | Partial | Usable but incomplete coverage/announcements. |

All route outcomes above come from the same NVDA manual run on 2026-05-19.

## Conclusion

This remediation pass closes previously identified automated PRD Category 7 gaps (contrast, major-page axe gates, keyboard/focus regressions), strengthens enforcement tests, and includes explicit manual NVDA evidence capture.  
Manual findings still indicate route-level quality gaps (`/login` failed; other audited routes partial), so follow-on accessibility hardening remains recommended.
