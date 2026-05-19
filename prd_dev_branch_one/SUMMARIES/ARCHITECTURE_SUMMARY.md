# Architecture Summary

- Status: [X] Complete
- Prompt: Review every file in `/docs`, `/docs/solutions/`, `docs/integration-issues`, `docs/patterns`, `docs/performance-issues` and provide a draft high-level summary of key architectural decisions.

- Findings:
  - Architecture is a pnpm monorepo with three core packages: `api/` (Express REST + WebSocket), `web/` (React + Vite), and `shared/` (cross-package types/contracts). The backend intentionally keeps REST and realtime in one Node process to reduce operational complexity.
  - The core product model is "everything is a document": one `documents` table with `document_type` and flexible `properties` JSONB. Hierarchy is modeled as programs -> projects -> weeks -> issues, with week windows derived from workspace cadence plus explicit week documents for commitment tracking.
  - Relationship semantics are intentionally split: containment uses `parent_id`, while organizational links should use `document_associations`. This is a major architectural normalization decision to avoid parent/association drift.
  - State/data flow is hybrid by design: metadata/lists use HTTP APIs + TanStack Query (with IndexedDB persistence), while rich content uses TipTap + Yjs (`y-websocket` transport, `y-indexeddb` local persistence) with debounced server persistence.
  - Security and auth decisions prioritize government constraints: workspace-scoped authorization, hardened session cookies, inactivity/absolute timeout policies, API bearer tokens hashed at rest, and AWS-native observability/secrets patterns (CloudWatch, SSM/Secrets Manager).
  - Deployment/runtime architecture is CloudFront in front of S3 (web) and ALB-backed app compute (Elastic Beanstalk/ECS patterns documented), with explicit websocket routing behavior required at CDN for collaboration/event channels.
  - Testing/performance decisions favor reliability over complexity: E2E-first posture with Playwright + testcontainerized DB isolation, and explicit guidance to run `vite preview` (not `vite dev`) for parallel test workers to avoid memory explosions.
  - Process architecture is intentionally productized: asynchronous standups, week planning/review flows, manager approval/accountability surfaces, and AI integration endpoints (`/api/claude/context`) that return hierarchy-aware context for automation.

- Evidence (doc files reviewed):
  - `d:\GFA_Cohort_5\Week_Four\ship\docs\application-architecture.md`
  - `d:\GFA_Cohort_5\Week_Four\ship\docs\ship-philosophy.md`
  - `d:\GFA_Cohort_5\Week_Four\ship\docs\unified-document-model.md`
  - `d:\GFA_Cohort_5\Week_Four\ship\docs\document-model-conventions.md`
  - `d:\GFA_Cohort_5\Week_Four\ship\docs\entity-relationships-feature.md`
  - `d:\GFA_Cohort_5\Week_Four\ship\docs\fpki-auth-client-dcr-analysis.md`
  - `d:\GFA_Cohort_5\Week_Four\ship\docs\performance-management.md`
  - `d:\GFA_Cohort_5\Week_Four\ship\docs\shadow-env-testing.md`
  - `d:\GFA_Cohort_5\Week_Four\ship\docs\developer-workflow-guide.md`
  - `d:\GFA_Cohort_5\Week_Four\ship\docs\ship-claude-cli-integration.md`
  - `d:\GFA_Cohort_5\Week_Four\ship\docs\week-documentation-philosophy.md`
  - `d:\GFA_Cohort_5\Week_Four\ship\docs\whats-new-accountability-system.md`
  - `d:\GFA_Cohort_5\Week_Four\ship\docs\notion-features-research.md`
  - `d:\GFA_Cohort_5\Week_Four\ship\docs\accountability-philosophy.md`
  - `d:\GFA_Cohort_5\Week_Four\ship\docs\accountability-manager-guide.md`
  - `d:\GFA_Cohort_5\Week_Four\ship\docs\solutions\websocket-cloudfront-configuration.md`
  - `d:\GFA_Cohort_5\Week_Four\ship\docs\solutions\performance-issues\vite-dev-memory-explosion-parallel-tests.md`
  - `d:\GFA_Cohort_5\Week_Four\ship\docs\solutions\patterns\shared-collaborative-editor-component.md`
  - `d:\GFA_Cohort_5\Week_Four\ship\docs\solutions\integration-issues\claude-context-api-for-ai-skills.md`
  - `d:\GFA_Cohort_5\Week_Four\ship\docs\claude-reference\INDEX.md`
  - `d:\GFA_Cohort_5\Week_Four\ship\docs\claude-reference\architecture.md`
  - `d:\GFA_Cohort_5\Week_Four\ship\docs\claude-reference\data-model.md`
  - `d:\GFA_Cohort_5\Week_Four\ship\docs\claude-reference\api-reference.md`
  - `d:\GFA_Cohort_5\Week_Four\ship\docs\claude-reference\commands.md`
  - `d:\GFA_Cohort_5\Week_Four\ship\docs\claude-reference\security.md`
  - `d:\GFA_Cohort_5\Week_Four\ship\docs\claude-reference\testing.md`
  - `d:\GFA_Cohort_5\Week_Four\ship\docs\claude-reference\patterns.md`
  - `d:\GFA_Cohort_5\Week_Four\ship\docs\claude-reference\anti-patterns.md`
  - `d:\GFA_Cohort_5\Week_Four\ship\docs\claude-reference\onboarding.md`
  - `d:\GFA_Cohort_5\Week_Four\ship\docs\claude-reference\modules\collaboration.md`
  - `d:\GFA_Cohort_5\Week_Four\ship\docs\claude-reference\modules\editor.md`
  - `d:\GFA_Cohort_5\Week_Four\ship\docs\claude-reference\gotchas.md`
  - `d:\GFA_Cohort_5\Week_Four\ship\docs\claude-reference\glossary.md`
  - `d:\GFA_Cohort_5\Week_Four\ship\docs\claude-reference\faq.md`
  - `d:\GFA_Cohort_5\Week_Four\ship\docs\claude-reference\diagrams.md`
  - `d:\GFA_Cohort_5\Week_Four\ship\docs\claude-reference\code-examples.md`

