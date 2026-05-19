# 8. Architecture Assessment

### 8.0 Assessment overview

- Status: [X] Complete
- Prompt: Synthesis summary for sections 8.1-8.4.
- Findings:
  - The architecture is intentionally pragmatic: unified document model, shared TypeScript contracts, and integrated realtime collaboration.
  - Most risks now are less about missing capability and more about operational consistency (policy drift, route/middleware consistency, docs/runtime drift).
- Evidence (cross-phase references):
  - `d:\GFA_Cohort_5\Week_Four\prd_dev_branch_one\SUMMARIES\ARCHITECTURE_SUMMARY.md`
  - `d:\GFA_Cohort_5\Week_Four\prd_dev_branch_one\SUMMARIES\REQUEST_FLOW_SUMMARY.md`
  - `d:\GFA_Cohort_5\Week_Four\prd_dev_branch_one\SUMMARIES\REAL_TIME_COLLAB_SUMMARY.md`
  - `d:\GFA_Cohort_5\Week_Four\prd_dev_branch_one\SUMMARIES\TYPESCRIPT_PATTERNS_SUMMARY.md`
- Open Questions:
  - Which architectural decisions are considered immutable vs negotiable over the next 1-2 quarters?
- Next Actions:
  - Publish a short “architecture invariants” note for contributors.

### 8.1 Strongest architectural decisions

- Status: [X] Complete
- Prompt: What are the 3 strongest architectural decisions in this codebase? Why?
- Findings:
  - Strong decision 1: Unified document model (`documents` + `document_type` + flexible properties).
    - Why strong: enables consistent behavior across wiki/issues/projects/weeks and reduces schema sprawl.
  - Strong decision 2: Shared contract package (`@ship/shared`) across API and web.
    - Why strong: lowers cross-layer drift risk and centralizes core enums/constants/contracts.
  - Strong decision 3: Yjs-based collaborative editor with offline-first local cache.
    - Why strong: supports low-latency concurrent editing with deterministic merge and resilience during transient connectivity loss.
- Evidence (decision -> impact mapping):
  - `d:\GFA_Cohort_5\Week_Four\ship\docs\unified-document-model.md`
  - `d:\GFA_Cohort_5\Week_Four\ship\shared\src\types\document.ts`
  - `d:\GFA_Cohort_5\Week_Four\ship\web\src\components\Editor.tsx`
  - `d:\GFA_Cohort_5\Week_Four\ship\api\src\collaboration\index.ts`
- Open Questions:
  - Can the unified model remain performant under significantly larger data volumes without additional indexing/caching layers?
- Next Actions:
  - Add periodic performance budget checks for high-cardinality document queries.

### 8.2 Weakest points and improvement focus

- Status: [X] Complete
- Prompt: What are the 3 weakest points? Where would you focus improvement?
- Findings:
  - Weak point 1: Middleware and route-policy consistency is distributed and easy to drift.
    - Improvement focus: central route-policy inventory + tests asserting CSRF/auth expectations.
  - Weak point 2: Collaboration server complexity is concentrated in one large module.
    - Improvement focus: refactor into bounded components (upgrade/auth, protocol handling, persistence, events).
  - Weak point 3: CI/CD discoverability in-repo is weak (pipeline config not visible locally).
    - Improvement focus: document canonical CI location/stages and map them to local scripts.
- Evidence (risk/impact rationale):
  - `d:\GFA_Cohort_5\Week_Four\ship\api\src\app.ts`
  - `d:\GFA_Cohort_5\Week_Four\ship\api\src\collaboration\index.ts`
  - `d:\GFA_Cohort_5\Week_Four\ship\package.json`
  - `d:\GFA_Cohort_5\Week_Four\ship\CONTRIBUTING.md`
- Open Questions:
  - What level of route policy automation is acceptable without over-constraining feature work?
- Next Actions:
  - Start with lightweight policy tests and expand only where drift has historically occurred.

### 8.3 New engineer onboarding guidance

- Status: [X] Complete
- Prompt: If you had to onboard a new engineer to this codebase, what would you tell them first?
- Findings:
  - Recommended first mental model:
    - “Everything is a document” (data model),
    - “shared contracts are source-of-truth” (types/constants),
    - “editor state is CRDT-driven, server-persisted” (collaboration path).
  - Recommended onboarding sequence:
    1) `README.md` + `docs/application-architecture.md`,
    2) `shared/src/types/document.ts`,
    3) request path (`web` hook -> `api` route -> DB query),
    4) collaboration path (`Editor.tsx` + `api/collaboration/index.ts`),
    5) run tests (`pnpm test`) and inspect Playwright fixture strategy.
  - Practical caveat for newcomers:
    - Distinguish editor realtime flows from non-editor REST flows; they have different consistency and failure patterns.
- Evidence (onboarding sequence and key files):
  - `d:\GFA_Cohort_5\Week_Four\ship\README.md`
  - `d:\GFA_Cohort_5\Week_Four\ship\docs\application-architecture.md`
  - `d:\GFA_Cohort_5\Week_Four\ship\shared\src\types\document.ts`
  - `d:\GFA_Cohort_5\Week_Four\ship\web\src\components\Editor.tsx`
  - `d:\GFA_Cohort_5\Week_Four\ship\api\src\app.ts`
- Open Questions:
  - Should this onboarding order be codified in a dedicated “first week in Ship” doc?
- Next Actions:
  - Add a curated onboarding checklist linking these exact files and commands.

### 8.4 10x user stress hypothesis

- Status: [X] Complete
- Prompt: What would break first if this app had 10x more users?
- Findings:
  - Most likely first pressure points:
    - Realtime fan-out and in-memory room state pressure in collaboration service.
    - Hot query paths on unified `documents` model under heavier concurrent read/write load.
    - Edge/network configuration sensitivity for websocket routing through CloudFront and upstream app tiers.
  - Secondary risks:
    - Session and auth-path DB churn (frequent activity updates/timeouts).
    - Potential drift between REST writes and collaboration cache invalidation under bursty traffic.
- Evidence (expected bottlenecks and why):
  - `d:\GFA_Cohort_5\Week_Four\ship\api\src\collaboration\index.ts`
  - `d:\GFA_Cohort_5\Week_Four\ship\api\src\routes\issues.ts`
  - `d:\GFA_Cohort_5\Week_Four\ship\docs\solutions\websocket-cloudfront-configuration.md`
  - `d:\GFA_Cohort_5\Week_Four\ship\terraform\environments\prod\main.tf`
- Open Questions:
  - At what concurrency threshold does single-process collaboration need horizontal partitioning/sharding?
- Next Actions:
  - Run targeted load tests for websocket connections + top API endpoints and establish explicit scaling thresholds.
