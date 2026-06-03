# Ship

Project management that helps teams learn and improve through plan-driven execution, documentation, and accountability workflows.

## What this repository contains

This is a `pnpm` monorepo with:

- `api/` - Express + PostgreSQL backend (REST, OpenAPI, collaboration services)
- `web/` - React + Vite frontend
- `shared/` - shared TypeScript types/contracts
- `e2e/` - Playwright end-to-end tests
- `docs/` - architecture and operational documentation
- `deliverables/` - client PRD packages, compliance matrices, and reviewable evidence by week

Client reviewers should start at [`deliverables/INDEX.md`](./deliverables/INDEX.md). Current week-three (PlugForge) work is on branch `gfa2_wk6-final`, deployed for review at `https://ship-web-jyqh.onrender.com/login`, and governed by [`deliverables/2026-W23-week-03/PRD.md`](./deliverables/2026-W23-week-03/PRD.md). Week-two FleetGraph artifacts remain under [`deliverables/2026-W22-week-02/`](./deliverables/2026-W22-week-02/). Generated coverage HTML and deployment archives are kept out of the committed source tree; commit summarized evidence under the relevant weekly deliverable folder when it proves a PRD requirement.

## Prerequisites

- Node.js 20+
- `pnpm` 9+ (repo currently uses `pnpm@10.27.0`)
- PostgreSQL (recommended local workflow), or Docker for containerized local stack

## Quick start (recommended: local PostgreSQL)

```bash
# 1) Install dependencies
pnpm install

# 2) Start both API + web
pnpm dev
```

`pnpm dev` runs `scripts/dev.sh`, which automatically:

1. Creates `api/.env.local` if it is missing
2. Creates and seeds a worktree-specific database when needed
3. Finds available ports (`API: 3000+`, `Web: 5173+`)
4. Starts API and web in parallel

### Local URLs

- Web app: `http://localhost:5173` (or next available `517x` port)
- API: `http://localhost:3000` (or next available `300x` port)
- Swagger UI: `<api-url>/api/docs`
- OpenAPI JSON: `<api-url>/api/openapi.json`
- Public OpenAPI JSON (MVP): `<api-url>/api/v1/openapi.json`

### Week 03 MVP Public API Notes

- Static public OpenAPI copy: `docs/openapi.json` (generated via `pnpm --filter @ship/api openapi:generate:public`)
- Live public OpenAPI URL on deployed instance: `https://ship-web-jyqh.onrender.com/api/v1/openapi.json`
- Deployed app (grader login): `https://ship-web-jyqh.onrender.com/login`

#### Pre-registered grader OAuth app (read-only)

A **read-only** OAuth client is pre-registered on the deployed instance for MVP grading (Authorization Code + PKCE; `documents:read` only).

| Field | Value |
| --- | --- |
| App name | Gauntlet Grader (read-only) |
| **client_id** | `ship_9ba67d9391c53a610558563b93627298` |
| Registered redirect URI | `https://example.local/oauth/callback` |
| Scopes | `documents:read` |
| **client_secret** | **Not in git.** Submit via the Gauntlet course portal (Week 03 submission form) or request from the author. Issued once at registration (2026-06-01). If lost, contact the author to rotate or re-register. |

**PKCE smoke test (no secret in URL):**

```bash
pnpm test:e2e --grep "OAuth Authorization Code + PKCE"
```

**Full regression (MVP gate):** `pnpm test:e2e` (requires Docker for isolated DB). Evidence log: `deliverables/2026-W23-week-03/evidence/e2e-full-run-CONFIRM.log`.

#### CLI + Time-to-First-Event (Early/Final)

```bash
pnpm install
pnpm --filter @ship/sdk build
pnpm --filter @ship/cli build
export SHIP_API_URL=https://ship-web-jyqh.onrender.com
export SHIP_CLIENT_ID=<your_oauth_app_client_id>
ship login
ship docs create --title "hello"
ship webhooks tail
```

Register a CLI OAuth app (super admin): include `webhooks:manage` and `documents:write` in `requested_scopes`. Device verification UI: `/oauth/device` while logged in.

