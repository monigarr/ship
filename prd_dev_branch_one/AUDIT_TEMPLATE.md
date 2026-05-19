# Project Name Template — AUDIT

## 0. Summary
The CRM is a legacy monolith with inconsistent data structures and limited observability. Security is role-based but unevenly enforced. Logging risks exposing PII.

Key risk: unverified AI outputs could misrepresent records.

---

## 1. Security
- Risk: IDOR
- Risk: log leakage
- Mitigation: server-bound tools, redacted logs

---

## 2. Performance
- Slow DB queries
- Heavy UI loads
- Impact: latency risk

---

## 3. Architecture
- Mixed legacy + modern layers
- Integration via additive module only

---

## 4. Data Quality
- Missing fields
- Duplicates
- Stale data

---

## 5. Compliance
- PII protection required
- Logging restrictions

---

## 6. Observability
- Minimal existing logs
- Need structured telemetry

---

## 7. Findings

| ID | Severity | Finding | Fix |
|----|----------|---------|-----|
| F1 | High | PII in logs | Redaction |
| F2 | High | Missing ACL checks | Middleware |
| F3 | Medium | Data inconsistency | Verification |
| F4 | Medium | Pre-commit hook blocked by 3 pre-existing empty test files on docs-only commit path | Fix/remove empty tests or scope hook checks; use `--no-verify` only as approved exception |

---

## 8. Integration Implications
- Must not bypass ACL
- Must verify all outputs

---

## 9. Development Workflow / CI
- Issue: pre-commit hook fails due to 3 pre-existing empty test files unrelated to docs-only commits.
- Risk: blocked documentation delivery or unsafe normalization of hook bypassing.
- Recommendation: do not default to `--no-verify`; first fix/remove the empty test files or scope hook checks so docs-only commits are not blocked.
- Exception path: if a time-sensitive docs-only commit must proceed, use `--no-verify` only with explicit team approval and track immediate follow-up to restore green hooks.

---

## 10. Document Control
Version: 1.0