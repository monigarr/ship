# Security Probe Tooling (Cat 8)

This document describes the runnable Cat 8 security probe CLI and the required
inputs for active attack-surface checks.

## Command

```bash
pnpm security:probe
```

This executes `api/src/scripts/security-probe.ts` and writes:

- JSON: `prd_dev_branch_one/PRD_CAT8/security-probe-report.json`
- Markdown: `prd_dev_branch_one/PRD_CAT8/security-probe-report.md`

## Environment Variables

- `SECURITY_PROBE_BASE_URL` (default: `http://localhost:3000`)
- `SECURITY_PROBE_WS_URL` (default: derived from base URL, `http` → `ws`)
- `SECURITY_PROBE_TIMEOUT_MS` (default: `8000`)
- `SECURITY_PROBE_OUTPUT` (default path above)
- `SECURITY_PROBE_ALLOWED_HOSTS` (optional comma-separated extra hostnames merged with defaults)

### Allowed probe targets (SSRF protection)

Before any HTTP/WebSocket request, the probe validates the target hostname against
an allowlist and rejects private/metadata addresses. Default allowed hosts:

- `localhost`, `127.0.0.1`, `::1`
- `ship-api-ejok.onrender.com`
- `ship-web-jyqh.onrender.com`
- `ship-docs.onrender.com`

Add more hosts with `SECURITY_PROBE_ALLOWED_HOSTS` (comma-separated). Requests use
`redirect: error` and only relative API paths under the validated origin.

Probe against the deployed API:

```bash
SECURITY_PROBE_BASE_URL=https://ship-api-ejok.onrender.com pnpm security:probe
```

Use the **API** base URL for probe runs (not the web or docs hosts). The web/docs
hosts are on the allowlist for related tooling but the probe exercises `/api/*`
routes.

Optional authenticated probes (defaults assume seeded local data):

- `SECURITY_PROBE_MEMBER_EMAIL`
- `SECURITY_PROBE_MEMBER_PASSWORD`
If member credentials are not supplied, the probe defaults to:

- email: `alice.chen@ship.local`
- password: `admin123`

## Attack Surfaces Covered

1. Authentication and session handling
   - unauthenticated route matrix (multiple protected endpoints)
   - session token format and uniqueness sanity checks
   - session fixation resistance check
   - old-session replay invalidation check on relogin
   - session expiry metadata coherence check (`expiresAt`, `absoluteExpiresAt`)
2. WebSocket message validation
   - unauthenticated upgrade rejection
   - malformed/oversized payload rejection on authenticated path
3. Input sanitization across user-facing surfaces
   - reflected probes across search/issues/documents/team query params
   - stored probes across issue/document title fields
   - vector set includes XSS-style, SQLi-style, and excessive-length payloads
4. Dependency vulnerabilities
   - `pnpm audit --json` high/critical parsing
   - package-to-feature impact mapping and dependency path capture (`pnpm why`)

## Notes

- If the target app is not reachable, findings are reported with `error` or
  `skip` status while still producing structured output.
- Authenticated checks are marked as `skip` when credentials are not supplied.
