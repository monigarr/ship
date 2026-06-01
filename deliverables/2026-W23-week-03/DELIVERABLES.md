# Week 03 Deliverables (High Level)

Source of truth: `deliverables/2026-W23-week-03/PRD.md`

## Required Deliverables

- **Architectural Defense checkpoint** delivered by Monday 1:00 PM CT.
- **MVP checkpoint** delivered by Tuesday 11:59 PM CT (all MVP hard-gate items complete).
- **Early Submission checkpoint** delivered by Friday 11:59 PM CT.
- **Final Submission checkpoint** delivered by Sunday 11:59 AM CT.

- **GitHub repository submission** that is public, preserves per-slice branches, and includes PR descriptions mapped to acceptance criteria with fitness-test confirmation.
- **Demo video (3-5 minutes)** showing the five-line developer story (`pnpm install @ship/sdk` -> `ship login` -> `ship docs create` -> `ship webhooks tail`) plus replay in the developer portal.
- **Pre-Search document** with all three phases completed, including attached AI conversation artifact.
- **Architecture document** (`docs/architecture.md`, 1-2 pages) covering module layout, SOLID rationale, composition root, boundary/flow diagrams, SDK surface, failure modes, and agent-as-citizen design.
- **OpenAPI specification deliverables**: live spec at `/api/v1/openapi.json` on deployed instance and static copy at `docs/openapi.json`, validated against OpenAPI schema.
- **AI cost analysis** including development spend, production projections table, and explicit assumptions (webhook fanout, agent active rate, storage retention).
- **Per-epic write-up** using before -> fix -> after -> proof format, including TTFE CI proof for Epic 6 and OAuth app audit-log proof for Epic 7.
- **Three discoveries** documented from implementation learnings.
- **Deployed application** with public URL, pre-registered read-only OAuth app for graders, README credentials, reachable dev portal, and resolvable OpenAPI spec.
- **Social post** tagging `@GauntletAI`, with screenshot of verified signed event in `ship webhooks tail`.

## Build/Scope Completion Expectations Tied to Submission

- **Implement all MVP hard-gate requirements** (OAuth + PKCE, token middleware, scoped `/api/v1` routes, consistent ApiError shape, generated OpenAPI, SDK skeleton, regression/perf guardrails, public deployment).
- **Implement at least 5 integration/flow items** from the PRD list, including the **CLI device-flow tool as must-ship**.
- **Pass required testing scenarios**, including negative OAuth cases, route/spec/SDK fitness checks, webhook retry/DLQ/replay behavior, and TTFE drill outcomes.
