# Brownfield Engineering Notes

**Purpose:** Explain how to improve the Ship monorepo without disrespecting or destabilizing its existing architecture.  
**Audience:** reviewers, future maintainers, and engineers joining the codebase.  
**Core principle:** preserve what works, measure what hurts, and change only what earns its risk.

---

## 30-Second Read

This codebase should not be treated like a greenfield rebuild.

It is a production-style brownfield system with useful existing decisions:

- a unified document model
- shared TypeScript contracts
- server-authoritative collaboration
- mature infrastructure choices
- significant automated test investment

The best engineering posture is disciplined modernization, not architectural replacement.

---

## Why Brownfield Discipline Matters Here

The PRD asks for the real work production engineers do: inherit a system, understand it, measure it, diagnose it, and improve it with proof.

That is different from starting over.

In a brownfield codebase, the first rule is:

> Existing code represents product knowledge, operational constraints, and prior tradeoffs. Understand those before replacing anything.

The Phase 1 audit followed that rule by measuring before recommending fixes.

---

## Architectural Decisions Worth Preserving

### 1. Unified Document Model

The repository uses a single document abstraction for docs, issues, projects, and sprints.

This is not automatically a problem. It provides:

- one consistent domain vocabulary
- flexible workflow composition
- simpler cross-document references
- fewer duplicated tables and services
- easier onboarding once the pattern is understood

Tradeoff:

- queries can become more complex
- indexes need to match discriminator-heavy access patterns
- type contracts must stay disciplined

Recommended posture:

- preserve the model
- improve query/index strategy
- strengthen type contracts around document variants

---

### 2. Shared Type Contracts

The `shared/` package is a strong foundation.

It helps prevent drift between:

- frontend request/response assumptions
- backend route behavior
- collaboration data structures
- domain models

Recommended posture:

- extend shared types where useful
- avoid duplicating route contracts in scattered files
- use shared contracts to reduce unsafe API assertions

---

### 3. Server-Authoritative Collaboration

The app is offline-tolerant while remaining server-authoritative.

This is a sensible production tradeoff because it balances:

- user experience during temporary disconnects
- conflict convergence through Yjs/CRDT behavior
- server-side persistence and authority
- collaboration consistency

Recommended posture:

- improve tests and failure-state UX
- do not casually replace collaboration primitives
- validate offline/reconnect and dual-user convergence with regression tests

---

### 4. Boring Technology Choices

The stack uses broadly understood technologies:

- React
- Vite
- Express
- PostgreSQL
- Docker
- Terraform
- Playwright
- TypeScript

That is a strength.

Recommended posture:

- avoid introducing new tools unless they measurably reduce risk
- optimize existing choices first
- keep Phase 2 fixes understandable to future maintainers

---

## Areas That Need Modernization, Not Replacement

| Area | Brownfield-Friendly Fix |
|---|---|
| API route type assertions | Introduce typed helpers, guards, and shared contracts. |
| Bundle size | Add lazy loading and remove eager imports; keep features intact. |
| Search query scaling | Add targeted indexing/search strategy; preserve document model. |
| E2E instability | Stabilize fixtures and known clusters; do not discard the suite. |
| Accessibility gaps | Fix serious issues and workflow semantics; preserve design intent. |
| Runtime edge cases | Improve error states and boundaries; avoid broad rewrites. |

---

## What Not To Do

Avoid these common brownfield mistakes:

| Anti-Pattern | Why It Is Risky |
|---|---|
| Rewrite major systems without proof | High regression risk and weak PRD alignment. |
| Replace `any` with `unknown` without narrowing | Looks better but does not improve correctness. |
| Delete features to reduce bundle size | PRD explicitly disallows removing functionality to shrink bundle. |
| Add tests that only assert pages load | Does not mitigate real regression risk. |
| Chase every small issue equally | Dilutes time away from high-risk remediation. |
| Add new infrastructure tools prematurely | Increases maintenance burden without guaranteed value. |

---

## Brownfield Improvement Principles

### 1. Measure First

Every meaningful change needs a baseline.

Before changing code, know:

- what metric is being improved
- how it was measured
- what command reproduces it
- what artifact proves it

### 2. Preserve Behavior

Functionality must remain intact.

When changing type safety, bundle structure, query behavior, or accessibility markup, preserve:

- response shape
- user workflows
- collaboration behavior
- visual intent where possible
- existing passing tests

### 3. Reduce Blast Radius

Prefer small, targeted improvements.

Examples:

- one endpoint latency branch
- one route-cluster type-safety branch
- one accessibility branch for serious violations
- one bundle-splitting branch

### 4. Document Tradeoffs

Every Phase 2 fix should explain:

- what was suboptimal
- why the fix is better
- what tradeoff was accepted
- what was intentionally not changed

### 5. Keep Maintainers In Mind

A fix is only good if a future engineer can understand it.

Prefer:

- clear helper names
- typed contracts
- short comments only where they explain risk
- commit messages that explain intent
- evidence stored with the repo

---

## Reviewer-Facing Brownfield Narrative

A strong summary for this project:

> The audit found a system with sound architecture and concentrated operational risks. The best improvement path is not replacement; it is measured hardening of API type boundaries, frontend load behavior, collaboration reliability, accessibility parity, and query scalability.

This framing shows respect for the existing system and demonstrates senior engineering judgment.

---

## Final Note

Brownfield engineering is not about doing less.

It is about changing only what you understand, proving that the change helped, and preserving the product knowledge already embedded in the system.

That is the posture most aligned with the PRD and with real production engineering work.