TTFE drill (CI/local, requires running API + env): `pnpm drill:ttfe` with `TTFE_BASE_URL` and `TTFE_CLIENT_ID` set. See `deliverables/2026-W23-week-03/EARLY_SUBMISSION.md`.

Agent public API mode: `SHIP_AGENT_USE_PUBLIC_API=true` on the API server.

Optional local handoff copy (gitignored): `deliverables/2026-W23-week-03/GRADER_HANDOFF.md` — super-admin provisioning steps only; never commit `client_secret` or production passwords.

**Re-register (super admin only):** `POST /api/v1/oauth/apps` with session cookie + `x-csrf-token` from `GET /api/csrf-token`:

```json
{
  "name": "Gauntlet Grader (read-only)",
  "redirect_uris": ["https://example.local/oauth/callback"],
  "requested_scopes": ["documents:read"]
}
```

Response `201` returns `client_id` and a one-time `client_secret` (hashed at rest; not retrievable later).

If ports are shifted (multi-worktree dev), check `.ports` in repo root while `pnpm dev` is running.

## Alternate local stack (Docker)

For a full containerized local environment:

```bash
pnpm docker:up
```

This uses `docker-compose.local.yml` and starts:

- PostgreSQL on `localhost:5433`
- API on `localhost:3000`
- Web on `localhost:5173`

Stop services:

```bash
pnpm docker:down
```

Remove volumes:

```bash
pnpm docker:clean
```

## Common commands

```bash
# Development
pnpm dev
pnpm dev:api
pnpm dev:web
pnpm dev:shared
pnpm worktree:init

# Quality
pnpm type-check
pnpm lint
pnpm test
pnpm test:coverage
pnpm test:e2e
pnpm test:e2e:ui

# Database
pnpm db:migrate
pnpm db:seed
pnpm db:orphan-check

# Remote wiki seed (bulk-upload markdown portfolio to a deployed Ship instance)
pnpm --filter @ship/api seed:remote-wiki

# Remote synthetic workspace seed (UC + edge-case dataset)
pnpm --filter @ship/api seed:remote-synthetic

# Build
pnpm build
pnpm build:api
pnpm build:web
```

## Remote wiki seed (future weeks)

Use this workflow to bulk-create wiki documents in a deployed Ship instance from local markdown artifacts (for example, a week’s PRD bundle). This uses the Ship REST API with your normal login credentials—there is no mass-upload button in the web UI.

**Script:** `api/src/scripts/seed-remote-wiki-docs.ts`

**Default source:** `deliverables/2026-W21-week-01/` (override with `SHIP_SEED_SOURCE_DIR`)

```bash
# Required: credentials and target instance (never commit these)
export SHIP_BASE_URL=https://ship-web-jyqh.onrender.com
export SHIP_EMAIL=you@example.com
export SHIP_PASSWORD=your-password

# First run: creates root portfolio doc + all .md files as nested wiki pages
pnpm --filter @ship/api seed:remote-wiki

# Later runs: add only missing pages (skips if root already exists unless resume is set)
export SHIP_SEED_RESUME=1
pnpm --filter @ship/api seed:remote-wiki
```

PowerShell equivalent:

```powershell
$env:SHIP_BASE_URL = "https://ship-web-jyqh.onrender.com"
$env:SHIP_EMAIL = "you@example.com"
$env:SHIP_PASSWORD = "your-password"
pnpm --filter @ship/api seed:remote-wiki
```

**Useful options:**

| Variable | Purpose |
| --- | --- |
| `SHIP_SEED_ROOT_TITLE` | Root portfolio doc title (default: `GFA Week 4 — PRD Portfolio`) |
| `SHIP_SEED_SOURCE_DIR` | Path to markdown tree (resolved by the seed script; default points at `deliverables/2026-W21-week-01/`) |
| `SHIP_SEED_RESUME=1` | Reuse existing root; create only missing wiki pages |
| `SHIP_SEED_DRY_RUN=1` | Print actions without creating documents |
| `SHIP_SEED_DELAY_MS` | Delay between API calls (default: `300`) |

