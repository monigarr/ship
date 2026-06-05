# Client Deliverables Index

This directory is the client-verifiable audit trail for weekly PRD work. Product source stays in `api/`, `web/`, `shared/`, `e2e/`, `scripts/`, and `terraform/`.

| Week | Folder | Purpose |
| --- | --- | --- |
| 2026-W21 | [`2026-W21-week-01`](./2026-W21-week-01/) | Week-one PRD, audit, remediation, compliance, and evidence bundle formerly stored at `prd_dev_branch_one/`. |
| 2026-W22 | [`2026-W22-week-02`](./2026-W22-week-02/) | FleetGraph PRD, MVP/early-final/final deliverables, and Week 02 evidence. |
| 2026-W23 | [`2026-W23-week-03`](./2026-W23-week-03/) | PlugForge platform layer: OAuth, public API, webhooks, SDK, CLI, TTFE drill. |

## Operating Rules

- Put each new Monday PRD in a new `YYYY-Www-week-nn/` folder.
- Keep one `README.md` per week as the reviewer entry point.
- Commit summarized, sanitized evidence that proves the PRD.
- Keep generated coverage HTML, local logs, session cookies, and deployment ZIPs out of the committed repo unless the PRD explicitly requires them.
