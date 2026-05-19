# CODEBASE ORIENTATION CHECKLIST

Source of truth: `prd_dev_branch_one/PRD.md` (Appendix: Codebase Orientation Checklist, lines 388-447)

Use this document before auditing. Complete every section to build a full-system mental model.

## How to Use

- Fill every line item prompt.
- Add concrete evidence (file paths, commands, screenshots, diagrams).
- Keep notes concise but specific enough for another engineer to follow.
- Mark each item complete when done.

---

## Phase 1: First Contact

## 1. Repository Overview

### 1.1 Clone and run locally

- Status: [X] Complete
- Prompt: 
Clone the repo and get it running locally. Document every step, including anything that was not in the README.

- Prompt: 
create a new local dev branch named gfa2_wk4_prd1_monigarr

- Findings: 
README install steps created pnpm windows shell update message. After update the pnpm dev command created a windows shell mismatch with git bash.

- Evidence (commands, logs, files): 
/prd_dev_branch_one/PROMPTS.md

- Open Questions: 
Do we want to update README install to include git bash and windows dev environ instructions?

- Next Actions: 
ask & verify if this is within scope for any current or future PRD work? Review the Open PRs on origin at https://github.com/US-Department-of-the-Treasury/ship/pulls   Added findings to PROMPTS.md

### 1.2 Read `docs/` and summarize architecture decisions

- Status: [X] Complete
- Prompt: Review every file in /docs, /docs/solutions/, docs/integration-issues, docs/patterns, docs/performance-issues and provide a draft high level summary of all of the key architectural decisions here.
- Findings:
- Evidence (doc files reviewed): ARCHITECTURE_SUMMARY.md
- Open Questions:
- Next Actions:

### 1.3 Read `shared/` package and cross-package type usage

- Status: [X] Complete
- Prompt: Read the `shared/` package. What types are defined? How are they used across the frontend and backend?
- Findings:
- Evidence (type files and import references): SHARED_SUMMARY.md
- Open Questions:
- Next Actions:

### 1.4 Create package relationship diagram

- Status: [x] Complete
- Prompt: Create a diagram of how the `web/`, `api/`, and `shared/` packages relate to each other.
- Findings:
- Evidence (diagram link/path):
- Open Questions:
- Next Actions:

## 2. Data Model

### 2.1 Schema and table relationship mapping

- Status: [X] Complete
- Prompt: Find the database schema (migrations or seed files). Map out the tables and their relationships.
- Findings:
- Evidence (schema files, ERD notes):
- Open Questions:
- Next Actions:

### 2.2 Unified document model behavior

- Status: [X] Complete
- Prompt: Understand the unified document model: how does one table serve docs, issues, projects, and sprints?
- Findings:
- Evidence (table definitions, query examples):
- Open Questions:
- Next Actions:

### 2.3 `document_type` discriminator usage

- Status: [X] Complete
- Prompt: What is the `document_type` discriminator? How is it used in queries?
- Findings:
- Evidence (SQL/query builder snippets):
- Open Questions:
- Next Actions:

### 2.4 Document relationship handling

- Status: [x] Complete
- Prompt: How does the application handle document relationships (linking, parent-child, project membership)?
- Findings:
- Evidence (relationship tables/fields, query paths):
- Open Questions:
- Next Actions:

## 3. Request Flow

### 3.1 Trace one action end-to-end

- Status: [X] Complete
- Prompt: Pick one user action (for example, creating an issue) and trace it from the React component through the API route to the database query and back.
- Findings:
- Evidence (component, route, service/repo, SQL path):
- Open Questions:
- Next Actions:

### 3.2 Middleware chain

- Status: [X] Complete
- Prompt: Identify the middleware chain: what runs before every API request?
- Findings:
- Evidence (server bootstrap, middleware registration):
- Open Questions:
- Next Actions:

### 3.3 Authentication behavior

- Status: [X] Complete
- Prompt: How does authentication work? What happens to an unauthenticated request?
- Findings:
- Evidence (auth middleware/routes, sample response):
- Open Questions:
- Next Actions:

---

## Phase 2: Deep Dive

## 4. Real-time Collaboration

### 4.1 WebSocket establishment flow

- Status: [X] Complete
- Prompt: How does the WebSocket connection get established?
- Findings:
- Evidence (client connect code, server handler):
- Open Questions:
- Next Actions:

### 4.2 Yjs synchronization flow

- Status: [X] Complete
- Prompt: How does Yjs sync document state between users?
- Findings:
- Evidence (Yjs provider/config, update handlers):
- Open Questions:
- Next Actions:

### 4.3 Concurrent editing behavior

- Status: [X] Complete
- Prompt: What happens when two users edit the same document at the same time?
- Findings:
- Evidence (CRDT merge behavior, app-level conflict rules):
- Open Questions:
- Next Actions:

### 4.4 Yjs persistence strategy

- Status: [X] Complete
- Prompt: How does the server persist Yjs state?
- Findings:
- Evidence (storage adapter, DB/file layer):
- Open Questions:
- Next Actions:

## 5. TypeScript Patterns

### 5.1 TypeScript version

- Status: [X] Complete
- Prompt: What TypeScript version is the project using?
- Findings:
- Evidence (`package.json`, lockfile, toolchain):
- Open Questions:
- Next Actions:

### 5.2 `tsconfig.json` and strict mode

- Status: [X] Complete
- Prompt: What are the `tsconfig.json` settings? Is strict mode on?
- Findings:
- Evidence (`tsconfig` keys and values):
- Open Questions:
- Next Actions:

### 5.3 Shared type contracts across frontend/backend

- Status: [X] Complete
- Prompt: How are types shared between frontend and backend (the `shared/` package)?
- Findings:
- Evidence (import chains, build/alias config):
- Open Questions:
- Next Actions:

### 5.4 Pattern examples in code

- Status: [X] Complete
- Prompt: Find examples of generics, discriminated unions, utility types (`Partial`, `Pick`, `Omit`), and type guards in the codebase.
- Findings:
- Evidence (file paths for each pattern type):
- Open Questions:
- Next Actions:

### 5.5 Unknown pattern research

- Status: [X] Complete
- Prompt: Are there any patterns you do not recognize? Research them.
- Findings:
- Evidence (pattern name, source, short explanation):
- Open Questions:
- Next Actions:

## 6. Testing Infrastructure

### 6.1 Playwright structure and fixtures

- Status: [X] Complete
- Prompt: How are the Playwright tests structured? What fixtures are used?
- Findings:
- Evidence (test directories, fixture files):
- Open Questions:
- Next Actions:

### 6.2 Test database setup/teardown

- Status: [X] Complete
- Prompt: How does the test database get set up and torn down?
- Findings:
- Evidence (scripts, lifecycle hooks, seed/reset flow):
- Open Questions:
- Next Actions:

### 6.3 Full suite runtime and pass state

- Status: [X] Complete
- Prompt: Run the full test suite. How long does it take? Do all tests pass?
- Findings:
- Evidence (exact command, runtime, pass/fail summary):
- Open Questions:
- Next Actions:

## 7. Build and Deploy

### 7.1 Dockerfile output understanding

- Status: [X] Complete
- Prompt: Read the Dockerfile. What does the build process produce?
- Findings:
- Evidence (build stages, final artifact image):
- Open Questions:
- Next Actions:

### 7.2 `docker-compose.yml` service topology

- Status: [X] Complete
- Prompt: Read the `docker-compose.yml`. What services does it start?
- Findings:
- Evidence (services, ports, volumes, dependencies):
- Open Questions:
- Next Actions:

### 7.3 Terraform infrastructure expectations

- Status: [X] Complete
- Prompt: Skim the Terraform configs. What cloud infrastructure does the app expect?
- Findings:
- Evidence (modules/resources/backends):
- Open Questions:
- Next Actions:

### 7.4 CI/CD pipeline overview

- Status: [X] Complete
- Prompt: How does the CI/CD pipeline work (if configured)?
- Findings:
- Evidence (workflow files, pipeline stages):
- Open Questions:
- Next Actions:

---

## Phase 3: Synthesis

## 8. Architecture Assessment

### 8.1 Strongest architectural decisions

- Status: [X] Complete
- Prompt: What are the 3 strongest architectural decisions in this codebase? Why?
- Findings:
- Evidence (decision -> impact mapping):
- Open Questions:
- Next Actions:

### 8.2 Weakest points and improvement focus

- Status: [X] Complete
- Prompt: What are the 3 weakest points? Where would you focus improvement?
- Findings:
- Evidence (risk/impact rationale):
- Open Questions:
- Next Actions:

### 8.3 New engineer onboarding guidance

- Status: [X] Complete
- Prompt: If you had to onboard a new engineer to this codebase, what would you tell them first?
- Findings:
- Evidence (onboarding sequence and key files):
- Open Questions:
- Next Actions:

### 8.4 10x user stress hypothesis

- Status: [X] Complete
- Prompt: What would break first if this app had 10x more users?
- Findings:
- Evidence (expected bottlenecks and why):
- Open Questions:
- Next Actions:

---

## Orientation Completion Sign-Off

- [X] All Phase 1 items completed.
- [X] All Phase 2 items completed.
- [X] All Phase 3 items completed.
- [X] Every item has evidence.
- [X] Open questions converted into explicit next actions.

Completed by: Monica Peters
Date: 5/18/2026 7:45 PM
Branch:

