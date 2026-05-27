# Risk Scoring Methodology

**Purpose:** Provide a consistent severity framework for interpreting Phase 1 audit findings and prioritizing Phase 2 remediation.  
**Designed for:** reviewers, maintainers, technical leads, and future contributors.  
**Source alignment:** PRD requirement to identify weaknesses/opportunities and rank severity or impact for each audit category.

---

## 30-Second Read

Severity was assigned based on operational impact, user impact, scalability pressure, maintainability cost, and blast radius.

This scoring model intentionally avoids overreacting to cosmetic issues. A finding is high severity only when it affects correctness, performance, accessibility, reliability, security posture, or future change safety.

---

## Severity Levels

| Severity | Meaning | Reviewer Interpretation |
|---|---|---|
| Critical | Direct production or compliance risk; likely to cause major user, operational, or security impact. | Fix immediately or gate release. |
| High | Significant risk under scale, refactor, concurrency, or accessibility review. | Prioritize in Phase 2. |
| Medium | Meaningful weakness with future risk or contained current impact. | Fix after high-impact items. |
| Low | Localized friction, documentation issue, or limited maintenance concern. | Track, but do not let it distract from major risks. |

---

## Scoring Dimensions

Each finding is evaluated across 5 dimensions.

| Dimension | Question | High-Risk Signal |
|---|---|---|
| User impact | Does it affect core workflows, accessibility, trust, or data confidence? | Users blocked, confused, slowed, or excluded. |
| Operational impact | Does it affect deployability, observability, CI, or incident likelihood? | Hard to reproduce, diagnose, or recover. |
| Scalability pressure | Does it worsen under data growth, concurrency, or larger teams? | Tail latency, full scans, test instability, bundle growth. |
| Maintainability cost | Does it make safe changes harder? | `any`, `as`, `!`, hidden contracts, unclear boundaries. |
| Blast radius | Does it affect many routes, packages, or workflows? | Shared layer, API route cluster, build system, collaboration core. |

---

## Practical Scoring Rubric

Use this rubric when deciding whether a finding is Critical, High, Medium, or Low.

| Score | User Impact | Operational Impact | Scale Impact | Maintainability | Blast Radius |
|---:|---|---|---|---|---|
| 5 | Blocks or harms core user workflow | Causes repeated runtime/CI/deployment instability | Degrades quickly under realistic load | Makes safe changes very difficult | Cross-system impact |
| 4 | Noticeably degrades important workflow | Causes recurring debugging or reliability cost | Degrades under moderate growth | Creates high refactor risk | Affects major feature area |
| 3 | Creates friction or partial workflow risk | Requires manual workarounds | Likely future bottleneck | Adds local complexity | Affects one route/module |
| 2 | Minor annoyance | Low operational cost | Limited future impact | Easy to understand | Isolated |
| 1 | Informational | No measurable operational effect | No meaningful scale impact | Cosmetic | No spread |

Suggested classification:

| Average Score | Severity |
|---:|---|
| 4.5–5.0 | Critical |
| 3.5–4.4 | High |
| 2.5–3.4 | Medium |
| 1.0–2.4 | Low |

---

## Applied Risk Register

| Finding | Severity | Why |
|---|---|---|
| API type-safety hotspot concentration in `weeks`, `team`, `projects` | High | High maintainability cost, high runtime-assumption density, core API blast radius. |
| Main frontend chunk around 2 MB | High | Initial-load performance risk and user-facing latency on constrained networks. |
| `/api/issues` P95/P99 latency under concurrency | High | Core workflow endpoint with clear tail-latency weakness. |
| Missing quantitative coverage instrumentation | High | Reduces refactor confidence and makes test completeness hard to prove. |
| E2E collaboration instability | High | CI reliability and collaboration workflow confidence risk. |
| Serious accessibility contrast issues | High | Authenticated workflow compliance and usability risk. |
| Search query sequential scan pattern | Medium | Current timings are low, but growth risk is clear. |
| Sprint-board query complexity | Medium | Current execution is acceptable, but structural query cost may scale poorly. |
| Startup API proxy race noise | Medium | User/developer confusion; likely manageable with better readiness/error UX. |
| Modal interception of editor workflows | Medium | Blocks automation and can confuse users in collaboration contexts. |
| Windows postinstall shell message | Low | Setup friction, not a blocker. |
| Low TypeScript directive suppression count | Low / positive signal | Isolated suppression use is not currently a major risk. |

---

## What Should Not Be Inflated

Do not classify a finding as High simply because it is messy.

A finding should remain Medium or Low when:

- it is isolated
- it has no current user impact
- it has no clear scale path
- it is cosmetic
- it does not block measurement or remediation
- it does not affect critical workflows

This matters because reviewers can lose trust when every issue is labeled urgent.

---

## How This Helps Phase 2

The PRD rewards measurable improvement, technical depth, documentation clarity, and commit discipline. This risk model helps translate Phase 1 findings into implementation priorities.

| PRD Concern | How Risk Scoring Supports It |
|---|---|
| Measurable improvement | Prioritizes findings with clear before/after metrics. |
| Technical depth | Separates root-cause fixes from surface patches. |
| TypeScript quality | Highlights unsafe API boundary patterns. |
| Documentation quality | Explains why each issue matters. |
| Commit discipline | Encourages one risk-reduction theme per commit/branch. |

---

## Reviewer Guidance

When reviewing the audit, focus first on findings that are both:

1. measurable, and
2. connected to core workflows.

Those are the strongest Phase 2 targets because they can be proven with reproducible before/after evidence.
