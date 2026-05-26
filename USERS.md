# FleetGraph — USERS

## 1. Target Users and Profiles
- Primary: Engineering managers / directors / team leads
  - Focus: accountability, approvals, team visibility
- Primary: Individual engineers / week owners / IC contributors
  - Focus: planning, execution, retros, evidence
- Secondary: Product managers / program managers / operations PMs
  - Focus: hypothesis quality, prioritization, cross-program visibility
- Secondary: Security/compliance reviewers / QA leads / technical auditors
  - Focus: verification artifacts, security proof, gate checks

---

## 2. User Profiles

### Engineering Director / Engineering Manager / Team Lead
- Responsibilities: approve plans / retros / hypotheses, monitor execution health, coach quality, enforce accountability cadence
- Concerns: work happening without clear commitments, missing retros, weak evidence, hidden slippage, inconsistent review standards
- Pain points: fragmented updates across tools, unclear ownership, “activity” instead of outcomes, surprise misses late in cycle
- Use cases: accountability grid review, week/project approval workflows, rating retros, handling overdue items, 1:1 prep with concrete signals

---

### Software Engineer / Week Owner / IC Contributor
- Responsibilities: write weekly plans, execute issues, produce retros with proof, keep standups current, improve delivery predictability
- Concerns: unclear expectations for “good” plan quality, rework from vague submissions, proving completion quickly, balancing execution vs documentation
- Pain points: ambiguity around what counts as done, friction in accountability handoffs, missing templates / guardrails, feedback loops too late
- Use cases: create verifiable weekly commitments, attach evidence artifacts, respond to change requests, track completion against planned outcomes

---

### Product Manager / Program Manager / Operations PM
- Responsibilities: define and validate hypotheses, align programs / projects / weeks, track impact metrics and execution quality
- Concerns: priorities not tied to measurable outcomes, weak business-case rigor, inability to compare planned vs delivered value
- Pain points: roadmap intent not connected to delivery evidence, hard to detect drift early, subjective “partial success” narratives
- Use cases: project hypothesis review, ICE-informed prioritization, retro-based decision-making, cross-program status and investment visibility

---

### Security / Compliance Reviewer / QA Lead / Technical Auditor
- Responsibilities: validate risk posture, verify remediation proof, ensure reproducible quality gates and artifact traceability
- Concerns: unresolved CVEs, weak probe coverage, non-reproducible checks, undocumented exceptions, supply-chain risk
- Pain points: manual audit overhead, inconsistent evidence packaging, hard-to-replay security tests, drift between docs and actual controls
- Use cases: run security probe / compliance CLI, inspect before / after evidence bundles, confirm CI gates, review remediation closeout reports

---

## 3. Core Needs
- Clear accountability and approval signals for managers
- Verifiable commitment and evidence flow for engineers
- Hypothesis rigor and prioritization clarity for PMs
- Reproducible audit trails and security proof for reviewers

---

## 4. Use Cases

### UC1 — Manager Accountability Review
- Moment: weekly planning and approval cycle
- Need: visible commitment, status, and risk signals
- Why AI: surfaces weak plans, overdue items, and review gaps
- Success: aligned team approvals and on-time handoffs

---

### UC2 — Engineer Execution + Evidence
- Moment: end-of-week delivery and retro preparation
- Need: proof-backed completion, clearly scoped work, current standups
- Why AI: reduces uncertainty about what counts as done and what evidence exists
- Success: completed outcomes with traceable artifacts

---

### UC3 — PM Hypothesis Validation
- Moment: planning and cross-program alignment
- Need: business case quality, measurable outcomes, prioritization clarity
- Why AI: compares hypotheses and execution evidence across programs
- Success: decisions based on expected impact and delivery confidence

---

### UC4 — Compliance / Security Verification
- Moment: audit, gate review, or security check
- Need: reproducible evidence, documented controls, remediation closure
- Why AI: organizes proof artifacts and highlights missing checks
- Success: clear, replayable verification with traceable artifacts

---

## 5. UX Entry
- Location: accountability and planning workspace
- Trigger: review plan / submit retro / inspect evidence bundle / run compliance check
- Latency: fast enough to keep weekly cadence moving

---

## 6. Trust Expectations
- Always surface evidence and traceability
- Never overclaim impact or completion
- Show uncertainty and gaps clearly
- Respect review and audit workflows

---

## 7. Out of Scope Users
- General administrative staff not involved in delivery decisions
- External customers who do not participate in planning or verification

---

## 8. Short Answer: Director, PM, Engineer, Something Else?
It is not a single persona. This branch work clearly supports a multi-role operating model:
- Director / Manager for accountability governance
- Engineer for execution + evidence production
- PM / Program lead for hypothesis and prioritization quality
- Auditor / Reviewer for compliance / security verification

---

## 9. Document Control
Version: 1.1