# 5. TypeScript Patterns

### 5.0 Area overview

- Status: [X] Complete
- Prompt: TypeScript deep-dive summary for sections 5.1-5.5.
- Findings:
  - The monorepo uses a strict TypeScript baseline and shares contracts through `@ship/shared`.
  - Both frontend and backend are fully TypeScript-based, with package-level `tsconfig` specializations.
  - The codebase leans heavily on unions, generics, and `Partial<>`, with explicit type guards in key runtime parsing paths.
- Evidence (toolchain and package structure):
  - `d:\GFA_Cohort_5\Week_Four\ship\package.json`
  - `d:\GFA_Cohort_5\Week_Four\ship\tsconfig.json`
  - `d:\GFA_Cohort_5\Week_Four\ship\pnpm-workspace.yaml`
- Open Questions:
  - Should lint rules enforce consistent usage of shared DTOs to reduce local interface drift?
- Next Actions:
  - Add a recurring type-contract drift check between `web/api` and `shared`.

### 5.1 TypeScript version

- Status: [X] Complete
- Prompt: What TypeScript version is the project using?
- Findings:
  - TypeScript dependency is `^5.7.2` in root, API, and web package manifests (shared by workspace tooling).
  - Build/type-check scripts in all packages use `tsc`, so this version is the active compiler baseline.
- Evidence (`package.json`, lockfile, toolchain):
  - `d:\GFA_Cohort_5\Week_Four\ship\package.json`
  - `d:\GFA_Cohort_5\Week_Four\ship\api\package.json`
  - `d:\GFA_Cohort_5\Week_Four\ship\web\package.json`
  - `d:\GFA_Cohort_5\Week_Four\ship\pnpm-lock.yaml`
- Open Questions:
  - Is there a planned cadence for TS minor-version upgrades tied to CI compatibility checks?
- Next Actions:
  - Document TS upgrade policy and add a compatibility smoke-check checklist.

### 5.2 `tsconfig.json` and strict mode

- Status: [X] Complete
- Prompt: What are the `tsconfig.json` settings? Is strict mode on?
- Findings:
  - Strict mode is enabled at root (`strict: true`) and inherited by package configs.
  - Root config additionally enforces `noUncheckedIndexedAccess`, `noImplicitReturns`, and `noFallthroughCasesInSwitch`.
  - Package configs:
    - `api`: extends root, NodeNext build output in `dist`, path alias to `../shared/dist`.
    - `web`: strict + noEmit, bundler module resolution, JSX React, path alias `@/*`, project reference to `../shared`.
    - `shared`: composite library output for cross-package consumption.
- Evidence (`tsconfig` keys and values):
  - `d:\GFA_Cohort_5\Week_Four\ship\tsconfig.json`
  - `d:\GFA_Cohort_5\Week_Four\ship\api\tsconfig.json`
  - `d:\GFA_Cohort_5\Week_Four\ship\web\tsconfig.json`
  - `d:\GFA_Cohort_5\Week_Four\ship\shared\tsconfig.json`
- Open Questions:
  - Should `exactOptionalPropertyTypes` be enabled to tighten optional-shape semantics in shared contracts?
- Next Actions:
  - Run a trial branch enabling one additional strictness flag and measure fallout/fix cost.

### 5.3 Shared type contracts across frontend/backend

- Status: [X] Complete
- Prompt: How are types shared between frontend and backend (the `shared/` package)?
- Findings:
  - `@ship/shared` provides shared domain contracts (document types/unions/interfaces, auth/session constants, error/status constants).
  - Frontend consumes shared types directly as a workspace dependency.
  - Backend resolves shared types via `tsconfig` path mapping to compiled `../shared/dist`, requiring shared build artifacts.
  - Contract examples include `BelongsTo`, `CascadeWarning`, document unions, and session timeout constants consumed by middleware/routes.
