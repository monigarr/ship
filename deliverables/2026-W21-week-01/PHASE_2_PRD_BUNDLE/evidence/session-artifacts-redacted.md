# Session Artifacts (Redacted From Git)

Cookie, CSRF, and session snapshot files in this folder are intentionally **not** committed because they can contain live `connect.sid`, `session_id`, or CSRF token values from local benchmark runs.

## Reviewer reproduction

1. Start API + DB locally and seed: `pnpm db:seed`
2. Log in via the web app or API and capture a session cookie for your environment
3. Re-run the benchmark commands documented in `../IMPROVEMENT_DOCUMENTATION.md` (C3/C4 sections)

Committed JSON/log artifacts in this directory remain valid for reviewing measurement outputs; only token-bearing cookie files are withheld.
