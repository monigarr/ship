# Discovery Write-up (3 Required Discoveries)

## Discovery 1 - Unified document model with typed discriminators

- **Where found:** `api/src/routes/documents.ts` (routing/query handling around lines 38-116 and 505-537), `shared/src/**` (shared type contracts), `docs/unified-document-model.md`
- **What it does / why it matters:** Core entities (docs/issues/projects/weeks and added planning artifacts) share a single document-centric model with discriminator-driven behavior. This supports consistent linking, auditability, and cross-feature extensibility without table explosion.
- **How I would apply it:** In future products with mixed knowledge/work-tracking objects, I would use a shared document substrate with explicit discriminator schemas and strict route-level validation to preserve flexibility while avoiding polymorphic chaos.

## Discovery 2 - Collaboration server enforces layered abuse controls

- **Where found:** `api/src/collaboration/index.ts` (rate-limit/message-guard sections around lines 20-88 and message handling around line 338), `api/src/utils/normalize-client-ip.ts`
- **What it does / why it matters:** WebSocket collaboration path enforces connection/message limits, payload-size controls, and progressive penalties. It couples auth/session checks with runtime flood protection for both document and events channels.
- **How I would apply it:** I would treat real-time channels as first-class attack surfaces and ship explicit connection/message guardrails from day one rather than adding them after incidents.

## Discovery 3 - Security posture is measurable via a probe-first workflow

- **Where found:** `api/src/scripts/security-probe.ts` (surface definitions/report contract around lines 10-44, auth/websocket probe flows around lines 99-292), `docs/security-probe-tooling.md`, `prd_dev_branch_one/PRD_CAT8/security-probe-closeout-4.md`
- **What it does / why it matters:** The probe codifies auth/session, websocket, input sanitization, and dependency-audit checks into reproducible outputs (JSON/MD), enabling objective before/after verification for security remediations.
- **How I would apply it:** I would create attack-surface probes as part of CI acceptance criteria, with structured outputs and explicit reproduction steps so security reviews stay operational instead of opinion-based.