- Evidence (import chains, build/alias config):
  - `d:\GFA_Cohort_5\Week_Four\ship\shared\src\types\document.ts`
  - `d:\GFA_Cohort_5\Week_Four\ship\web\package.json`
  - `d:\GFA_Cohort_5\Week_Four\ship\api\package.json`
  - `d:\GFA_Cohort_5\Week_Four\ship\web\tsconfig.json`
  - `d:\GFA_Cohort_5\Week_Four\ship\api\tsconfig.json`
- Open Questions:
  - Should API response envelope types (`ApiResponse`) be adopted more consistently across route handlers?
- Next Actions:
  - Add type-level contract tests covering key shared API payload shapes.

### 5.4 Pattern examples in code

- Status: [X] Complete
- Prompt: Find examples of generics, discriminated unions, utility types (`Partial`, `Pick`, `Omit`), and type guards in the codebase.
- Findings:
  - Generics:
    - `useSelection<T>(...)` generic hook for reusable selection behavior.
    - `SelectableList<T extends { id: string }>` generic component.
    - `request<T>(...)` typed API response helper.
  - Discriminated unions:
    - `DocumentType` union and typed `*Document` variants in shared contracts.
    - UI branching on `document.document_type` in `UnifiedEditor`.
  - Utility types:
    - `Partial<Issue>`, `Partial<UnifiedDocument>`, and other `Partial<>` usage are common in update workflows.
    - No direct `Pick<>`/`Omit<>` utility-type usage found in current source scan.
  - Type guards:
    - `isCascadeWarningError(error): error is CascadeWarningError`.
    - `isValidRelationshipType(value): value is RelationshipType`.
    - `isValidIconName(name): name is IconName`.
- Evidence (file paths for each pattern type):
  - `d:\GFA_Cohort_5\Week_Four\ship\web\src\hooks\useSelection.ts`
  - `d:\GFA_Cohort_5\Week_Four\ship\web\src\components\SelectableList.tsx`
  - `d:\GFA_Cohort_5\Week_Four\ship\web\src\lib\api.ts`
  - `d:\GFA_Cohort_5\Week_Four\ship\shared\src\types\document.ts`
  - `d:\GFA_Cohort_5\Week_Four\ship\web\src\components\UnifiedEditor.tsx`
  - `d:\GFA_Cohort_5\Week_Four\ship\web\src\hooks\useIssuesQuery.ts`
  - `d:\GFA_Cohort_5\Week_Four\ship\api\src\routes\associations.ts`
  - `d:\GFA_Cohort_5\Week_Four\ship\web\src\components\icons\uswds\types.ts`
- Open Questions:
  - Is absence of `Pick`/`Omit` intentional style guidance, or just current organic evolution?
- Next Actions:
  - Decide whether to codify a utility-type style guide (`Partial` vs `Pick/Omit` usage criteria).

### 5.5 Unknown pattern research

- Status: [X] Complete
- Prompt: Are there any patterns you do not recognize? Research them.
- Findings:
  - Pattern researched: Yjs protocol framing via `y-protocols` + `lib0` encoder/decoder in collaboration server.
  - What it is:
    - Low-level binary protocol handling (`messageSync`, `messageAwareness`, custom message codes) for incremental CRDT sync and awareness transport.
  - Why it matters:
    - This pattern avoids full-document payloads, supports efficient delta sync, and enables deterministic convergence under concurrent edits.
  - Related advanced pattern:
    - Bidirectional conversion between Yjs XML structures and TipTap JSON (`yjsToJson`/`jsonToYjs`) to bridge collaborative and REST/read models.
- Evidence (pattern name, source, short explanation):
  - Pattern name: Yjs sync/awareness protocol framing and conversion bridge
  - Source files:
    - `d:\GFA_Cohort_5\Week_Four\ship\api\src\collaboration\index.ts`
    - `d:\GFA_Cohort_5\Week_Four\ship\api\src\utils\yjsConverter.ts`
    - `d:\GFA_Cohort_5\Week_Four\ship\docs\claude-reference\modules\collaboration.md`
- Open Questions:
  - Should protocol constants and message-type handling be extracted into dedicated typed protocol modules?
- Next Actions:
  - Add internal docs for custom message codes (`3`, `4100`, `4101`, `4403`) and intended client behavior.
