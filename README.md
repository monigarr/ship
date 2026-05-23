# Ship

Project management that helps teams learn and improve through plan-driven execution, documentation, and accountability workflows.

## What this repository contains

This is a `pnpm` monorepo with:

- `api/` - Express + PostgreSQL backend (REST, OpenAPI, collaboration services)
- `web/` - React + Vite frontend
- `shared/` - shared TypeScript types/contracts
- `e2e/` - Playwright end-to-end tests
- `docs/` - architecture and operational documentation
- `prd_dev_branch_one/` - PRD, audit, and evidence bundles produced in this branch

Additional branch evidence artifacts may also appear in:

- `api/prd_dev_branch_one/`
- `api/coverage/`
- `web/coverage/`

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

# Build
pnpm build
pnpm build:api
pnpm build:web
```

## Remote wiki seed (future weeks)

Use this workflow to bulk-create wiki documents in a deployed Ship instance from local markdown artifacts (for example, a week’s PRD bundle). This uses the Ship REST API with your normal login credentials—there is no mass-upload button in the web UI.

**Script:** `api/src/scripts/seed-remote-wiki-docs.ts`

**Default source:** `prd_dev_branch_one/` (override with `SHIP_SEED_SOURCE_DIR`)

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
| `SHIP_SEED_SOURCE_DIR` | Path to markdown tree (relative to `api/`) |
| `SHIP_SEED_RESUME=1` | Reuse existing root; create only missing wiki pages |
| `SHIP_SEED_DRY_RUN=1` | Print actions without creating documents |
| `SHIP_SEED_DELAY_MS` | Delay between API calls (default: `300`) |

After seeding, open **Documents** in Ship and look for the root portfolio title. Each markdown file becomes a wiki page; folder structure becomes parent/child docs.

**Notes:**

- Only `.md` files are imported. Attach logs/JSON in the editor or keep them in git evidence folders.
- Render’s edge firewall may block some payloads; the script sanitizes common patterns (angle brackets, `curl -i`).
- For a new week, change `SHIP_SEED_ROOT_TITLE` and point `SHIP_SEED_SOURCE_DIR` at that week’s artifact folder.

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
