# Ship — Mental Model for the Exhausted Engineer

> **One sentence:** Ship is a U.S. Treasury project-management app (docs + issues + sprints) built as a TypeScript monorepo where **everything is a document** in one Postgres table, with real-time collaborative editing via Yjs CRDTs over WebSockets.

---

## The Big Picture in 30 Seconds

- **Three packages, one repo:** `web/` (React + Vite), `api/` (Express + WebSocket), `shared/` (TypeScript contracts both sides import)
- **One table rules them all:** A single `documents` table with a `document_type` enum discriminator (`wiki`, `issue`, `program`, `project`, `sprint`, `person`, `standup`, etc.) and a flexible `properties` JSONB column for type-specific data
- **Two data channels:** REST/HTTP for metadata and list operations, WebSocket + Yjs for rich-text collaborative editing
- **Server is truth:** Offline-tolerant via IndexedDB + Yjs local cache, but the server is always authoritative

---

## Package Relationships

```
shared/ (@ship/shared)          <-- contract hub: types, enums, constants
   ↑              ↑
   |              |
 web/           api/
(React+Vite)   (Express+WS)
   |              |
   └──── HTTP + WebSocket ────┘
```

- `web/` imports `@ship/shared` via workspace dependency + TS project reference
- `api/` imports `@ship/shared` via tsconfig path alias to `../shared/dist` (must build shared first)
- Runtime communication: `web/ → api/` over REST and WebSocket

---

## Data Model — The Core Insight

- **`documents` table** = the universal entity. Columns: `id`, `workspace_id`, `document_type`, `title`, `content` (JSON), `yjs_state` (binary CRDT), `properties` (JSONB), `parent_id`, `ticket_number`, `visibility`, timestamps, `created_by`
- **`document_type` enum** = the discriminator. Every API route filters on it: `/api/issues` → `WHERE document_type = 'issue'`, `/api/projects` → `WHERE document_type = 'project'`, etc.
- **`document_associations` table** = typed graph edges for organizational links. `relationship_type` enum: `parent`, `project`, `sprint`, `program`. This is how issues belong to sprints, projects belong to programs, etc.
- **`document_links` table** = backlink-style links between documents (separate from associations)
- **`parent_id`** = tree hierarchy (self-referencing FK on `documents`, with cycle-prevention trigger)
- **Hierarchy:** programs → projects → weeks/sprints → issues

---

## Request Flow (e.g., "Create an Issue")

1. **UI:** `IssuesPage` → `IssuesList` → button click → `useCreateIssue` hook
2. **API call:** `apiPost('/api/issues', data)` with CSRF token via `fetchWithCsrf`
3. **Middleware chain (every request):** `helmet` → rate limiter → `cors` → body parsers → `cookieParser` → `express-session` → then per-route: `conditionalCsrf` → `authMiddleware`
4. **Route handler:** Zod validates input → DB transaction → advisory lock → `MAX(ticket_number)+1` → `INSERT INTO documents` → `INSERT INTO document_associations` → commit → return 201
5. **Back to UI:** React Query cache update → navigate to new document

---

## Authentication

- **Two auth modes:** Session cookie (primary, browser) or Bearer API token (programmatic)
- **Session:** `session_id` cookie → DB lookup → 15-min inactivity timeout + 12-hr absolute timeout → httpOnly/sameSite/secure cookie
- **API token:** `Authorization: Bearer <token>` → SHA-256 hash lookup → `api_tokens` table → workspace-scoped
- **Unauthenticated:** 401 JSON with `code: UNAUTHORIZED`
- **Auth is route-level, not global:** Each protected handler calls `authMiddleware` explicitly — there is no top-level deny-by-default middleware

---

## Real-Time Collaboration

- **Two WebSocket channels:**
  - `/collaboration/*` — Yjs CRDT document sync (rich-text editor)
  - `/events` — user-scoped notifications/presence
- **Sync flow:** Client creates `Y.Doc` per document → IndexedDB loads local cache → WebSocket connects → Yjs sync protocol exchanges deltas → awareness protocol shares cursors/presence
- **Concurrent editing:** Yjs CRDTs merge automatically (conflict-free by design). App-level guardrails: access revocation closes sockets (4403), document conversion sends redirect (4100)
- **Persistence:** Debounced 2-second save per room → serializes CRDT state to `documents.yjs_state` + converts to JSON backup in `documents.content` + extracts structured fields to `documents.properties`. On load: prefers binary `yjs_state`, falls back to converting `content` JSON
- **Room lifecycle:** Last socket close → flush pending saves → eventually evict in-memory state

---

## Shared Package (`@ship/shared`)

Exports used by both `web/` and `api/`:
- **Domain types:** `DocumentType`, `IssueState`, `IssuePriority`, `DocumentVisibility`, `BelongsTo`, `CascadeWarning`, typed document interfaces (`IssueDocument`, `WikiDocument`, etc.)
- **Property interfaces:** `IssueProperties`, `ProgramProperties`, `ProjectProperties`, `WeekProperties`, etc.
- **Constants:** `HTTP_STATUS`, `ERROR_CODES`, `SESSION_TIMEOUT_MS`, `ABSOLUTE_SESSION_TIMEOUT_MS`
- **Business logic:** `computeICEScore()`, `DEFAULT_PROJECT_PROPERTIES`
- **API contracts:** `ApiResponse<T>`, `ApiError`, `User`, `Workspace*` types

