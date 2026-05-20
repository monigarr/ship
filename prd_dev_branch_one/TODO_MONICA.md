# Playwright Test Execution Optimization Notes

This document summarizes observed E2E runtime bottlenecks and a practical execution strategy for faster, reproducible feedback in this repository.

```ts
// ship/playwright.config.ts
// ...
workers: calculatedWorkers,
// ...
globalSetup: './e2e/global-setup.ts',
```

```ts
// ship/e2e/fixtures/isolated-env.ts
// PostgreSQL container - one per worker, starts fresh for each test run
// ...
container = await new PostgreSqlContainer('postgres:15')
  .withDatabase('ship_test')
  .withUsername('test')
  .withPassword('test')
  .withStartupTimeout(120000)
  .start();
// ...
await runMigrations(dbUrl);
```

```ts
// ship/e2e/program-mode-week-ux.spec.ts
// Before EVERY test, clean up any sprints > 10 to ensure empty windows exist
test.beforeEach(async ({ request }) => {
  await cleanupExtraSprints(request)
})
```

```ts
// ship/e2e/performance.spec.ts
test.describe('Performance - Page Load', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
  })
// ...
```

## Highest-Impact Improvements (Prioritized)

- Cap workers to a stable fixed range (start with `4-6`) rather than auto-scaling to full CPU.
- Move heavyweight suites (`performance`, long serial UX suites) out of default PR validation into nightly execution.
- Replace `waitForTimeout` usage with event/assertion-driven waits to eliminate avoidable idle time.
- Remove per-test cleanup loops in large serial specs; prefer one `beforeAll` reset or API/DB snapshot restore.
- Avoid full rebuilds on every run when sources are unchanged (`api/dist` + `web/dist` cache in global setup).
- Use a non-isolated/shared fixture for local development loops; `dev-server` fixture exists and can be used.

## Why the Gains Are Significant

- Current setup creates DB container + migrations + seed per worker, so high worker counts can increase total runtime due to Docker/IO contention.
- `program-mode-week-ux` has 66 serial tests with cleanup in `beforeEach`, which multiplies runtime.
- `performance.spec.ts` contains explicit sleeps and long timeouts; this suite is better suited to a dedicated lane than default PR runs.

## Recommended Test Lanes

- **PR lane (fast):** smoke + critical flows, 4 workers, no perf/long-running suites.
- **Full lane (merge gate):** broader functional tests with capped workers.
- **Nightly lane:** performance, heavy image/editor stress, and long serial flows.

## Fast Tri-Run Protocol for PRD Evidence

Use this protocol when you need reliable tri-run evidence without full-day execution overhead.

- Run with capped workers and deterministic resources: `PLAYWRIGHT_WORKERS=1` or `2` (do not autoscale for this repo).
- Preflight once before the 3 runs:
  - Confirm Docker engine is healthy.
  - Stop stale containers from prior failed runs.
  - Make sure disk has headroom for traces/screenshots.
- Disable expensive artifacts for non-debug runs:
  - `trace: 'off'` by default for tri-run audits.
  - Turn `video` off unless reproducing a specific failure.
  - Keep screenshots only on failure.
- Timebox each full run (for example, 90 minutes max). If timed out, mark run as infra-failed and continue the protocol.
- Capture each run to its own log file (`tri-run-playwright-run1.log`, `tri-run-playwright-run2.log`, `tri-run-playwright-run3.log`) and parse summary lines only (`passed/failed/flaky/did not run`).
- Split heavy suites out of tri-run baseline (run separately):
  - `performance.spec.ts`
  - long serial "program mode" flows
  - stress/image-heavy suites
- For PRD reporting, use this evidence structure:
  - Run A/B/C command, runtime, pass/fail/flaky counts
  - repeated failing test IDs across runs
  - infra failures (for example `dbContainer` timeout) called out explicitly

### Copy/Paste Command Pattern

```powershell
$env:PLAYWRIGHT_WORKERS=1
foreach($i in 1..3){
  cmd /c "pnpm test:e2e > tri-run-playwright-run$i.log 2>&1"
}
```

Then summarize each log with ripgrep:

```powershell
rg "failed|flaky|did not run|passed \(" tri-run-playwright-run1.log
rg "failed|flaky|did not run|passed \(" tri-run-playwright-run2.log
rg "failed|flaky|did not run|passed \(" tri-run-playwright-run3.log
```

## Fast Local Development Loop

Use this loop during active coding when you need feedback in minutes, not full-suite confidence.

- Keep local loop to targeted files or tagged flows first; only run full suite when preparing PRD evidence.
- Run one browser project only (`chromium`) during local iteration.
- Start with 1 worker for stability, then increase to 2 if your machine is stable.
- Use focused grep filters for the bug/feature area before broadening scope.

### Copy/Paste Local Loop Commands

```powershell
# 1) Fast targeted run (single file)
$env:PLAYWRIGHT_WORKERS=1
pnpm test:e2e -- e2e/accessibility.spec.ts --project=chromium

# 2) Fast targeted run (grep by feature label/text)
pnpm test:e2e -- --project=chromium --grep "PRD Category 7|Backlinks|TOC"

# 3) Run only last failures while iterating
pnpm test:e2e -- --project=chromium --last-failed
```

### Suggested Promotion Path (Quick to Thorough)

1. Targeted file or grep run passes twice.
2. Related feature cluster passes (`--grep` broadening).
3. Full suite single pass.
4. Full tri-run protocol only for final PRD/report evidence.