After seeding, open **Documents** in Ship and look for the root portfolio title. Each markdown file becomes a wiki page; folder structure becomes parent/child docs.

**Notes:**

- Only `.md` files are imported. Attach logs/JSON in the editor or keep them in git evidence folders.
- Render’s edge firewall may block some payloads; the script sanitizes common patterns (angle brackets, `curl -i`).
- For a new week, change `SHIP_SEED_ROOT_TITLE` and point `SHIP_SEED_SOURCE_DIR` at that week’s artifact folder.

## Remote synthetic workspace seed (HITL + automated verification)

Use this workflow to create a separate synthetic workspace on a deployed Ship instance with realistic UC1-UC4 data (manager accountability, engineer evidence, PM hypothesis validation, and compliance/security verification), including edge cases for future manual and automated experiments.

**Script:** `api/src/scripts/seed-remote-synthetic-workspace.ts`

```bash
# Required: credentials and target instance (never commit these)
export SHIP_BASE_URL=https://ship-web-jyqh.onrender.com
export SHIP_EMAIL=you@example.com
export SHIP_PASSWORD=your-password

# First run: create isolated workspace + seed programs/projects/weeks/issues/docs
pnpm --filter @ship/api seed:remote-synthetic

# Re-run safely against the same synthetic workspace
export SHIP_SYNTH_RESUME=1
pnpm --filter @ship/api seed:remote-synthetic
```

PowerShell equivalent:

```powershell
$env:SHIP_BASE_URL = "https://ship-web-jyqh.onrender.com"
$env:SHIP_EMAIL = "you@example.com"
$env:SHIP_PASSWORD = "your-password"
$env:SHIP_SYNTH_WORKSPACE_NAME = "GFA Synthetic HITL Workspace"
pnpm --filter @ship/api seed:remote-synthetic
```

**Useful options:**

| Variable | Purpose |
| --- | --- |
| `SHIP_SYNTH_WORKSPACE_NAME` | Name of the isolated synthetic workspace |
| `SHIP_SYNTH_RESUME=1` | Reuse existing synthetic workspace and add missing entities |
| `SHIP_SYNTH_DRY_RUN=1` | Print actions without mutating remote data |
| `SHIP_SYNTH_DELAY_MS` | Delay between mutating API calls (default `200`) |

**Manual HITL validation checklist:**

- Manager flow (UC1): confirm overdue/missing-plan style items appear in week/accountability views.
- Engineer flow (UC2): verify standup + issue state + weekly artifact evidence traceability.
- PM flow (UC3): compare hypothesis projects with contrasting ICE/risk conditions.
- Compliance flow (UC4): validate remediation/open-gap issue states and related wiki evidence pages.
- Edge cases: verify at least one missing retro, one template-only plan, one unassigned backlog issue, and one cancelled hypothesis issue.

## Security and compliance tooling

- Security probe command: `pnpm security:probe`
- Security policy: `SECURITY.md`
- Probe documentation: `docs/security-probe-tooling.md`

## Documentation map

- `docs/application-architecture.md`
- `docs/unified-document-model.md`
- `docs/document-model-conventions.md`
- `docs/week-documentation-philosophy.md`
- `docs/accountability-philosophy.md`
- `docs/accountability-manager-guide.md`
- `docs/developer-workflow-guide.md`
- `docs/product/ship-welcome-guide.md`
- `docs/product/ship-changelog-72h.md`
- `docs/product/ship-clarity-feature-demo.md`
- `deliverables/INDEX.md`

Render docs deployment:

- The Render blueprint includes a `ship-docs` static service that publishes the `docs/` folder.
- `docs/index.html` is the landing page for repository documentation in production.
- `docs/md-viewer.html` renders markdown files as styled HTML in-browser.

Operational/deployment references:

- `DEPLOYMENT.md`
- `DEPLOYMENT_CHECKLIST.md`
- `INFRASTRUCTURE.md`
- `INFRASTRUCTURE_README.md`

## Contributing

See `CONTRIBUTING.md` for contribution workflow and PR expectations.

## License

MIT - see `LICENSE`.
