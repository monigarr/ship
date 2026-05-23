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

# Build
pnpm build
pnpm build:api
pnpm build:web
```

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
