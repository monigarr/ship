# PRESEARCH

## Phase 1: Define Your Agent

### 1. Agent Responsibility Scoping

- **What events in Ship should the agent monitor proactively?**
  - Issue updates that introduce new blockers or long-running stale blockers.
  - Weekly plan and retro submissions with missing owners, weak outcomes, or missing evidence expectations.
  - Approval state transitions (approved, rejected, changes requested) that leave execution in limbo.
  - Compliance and verification records that indicate unresolved findings.
  - Time-threshold conditions (no standup, stale issue movement, overdue review windows).

- **What constitutes a condition worth surfacing?**
  - It has material impact on delivery confidence, review readiness, compliance posture, or near-term team decisions.
  - It has sufficient supporting evidence from Ship records or can be clearly labeled as a low-confidence signal.
  - It is role-actionable by a specific owner/manager/reviewer.

- **What is the agent allowed to do without human approval?**
  - Read and correlate project graph records.
  - Generate findings, severity, confidence, and recommended next actions.
  - Draft in-product notes and notification content.
  - De-duplicate or snooze low-severity repeat findings based on policy.

- **What must always require confirmation?**
  - Any state change to issue/project/week records.
  - Any approval or rejection action.
  - Compliance gate pass/fail decisions.
  - External notifications outside Ship.
  - Creation of work items that imply human commitment.

- **How does the agent know who is on a project?**
  - Project ownership and issue assignee relationships from `documents` and `document_associations`.
  - Membership and role context from workspace/person records.
  - Approval and activity signals for escalation fallback routing.

- **How does the agent know who to notify?**
  - Route by role and ownership in the current workspace and project graph.
  - Prefer direct owner and accountable reviewer first; escalate to manager/project owner if unresolved.
  - If role data is incomplete, lower confidence and route to the safest accountable owner.

- **How does the on-demand mode use context from the current view?**
  - It receives `document_id`, `document_type`, `workspace_id`, and user/session identity.
  - It fetches nearby graph context (related project/week/issues) and scopes responses to user-visible records.
  - It starts reasoning from the active entity rather than generic workspace-wide summaries.

### 2. Use Case Discovery (minimum 5)

1. **Role:** Engineering manager  
   **Trigger:** A blocker is open >24 hours with sprint end approaching  
   **Agent detects/produces:** Escalation-ready risk card with owner, age, dependencies, next action  
   **Human decides:** Escalate, reassign, split scope, or snooze

2. **Role:** Engineer/week owner  
   **Trigger:** Issue marked done but weekly retro lacks evidence links  
   **Agent detects/produces:** Evidence-gap checklist for replayability  
   **Human decides:** Attach evidence, revise retro, or request review

3. **Role:** Product/program manager  
   **Trigger:** Weekly plan submitted without measurable outcomes  
   **Agent detects/produces:** Plan quality finding and missing-measurement prompts  
   **Human decides:** Request changes or approve with note

4. **Role:** Security/compliance reviewer  
   **Trigger:** Compliance gate requested with unresolved findings  
   **Agent detects/produces:** Gate risk summary and blocked-by rationale  
   **Human decides:** Pass, block, or approve exception

5. **Role:** Team lead/director  
   **Trigger:** Multiple stale work items across project view  
   **Agent detects/produces:** Prioritized accountability digest by severity  
   **Human decides:** Sequence intervention and routing

6. **Role:** Any authorized user (on-demand)  
   **Trigger:** User opens embedded FleetGraph chat on issue/project/week  
   **Agent detects/produces:** Context-scoped explanation, risk summary, and suggested next action  
   **Human decides:** Follow recommendation or ask follow-up

### 3. Trigger Model Decision

- **Decision:** Hybrid trigger model (webhook + bounded polling + on-demand invocation).
- **Why not poll-only?**
  - Higher unnecessary run volume and cost.
  - Slower reaction for high-signal events.
- **Why not webhook-only?**
  - Misses time-threshold conditions and recovery from dropped events.
- **How stale is too stale?**
  - High-signal risk surfacing must stay under 5 minutes from event introduction.
- **Cost at 100/1,000 projects (design estimate):**
  - Poll lightweight metadata every 3 minutes for active projects.
  - Run deeper synthesis only when detectors flag actionable conditions.
  - Use event-first behavior to keep detection fast while controlling token spend.

## Phase 2: Graph Architecture

### 4. Node Design

- `triggerIntake`: webhook, polling tick, or on-demand request.
- `resolveContext`: identity, workspace, active document, and scope.
- `authorizeContext`: enforce request visibility and permissions.
- `fetchGraphData` (parallel): issues, plans/retros, approvals, blockers, compliance artifacts.
- `detectSignals`: deterministic checks for stale work, gaps, and risk conditions.
- `branchBySignal`: route to accountability/execution/evidence/compliance/no-op branches.
- `reasonAndPrioritize`: LLM synthesis only for actionable branches.
- `evaluateHITL`: guard protected actions.
- `writeOutputs`: findings, drafts, notifications, or approved actions.
- `recordTrace`: run metadata, branch path, latency, and token/cost metrics.

### 5. State Management

- **Per-run state:** trigger metadata, scoped entity, findings, branch decisions, proposed actions, run metrics.
- **Persistent state:** last scan cursor, dedupe fingerprints, unresolved findings, HITL decision history.
- **Redundant call prevention:** skip expensive reasoning when graph fingerprint is unchanged.

### 6. Human-in-the-Loop Design

- Required for protected write actions and approval-like decisions.
- Confirmation payload includes:
  - proposed action
  - supporting evidence
  - confidence/severity
  - impacted records
  - approve/reject rationale
- Rejected actions remain auditable and become part of the finding lifecycle.

### 7. Error and Failure Handling

- Ship API partial outage: continue with degraded confidence when possible; do not fabricate certainty.
- Authorization failure: return safe denial output and trace metadata.
- Model failure: still return deterministic detection summaries where available.
- Trace sink unavailable: continue run but mark as non-evidence run.
- Caching: short TTL for frequently changing issue/standup surfaces; dedupe keys for repeated scan conditions.

## Phase 3: Stack and Deployment

### 8. Deployment Model

- On-demand path runs in API request context.
- Proactive path runs in API-managed worker loop (configurable interval), optionally fed by webhooks.
- Service identity for proactive runs uses scoped credentials and workspace boundaries.
- No dependence on an active user session for proactive execution.

### 9. Performance

- **Latency strategy:** event-first path plus 3-minute poll safety net to remain under PRD 5-minute detection target.
- **Token budget strategy:** deterministic detectors before LLM calls; only actionable branches call model.
- **Cost cliff controls:** dedupe repeat findings, skip unchanged graph snapshots, and track per-branch run costs.
