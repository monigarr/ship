# Phase 2 Evidence Regeneration Summary

Generated: 2026-05-21

## Commands Executed

- `pnpm type-check` -> `type-check-after.log`
- `pnpm test` -> `api-test-after.log`
- `pnpm test:coverage` -> `test-coverage-after.log`
- `pnpm --filter @ship/web exec tsc` + `pnpm --filter @ship/web exec vite build` -> `web-build-after.log`
- Custom Node metric script -> `type-safety-after.json`

## Type Safety (Category 1)

Baseline values (Phase 1 report):

- `any`: 346
- `as`: 1490
- non-null assertions: 326
- `@ts-ignore/@ts-expect-error`: 1

Current values (`type-safety-after.json`):

- `any`: 346
- `as`: 1546
- non-null assertions: 323
- `@ts-ignore/@ts-expect-error`: 1

Assessment:

- Type-safety target is **not yet met** based on current counts.

## Bundle Size (Category 2)

Current run status:

- Web production build now passes (`web-build-after.log`).
- Cross-platform script fixes were required to unblock reproducible Windows runs:
  - `web/package.json` build command normalized to `tsc && vite build`
  - `api/package.json` build command replaced shell `cp` with Node `fs.cpSync(...)`
  - `web/vite.config.ts` TipTap manual chunk list updated to subpath imports (`@tiptap/pm/state`, `model`, `view`)

Assessment:

- Build gate is green, but explicit before/after bundle-size delta evidence still needs to be computed and documented.

## API Response + DB Efficiency (Categories 3-4)

Current run status:

- No new load-test or EXPLAIN output was regenerated in this pass.

Assessment:

- Requires dedicated benchmark rerun once local runtime stack is fully available.

## Test Coverage + Reliability (Category 5)

Current run status:

- Docker/Postgres brought up successfully; DB migrations and seed rerun in closeout.
- `pnpm test` now passes (`api-test-after.log`) with `28` test files and `451` tests passing.
- `pnpm test:coverage` now passes (`test-coverage-after.log`) with API (`28` files / `451` tests) and Web (`16` files / `151` tests) passing.

Assessment:

- DB-backed strict blocker is closed in this pass.

## Runtime/Error Handling + Accessibility (Categories 6-7)

Current run status:

- No new runtime edge-case replay package or accessibility rerun package was produced in this pass.
- Existing Lighthouse artifacts under `prd_dev_branch_one/` remain available as prior evidence.

Assessment:

- Needs a full post-merge rerun bundle to mark as fully regenerated.

## Overall

- Fresh evidence artifacts were generated and captured.
- Remaining non-closed areas are category-specific proof depth (not environment bring-up):
  - API latency/query benchmark reruns (Categories 3-4),
  - full runtime/accessibility before/after replay package (Categories 6-7),
  - strict vulnerability remediation before/after bundle for Cat8.
