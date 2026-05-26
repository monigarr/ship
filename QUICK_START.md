# FleetGraph Quick Start Manual Verification

Use this guide to manually test and visually confirm the FleetGraph features required by `PRD.md`.

Public app URL: `https://ship-web-jyqh.onrender.com/`

Estimated time: 15-25 minutes

---

## What You Will Verify

You will confirm all PRD-critical outcomes:

1. On-demand FleetGraph chat is embedded in Ship context (issue/project/week), not a standalone bot.
2. Proactive FleetGraph finds and surfaces a risk condition without a user prompt.
3. Human-in-the-loop (HITL) approval is required for protected actions.
4. Runtime evidence exists (findings/traces/metrics endpoints).
5. Detection latency can be verified as under 5 minutes.

---

## Prerequisites

Before starting:

- You can log in to Ship at `https://ship-web-jyqh.onrender.com/`.
- You have access to at least one workspace with issue/project/week data.
- You can open browser DevTools (Network tab), if needed.

Optional but recommended:

- Open `FLEETGRAPH_EVIDENCE_INDEX.md` in your editor while testing so you can cross-check run IDs and evidence fields.

---

## Step 1 - Confirm Context-Embedded On-Demand Mode

Goal: Verify FleetGraph can be invoked from existing Ship context and reasons from that context.

1. In Ship, open an **Issue** view.
2. Open the FleetGraph assistant panel from the sidebar in the current view.
3. Ask a context-bound prompt, such as:
   - "What should happen next for this issue?"
4. Confirm the response references the current issue context (dependencies, owner, sprint timing, evidence status, blockers, etc.).

Pass if:

- The assistant is embedded in the current Ship view (not a separate chatbot page).
- The response is specific to the currently opened entity.

Repeat quickly in **Project** or **Week** view and verify responses shift to that view's context.

---

## Step 2 - Confirm Proactive Mode Surfaces Findings

Goal: Verify FleetGraph can surface findings without manual prompt.

1. Create or locate a condition likely to trigger detection (examples):
   - stale blocker
   - missing evidence on a completed issue
   - overdue or weak weekly artifact
2. Wait for proactive processing (or use the trigger path if available in your environment).
3. Check Ship UI surfaces where findings/notifications appear.

Pass if:

- A new FleetGraph finding appears without asking chat to run.
- The finding includes useful risk reasoning (not just raw data).

---

## Step 3 - Confirm HITL Gate on Protected Actions

Goal: Verify FleetGraph requests explicit human approval for protected changes.

1. From a finding or assistant flow, choose an action that would change status/ownership/approval/compliance outcome.
2. Confirm FleetGraph presents a human approval gate rather than auto-applying.
3. Verify the prompt includes:
   - rationale
   - supporting evidence
   - explicit decision controls (approve/reject or equivalent)

Pass if:

- Protected action requires human confirmation before execution.

---

## Step 4 - Confirm Runtime Evidence Endpoints

Goal: Verify trace and telemetry surfaces are accessible.

Open these in browser while authenticated:

- `https://ship-web-jyqh.onrender.com/api/fleetgraph/findings`
- `https://ship-web-jyqh.onrender.com/api/fleetgraph/traces`
- `https://ship-web-jyqh.onrender.com/api/fleetgraph/metrics`

Pass if:

- Endpoints respond successfully with recent FleetGraph run data.
- You can identify at least one recent finding and at least two distinct trace runs.

---

## Step 5 - Run the Latency Check (< 5 Minutes)

Goal: Verify PRD detection latency target.

1. Introduce (or identify) a known trigger condition at time `T0`.
2. Record `T0` (clock start).
3. Wait for the corresponding proactive finding to appear in UI or `/api/fleetgraph/findings`.
4. Record `T1` when surfaced.
5. Compute latency = `T1 - T0`.

Pass if:

- Latency is less than 5 minutes.

Tip:

- If available in your environment, webhook-triggered proactive runs can provide faster and easier timing evidence.

---

## Step 6 - Confirm PRD-Level Completion Signals

Use this checklist as final signoff:

- [ ] Proactive mode works end-to-end.
- [ ] On-demand mode works from in-context Ship views.
- [ ] Same FleetGraph architecture supports both triggers.
- [ ] HITL gate protects sensitive actions.
- [ ] Real Ship data is used (not mock-only responses).
- [ ] At least two divergent trace runs exist.
- [ ] Detection latency evidence is under 5 minutes.
- [ ] UI visibly exposes chat and proactive findings.

If all items are checked, the manual verification package is ready for PRD review.

---

## Troubleshooting

- No findings appear:
  - Verify test data actually matches a detector condition.
  - Wait one poll interval if scheduler-based proactive mode is active.
- Chat feels generic:
  - Re-open from a specific issue/project/week page and retry.
- Missing traces:
  - Execute at least two different run paths (for example, on-demand and proactive) and refresh traces endpoint.
