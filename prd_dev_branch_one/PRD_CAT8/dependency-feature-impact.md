# Dependency Feature Impact Mapping (Cat8)

Generated: 2026-05-22
Source audit artifacts:

- `prd_dev_branch_one/PRD_CAT8/pnpm-audit-prod-post-upgrade.json` (pre-remediation snapshot)
- `prd_dev_branch_one/PRD_CAT8/pnpm-audit-prod-remediated.json` (post-remediation snapshot)

## Scope

This map ties production dependency advisories to runtime features so remediation is traceable to real attack-surface reduction.

## Remediation batches executed

### Batch A - Direct production dependency upgrades

- `api/express` -> `^4.22.2`
- `api/express-rate-limit` -> `^8.5.2`
- `api/ws` -> `^8.21.0`
- `api/@aws-sdk/*` clients + presigner -> `^3.1052.0`

### Batch B - Dependency graph risk reduction

- Moved `@modelcontextprotocol/sdk` from API production dependencies to API devDependencies.
  - This removes Hono/fast-uri advisory chain from production runtime graph.

### Batch C - Frontend toolchain hardening

- `web/vite` -> `^8.0.14`
- `web/@vitejs/plugin-react` -> `^6.0.2`

## Advisory -> feature mapping

| Package | Pre-remediation path | Runtime feature impact | Status |
| --- | --- | --- | --- |
| `express-rate-limit` | `api>express-rate-limit` | API/login anti-brute-force throttling in `api/src/app.ts` | Remediated (upgraded) |
| `ws` | `api>ws` | WebSocket collaboration + events in `api/src/collaboration/index.ts` | Remediated (upgraded) |
| `fast-xml-parser` | `api>@aws-sdk/client-bedrock-runtime>@aws-sdk/core>@aws-sdk/xml-builder>fast-xml-parser` | AWS SDK XML parsing paths for cloud service integrations | Remediated (via AWS SDK upgrades) |
| `hono` | `api>@modelcontextprotocol/sdk>hono` | MCP server utility surface in `api/src/mcp/server.ts` (dev/operator path) | Removed from production graph by moving SDK to devDependencies |
| `@hono/node-server` | `api>@modelcontextprotocol/sdk>@hono/node-server` | MCP local server transport (dev/operator path) | Removed from production graph by moving SDK to devDependencies |
| `fast-uri` | `api>@modelcontextprotocol/sdk>ajv-formats>fast-uri` | URL validation/parsing path in MCP tool schema handling | Removed from production graph by moving SDK to devDependencies |
| `path-to-regexp` | `api>express>path-to-regexp` (when Express 5 trialed) | HTTP route pattern handling for API endpoints | Resolved by reverting to Express 4 LTS track |

## Post-remediation result

From `pnpm-audit-prod-remediated.json` metadata:

- High: `0`
- Critical: `0`
- Moderate: `2`

No High/Critical production advisories remain. CI guardrail now enforces this with:

- `scripts/ci/check-prod-audit.mjs`
- `.github/workflows/dependency-audit.yml`

## Quick Percentage Delta Table (C8 Submission)

Formula used: `((baseline - after) / baseline) * 100` (positive = improvement/reduction).

| Category | Metric | Baseline | After | Delta % | Proof |
| --- | ---: | ---: | ---: | ---: | --- |
| C8 | Prod high advisories | 7 | 0 | 100.00% | `PRD_CAT8/pnpm-audit-prod-post-upgrade.json`, `PRD_CAT8/pnpm-audit-prod-remediated.json` |
| C8 | Prod critical advisories | 1 | 0 | 100.00% | `PRD_CAT8/pnpm-audit-prod-post-upgrade.json`, `PRD_CAT8/pnpm-audit-prod-remediated.json` |
| C8 | Prod high+critical advisories | 8 | 0 | 100.00% | `PRD_CAT8/pnpm-audit-prod-post-upgrade.json`, `PRD_CAT8/pnpm-audit-prod-remediated.json` |
| C8 | Prod moderate advisories | 21 | 2 | 90.48% | `PRD_CAT8/pnpm-audit-prod-post-upgrade.json`, `PRD_CAT8/pnpm-audit-prod-remediated.json` |
| C8 | Security probe `pass` findings | 4 | 7 | 75.00% | `PRD_CAT8/security-probe-closeout.md`, `PRD_CAT8/security-probe-closeout-4.md` |
| C8 | Security probe `error` findings | 0 | 0 | N/A | `PRD_CAT8/security-probe-closeout.md`, `PRD_CAT8/security-probe-closeout-4.md` |

Notes:
- Advisory deltas are based on `metadata.vulnerabilities` in the two production audit JSON snapshots.
- Probe pass findings increased because additional checks were exercised in the later closeout run.

## Historical audit snapshots (fast-uri)

The following committed JSON/Markdown files are **point-in-time Cat8 evidence** and may still list `fast-uri` (or other remediated packages). They are **not** live dependency state:

- `pnpm-audit-prod-post-upgrade.json`, `pnpm-audit-prod-after-phase2.json`
- `security-probe-closeout.json`, `security-probe-closeout-2.json` through `security-probe-closeout-4.json`

**Verified 2026-05-24** (from `ship/` after `pnpm install`):

- Lockfile: `hono@4.12.22` (transitive via `@modelcontextprotocol/sdk` → `@hono/node-server`, **devDependencies only**; meets Aikido floor `4.12.18`).
- Lockfile: `fast-uri@3.1.2` (transitive via `@modelcontextprotocol/sdk` → `ajv`, **devDependencies only**).
- `pnpm audit --prod`: **0** High/Critical; **0** `hono` or `fast-uri` production advisories (see `pnpm-audit-prod-20260524.json`).
- CI: `pnpm run security:ci:dependencies` passes.

Regenerate snapshots only when intentionally re-baselining Cat8 metrics; do not use them alone to judge current `hono` or `fast-uri` exposure.
