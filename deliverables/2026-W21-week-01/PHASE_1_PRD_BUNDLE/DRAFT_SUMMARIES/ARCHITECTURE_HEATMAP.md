Architecture Heatmap
Purpose

This document identifies the highest-risk, highest-complexity, and highest-maintenance-pressure areas discovered during the Phase 1 audit.

The goal is to:

accelerate onboarding
prioritize remediation work
highlight architectural pressure zones
reduce future debugging and regression cost

This is not a blame document.

This is an operational risk-mapping document.

Heatmap Severity Legend
Severity	Meaning
Critical	Immediate architectural pressure or operational instability
High	Significant long-term scaling or maintenance concern
Medium	Manageable but meaningful engineering risk
Low	Localized or limited operational concern
System Heatmap
Area	Severity	Why It Matters	Primary Risks
api/src/routes/weeks.ts	Critical	Highest type/assertion concentration and orchestration complexity	Runtime correctness, maintainability
api/src/routes/team.ts	Critical	Heavy request aggregation and runtime assumptions	Refactor instability, nullability risk
api/src/routes/projects.ts	High	High assertion density and orchestration complexity	Coupling, regression risk
/api/issues endpoint	Critical	Weakest tail-latency behavior under load	Concurrent-user degradation
Collaboration/editor infrastructure	High	Flaky E2E concentration and infra coupling	Reliability instability
Frontend entry bundle	Critical	Oversized startup payload	Slow initial load, TTI degradation
Search query path	High	Sequential scan scaling pattern	Query degradation under growth
Accessibility route parity	High	Inconsistent authenticated workflow accessibility	Section 508/WCAG operational risk
Coverage instrumentation	High	Missing quantitative visibility	Unsafe refactor confidence
Modal/editor interaction flow	Medium	UI interception behavior	Workflow disruption
Startup API readiness flow	Medium	Race-condition noise during startup	Confusing transient failures
Shared type contracts	Low (positive)	Strong cross-boundary consistency	Architectural strength
Heatmap By Architectural Domain
Frontend
Critical
oversized entry bundle
uneven chunking strategy
heavy editor ecosystem payload
High
accessibility consistency
modal-interception flows
Medium
authenticated route UX parity
loading-state consistency
Backend
Critical
route-layer assertion density
concurrency-sensitive issue aggregation
High
complex orchestration paths
partial runtime-shape enforcement
Medium
startup synchronization behavior
error-boundary coverage
Database
High
sequential scan search behavior
structurally expensive sprint aggregation queries
Medium
future index optimization alignment
Low
current baseline execution times remain acceptable
Collaboration Infrastructure
High
infrastructure-bound E2E instability
collaboration-heavy retry amplification
editor synchronization testing pressure
Medium
operational complexity during heavy concurrent execution
Testing Infrastructure
High
missing quantitative coverage metrics
unstable collaboration-focused E2E execution
Medium
incomplete edge-case instrumentation
limited accessibility workflow assertions
Accessibility
High
authenticated contrast violations
inconsistent screen-reader workflow quality
Medium
keyboard traversal completeness gaps
Low
strong Lighthouse baseline posture overall
Strongest Architectural Zones

The following areas demonstrated strong operational maturity:

Area	Why It Is Strong
Shared types	Strong cross-boundary contract discipline
Unified document model	Consistent domain abstraction
Collaboration primitives	Mature CRDT and WebSocket foundations
Infrastructure selection	Pragmatic and maintainable tooling
Authentication/session paths	Stable latency characteristics
Recommended Remediation Order
API route-layer stabilization
Bundle optimization and lazy-loading refinement
Coverage instrumentation enablement
Accessibility consistency remediation
Collaboration infrastructure stabilization
Search-query indexing improvements
Runtime boundary expansion
Final Heatmap Interpretation

The Ship monorepo does not exhibit widespread architectural failure.

The architecture instead demonstrates:

several strong foundational systems
concentrated technical-pressure zones
growing operational complexity around collaboration and orchestration
increasing maintenance pressure in specific API aggregation layers

The strongest path forward is focused remediation of concentrated hotspots rather than broad architectural replacement.