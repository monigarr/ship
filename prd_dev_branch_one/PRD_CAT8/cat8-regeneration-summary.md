# Category 8 Regeneration Summary

Generated: 2026-05-21

## Tooling Consolidation

- Added runnable probe script: `api/src/scripts/security-probe.ts`
- Wired root command: `pnpm security:probe`
- Added API script binding: `pnpm --filter @ship/api security:probe`
- Added usage doc: `docs/security-probe-tooling.md`

## Probe Run Evidence

- Run log: `security-probe-run.log`
- Structured JSON report: `security-probe-report.json`
- Structured markdown report: `security-probe-report.md`
- Closeout run log: `security-probe-closeout.log`
- Closeout JSON report: `security-probe-closeout.json`
- Closeout markdown report: `security-probe-closeout.md`
- Dependency audit raw output: `pnpm-audit-closeout.log`

Result snapshot:

- Probe executed successfully as a command.
- Closeout probe executed against live local API (`http://localhost:3000`) with auth/session and websocket unauth checks passing.
- Dependency audit parsing is now integrated into probe output, surfacing high/critical advisories in structured findings.

## Manual Review Snapshot (code-level)

- CORS and CSP configuration present in `api/src/app.ts` (`helmet` and `cors` usage).
- Rate limiting present in `api/src/app.ts` (`loginLimiter`, `apiLimiter`).
- Error responses are predominantly normalized to `Internal server error` across routes.
- Secret handling still depends on runtime env controls; no Cat8 manual secret-exposure rerun artifact was produced in this pass.

## Vulnerability Fix Requirement Status

Current status: **not yet fully closed** in this regeneration pass.

Reason:

- The Cat8 PRD requires at least 2 verified vulnerability fixes with before/after proof.
- This pass establishes runnable tooling, live probe execution, and structured dependency/security findings, but does not yet include two fully verified, environment-replayed before/after fix bundles.