---

## Testing

- **API/unit tests:** Vitest (`pnpm test`) — 28 test files, 451 tests, ~127s runtime, all passing
- **E2E tests:** Playwright (`pnpm test:e2e`) — 73+ tests covering auth, issues, docs, accessibility, performance, accountability
- **E2E fixtures:**
  - `isolated-env.ts` — per-worker Postgres container (Testcontainers) + worker-local API + Vite preview server (full isolation)
  - `dev-server.ts` — reuses pre-running local servers (faster, less isolation)
- **Global setup:** builds API and web once before workers launch
- **Key gotcha:** Use `vite preview` (not `vite dev`) for parallel test workers to avoid memory explosions

---

## Build & Deploy

- **Local dev:** `pnpm dev` (or `pnpm dev:raw` on Windows) — runs API + web + Postgres via docker-compose
- **Docker:**
  - `docker-compose.yml` = Postgres only (port 5432)
  - `docker-compose.local.yml` = full stack: Postgres (5433) + API (3000) + web (5173)
  - `Dockerfile` = production API image: `node:20-slim`, copies pre-built `shared/dist` + `api/dist`, runs migrations then server on port 80
- **Cloud (Terraform):** AWS-native — VPC, Aurora Serverless v2, Elastic Beanstalk, CloudFront + S3 for frontend, SSM for config, WAF. Prod creates own VPC; dev shares VPC via SSM
- **CI/CD:** No in-repo workflow files found. CI expectations implied by scripts/docs; likely managed externally

---

## Three Strongest Decisions

1. **Unified document model** — one table, one CRUD shape, reduced schema sprawl
2. **Shared contract package** (`@ship/shared`) — prevents cross-layer type drift
3. **Yjs-based collaborative editor** — deterministic CRDT merge with offline resilience

---

## Three Weakest Points

1. **Middleware/route policy consistency** — auth and CSRF are applied per-route, easy to drift or miss
2. **Collaboration server complexity** — one large module (`api/src/collaboration/index.ts`) handling upgrade, auth, protocol, persistence, and events
3. **CI/CD discoverability** — no pipeline config visible in-repo; contributors can't see gates locally

---

## What Breaks at 10x Users

1. **WebSocket fan-out** — in-memory room state and message relay in a single Node process
2. **Hot queries on `documents`** — unified table under heavy concurrent read/write load
3. **CloudFront WebSocket routing** — edge config sensitivity for collaboration channels
4. **Session DB churn** — frequent `last_activity` updates and timeout checks

---

## The 7 Audit Categories (Your Scoreboard)

| # | Category | What to Measure | Improvement Target |
|---|----------|----------------|-------------------|
| 1 | Type Safety | `any`, `as`, `!`, `@ts-ignore`, strict mode | Eliminate 25% of violations |
| 2 | Bundle Size | Production build size, chunks, largest deps | 15% reduction or 20% off initial load |
| 3 | API Response Time | P50/P95/P99 under realistic data + concurrent load | 20% P95 reduction on 2+ endpoints |
| 4 | DB Query Efficiency | Query count per flow, N+1, EXPLAIN ANALYZE | 20% fewer queries or 50% on slowest |
| 5 | Test Coverage | Pass/fail/flaky, critical flow gaps | +3 meaningful tests or fix 3 flaky |
| 6 | Runtime Errors | Console errors, network recovery, edge cases | Fix 3 gaps, 1 must be data-loss scenario |
| 7 | Accessibility | Lighthouse, axe, keyboard nav, contrast | +10 Lighthouse points or fix all Critical/Serious on top 3 pages |

---

## Key Files — Start Here

| Purpose | File |
|---------|------|
| App architecture overview | `docs/application-architecture.md` |
| Unified document model docs | `docs/unified-document-model.md`, `docs/document-model-conventions.md` |
| Database schema | `api/src/db/schema.sql` |
| API entry + middleware | `api/src/app.ts` |
| Server bootstrap + WS attach | `api/src/index.ts` |
| Issue routes (representative) | `api/src/routes/issues.ts` |
| Auth middleware | `api/src/middleware/auth.ts` |
| Collaboration server | `api/src/collaboration/index.ts` |
| Shared types hub | `shared/src/types/document.ts` |
| Shared constants | `shared/src/constants.ts` |
| Editor component (client collab) | `web/src/components/Editor.tsx` |
| Issue list/create UI | `web/src/components/IssuesList.tsx` |
| API client utilities | `web/src/lib/api.ts` |
| Playwright config | `playwright.config.ts` |
| E2E isolated fixture | `e2e/fixtures/isolated-env.ts` |
| Terraform prod | `terraform/environments/prod/main.tf` |

---

## Windows Dev Note

The `pnpm dev` script calls `./scripts/dev.sh` which requires Bash. On Windows either:
- Use `pnpm dev:raw` directly, or
- Set pnpm to use Git Bash: `pnpm config set script-shell "C:\\Program Files\\Git\\bin\\bash.exe"`

---

*Generated from full orientation of `/ship/prd_dev_branch_one/` documents — 2026-05-18*
