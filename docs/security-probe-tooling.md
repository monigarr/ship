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
- `SECURITY_PROBE_WS_URL` (default: `ws://localhost:3000`)
- `SECURITY_PROBE_TIMEOUT_MS` (default: `8000`)
- `SECURITY_PROBE_OUTPUT` (default path above)

Optional authenticated probes (defaults assume seeded local data):

- `SECURITY_PROBE_MEMBER_EMAIL`
- `SECURITY_PROBE_MEMBER_PASSWORD`
- `SECURITY_PROBE_ADMIN_EMAIL`
- `SECURITY_PROBE_ADMIN_PASSWORD`

If member credentials are not supplied, the probe defaults to:

- email: `alice.chen@ship.local`
- password: `admin123`

## Attack Surfaces Covered

1. Authentication and session handling
2. WebSocket message validation (unauth + authenticated malformed/oversized payload path)
3. Input sanitization:
   - reflected XSS-style payload check
   - SQLi-style payload handling check
   - excessive-length payload check
   - stored-vector create/readback check on issues endpoint
4. Dependency vulnerabilities (`npm audit --json` parsing)

## Notes

- If the target app is not reachable, findings are reported with `error` or
  `skip` status while still producing structured output.
- Authenticated checks are marked as `skip` when credentials are not supplied.
