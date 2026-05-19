# 6. Testing Infrastructure

### 6.0 Area overview

- Status: [X] Complete
- Prompt: Testing infrastructure deep-dive summary for sections 6.1-6.3.
- Findings:
  - The repository has two major test lanes:
    - API/unit/integration tests via Vitest (`pnpm test` -> `@ship/api`).
    - E2E tests via Playwright with per-worker isolated environments.
  - Playwright configuration is resource-aware and optimized to avoid historical memory blowups.
- Evidence (top-level test configuration):
  - `d:\GFA_Cohort_5\Week_Four\ship\package.json`
  - `d:\GFA_Cohort_5\Week_Four\ship\playwright.config.ts`
  - `d:\GFA_Cohort_5\Week_Four\ship\e2e\global-setup.ts`
- Open Questions:
  - Should CI enforce a full matrix that always runs both API and E2E suites on every PR?
- Next Actions:
  - Define a canonical “full test suite” command that chains API + E2E with environment checks.

### 6.1 Playwright structure and fixtures

- Status: [X] Complete
- Prompt: How are the Playwright tests structured? What fixtures are used?
- Findings:
  - Test suite is organized under `e2e/` with broad functional coverage (auth, issues, docs, accessibility, performance, accountability, etc.).
  - Main Playwright config:
    - `testDir: ./e2e`, parallel workers, retries, HTML + line/progress reporters, and global setup.
  - Fixture model:
    - `isolated-env.ts`: primary fixture using per-worker Postgres container + API server + Vite preview server.
    - `dev-server.ts`: lightweight fixture for reuse of pre-running local servers (faster local iteration, less isolation).
    - `test-helpers.ts`: helper utilities for flaky-resistant UI interaction patterns.
  - Separate `playwright.isolated.config.ts` exists for isolated fixture spike testing.
- Evidence (test directories, fixture files):
  - `d:\GFA_Cohort_5\Week_Four\ship\e2e\`
  - `d:\GFA_Cohort_5\Week_Four\ship\playwright.config.ts`
  - `d:\GFA_Cohort_5\Week_Four\ship\playwright.isolated.config.ts`
  - `d:\GFA_Cohort_5\Week_Four\ship\e2e\fixtures\isolated-env.ts`
  - `d:\GFA_Cohort_5\Week_Four\ship\e2e\fixtures\dev-server.ts`
  - `d:\GFA_Cohort_5\Week_Four\ship\e2e\fixtures\test-helpers.ts`
- Open Questions:
  - Should `dev-server` fixture use be restricted to local developer workflow only (and blocked in CI) to avoid accidental non-isolated runs?
- Next Actions:
  - Add a short testing-mode decision table in docs: when to use isolated vs dev-server fixture.

### 6.2 Test database setup/teardown

- Status: [X] Complete
- Prompt: How does the test database get set up and torn down?
- Findings:
  - For Playwright isolated mode, each worker starts its own `postgres:15` Testcontainers instance.
  - Setup flow per worker:
    - Apply `schema.sql`.
    - Create/mark migration tracking state.
    - Seed deterministic test data (workspace/users/programs/sprints/issues/wiki docs and associations).
    - Start worker-local API and web preview servers on worker-scoped dynamic ports.
  - Teardown flow:
    - Worker fixtures stop API/web processes and stop container in `finally` blocks.
  - Global setup builds API and web once before workers launch to reduce per-worker startup overhead.
- Evidence (scripts, lifecycle hooks, seed/reset flow):
  - `d:\GFA_Cohort_5\Week_Four\ship\e2e\global-setup.ts`
  - `d:\GFA_Cohort_5\Week_Four\ship\e2e\fixtures\isolated-env.ts`
  - `d:\GFA_Cohort_5\Week_Four\ship\api\src\db\schema.sql`
  - `d:\GFA_Cohort_5\Week_Four\ship\api\src\db\migrations\`
- Open Questions:
  - Should migration SQL be executed directly in isolated tests (instead of migration bookkeeping shortcuts) for stricter fidelity?
- Next Actions:
  - Add a “DB fidelity mode” test lane that runs full migration scripts end-to-end.

### 6.3 Full suite runtime and pass state

- Status: [X] Complete
- Prompt: Run the full test suite. How long does it take? Do all tests pass?
- Findings:
  - Executed command: `pnpm test` at repository root.
  - Command target in current scripts: `pnpm --filter @ship/api test` (Vitest API suite).
  - Result: pass.
    - Test files: `28 passed`
    - Tests: `451 passed`
    - Vitest duration: `127.05s`
    - Total command elapsed: ~`190.2s` (includes shell/tool overhead)
  - No failures observed; stderr lines shown in output were expected error-path test logs, and suite still passed with exit code `0`.
- Evidence (exact command, runtime, pass/fail summary):
  - Command: `pnpm test`
  - Output file: `C:\Users\monig\.cursor\projects\d-GFA-Cohort-5-Week-Four\terminals\417222.txt`
  - Related scripts:
    - `d:\GFA_Cohort_5\Week_Four\ship\package.json`
    - `d:\GFA_Cohort_5\Week_Four\ship\api\package.json`
- Open Questions:
  - Should “full suite” in orientation explicitly include `pnpm test:e2e` in addition to `pnpm test`?
- Next Actions:
  - Run and record `pnpm test:e2e` timing/pass baseline to complete a full API+E2E runtime profile.
