# SentinelBrief — PRD

## 0. Executive Summary
SentinelBrief is an AI-first, verification-bound briefing system embedded inside a legacy enterprise CRM used by government case workers. It delivers a 30–60 second situational briefing on a citizen record before interaction.

The system prioritizes accuracy over completeness. It extracts only bounded, relevant data through controlled tools, verifies all claims before display, and surfaces uncertainty explicitly.

Success is defined as reducing pre-interaction cognitive load while maintaining zero tolerance for unverified claims.

---

## 1. Problem Definition
Case workers must quickly understand a citizen’s history across fragmented records before engaging. Current workflows require scanning multiple tabs, leading to missed context and errors.

---

## 2. Target User
- Role: Government case worker
- Environment: Legacy CRM (monolithic)
- Constraint: <60 seconds before interaction
- Workflow moment: Immediately after opening a citizen record

---

## 3. Core Use Cases

| ID | Use Case | Moment | Why Agent |
|----|----------|--------|----------|
| UC1 | “Who is this person?” | Record open | Requires synthesized narrative |
| UC2 | “What changed recently?” | Pre-engagement | Needs dynamic filtering |
| UC3 | “What should I verify?” | Before action | Contextual suggestions |

---

## 4. Requirements

### Functional
- Generate briefing summary
- Surface recent changes
- Provide verification checklist

### Non-Functional
- Latency: <5s
- Security: role-based access only
- Observability: full request trace
- Accessibility: screen-reader compatible

---

## 5. Constraints
- Legal: PII protection
- Data: inconsistent records
- System: legacy monolith
- Time: rapid deployment

---

## 6. Success Metrics
- 80% reduction in manual scanning time
- 0% unverified claims displayed
- <5s response latency

---

## 7. Failure Modes

| Failure | Impact | Behavior |
|--------|--------|----------|
| Missing data | Confusion | Show uncertainty |
| Tool failure | Incomplete info | Partial response + warning |
| Model error | Risk | Block output |

---

## 8. Out of Scope
- Autonomous decision making
- Cross-record analytics

---

## 9. Delivery Phases
| Phase | Scope | Exit |
|------|------|------|
| MVP | Briefing only | Verified output |
| V2 | Multi-turn | Stable conversation |
| V3 | Advanced tools | Scalable |

---

## 10. Document Control
Owner: MoniGarr  
Version: 1.0