- Open Questions:
  - Which schema narrative is canonical now: fully normalized `document_associations` only, or a transitional dual model still using legacy relationship columns in some paths/docs?
  - Should docs uniformly describe offline behavior as "editor offline-tolerant (Yjs) but non-editor writes require network," given conflicting references to queued offline writes?
  - Which websocket/API path routing is authoritative for edge config: conceptual `/ws/*` or concrete `/collaboration/*` + `/events`?
  - Should week identity naming be standardized across docs/API (`week` vs historical `sprint`/`sprint_id`) to reduce integration ambiguity?
  - Are session timeout details finalized at 15m inactivity + 12h absolute everywhere, or do legacy "strict 15m only" descriptions still reflect active behavior?
  - Should environment variable naming for API base URL be normalized (`SHIP_URL` vs `SHIP_API_URL`) for automation and docs consistency?

- Next Actions:
  - Choose one canonical architecture reference set (recommended: `application-architecture.md` + `document-model-conventions.md` + curated `claude-reference/*`) and mark older conflicting statements as historical.
  - Add a short "Current Canonical Decisions" block to `docs/claude-reference/INDEX.md` linking to authoritative docs for schema, auth, realtime paths, and offline behavior.
  - Reconcile naming drift (`week`/`sprint`) in API docs and examples, then regenerate any derived references/examples to prevent future drift.
  - Validate CloudFront behavior docs against live Terraform/config and update all diagrams/examples to exact production path conventions.
  - Add a docs consistency check in CI (lint or script) for high-risk terms (`program_id`, `project_id`, `sprint_id`, websocket paths, timeout policy) to catch contradictory updates.

## Package Relationship Diagram (`web/`, `api/`, `shared/`)

- Status: [X] Complete
- Prompt: Create a diagram of how the `web/`, `api/`, and `shared/` packages relate to each other.
- Findings:
  - `shared/` (`@ship/shared`) is the contract package consumed by both `web/` and `api/` for shared types/constants and helper utilities.
  - `web/` depends on `shared/` via workspace dependency and TypeScript project references, then communicates with `api/` at runtime over HTTP and WebSocket channels.
  - `api/` depends on `shared/` through `tsconfig` path aliasing to `../shared/dist`, so backend compilation and runtime expect built shared artifacts.
  - Relationship shape is hub-and-spoke for compile-time contracts (`shared/` in the center), with `web/ -> api/` as the primary runtime interaction path.

  ```mermaid
  flowchart LR
      WEB["web/ (React + Vite)"]
      API["api/ (Express + WebSocket)"]
      SHARED["shared/ (@ship/shared types/constants)"]

      WEB -->|HTTP REST + WebSocket| API
      WEB -->|imports types/constants| SHARED
      API -->|imports types/constants| SHARED
      API -.->|tsconfig path -> ../shared/dist| SHARED
  ```

- Evidence (type files and import references): `SHARED_SUMMARY.md`
- Open Questions:
  - Should `api/` migrate from `../shared/dist` path mapping to direct workspace/type-reference consumption for tighter dev-loop consistency?
  - Which shared DTO interfaces should become mandatory API response contracts to reduce local type duplication?
- Next Actions:
  - Keep this diagram in sync when package dependency wiring changes (`package.json`/`tsconfig` updates).
  - Add a lightweight CI check that verifies both `web/` and `api/` still resolve `@ship/shared` and type-check against current exports.
