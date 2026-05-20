# SentinelBrief — ARCHITECTURE

## 0. Summary
System embeds inside CRM session, uses bounded tools, verifies outputs, and logs all actions.

---

## 1. Architecture Position
- AI is untrusted
- System is authority
- Verification required

---

## 2. Principles
- Bounded data
- Verification-first
- Observability-first
- Brownfield-safe

---

## 3. System Overview

UI → Controller → Orchestrator → Tools → Verification → Output

---

## 4. Components

| Component | Role |
|----------|------|
| Controller | Request handling |
| Orchestrator | AI loop |
| Tools | Data retrieval |
| Verification | Fact checking |

---

## 5. Request Flow
1. User clicks button
2. System fetches data
3. AI generates response
4. Verification filters output
5. UI displays

---

## 6. Trust Boundaries

| Boundary | Allowed | Forbidden |
|----------|--------|-----------|
| UI | Request | Data access |
| AI | Reason | DB queries |

---

## 7. Tools

| Tool | Purpose |
|------|--------|
| get_identity | Identity data |
| get_changes | Recent updates |
| get_flags | Alerts |

---

## 8. AI Integration
- Model: GPT-based
- Output: JSON
- Constraints: structured only

---

## 9. Verification
- Citation matching
- Rule filtering

---

## 10. Observability
- Logs
- Metrics
- Cost tracking

---

## 11. Failure Modes

| Failure | Behavior |
|--------|----------|
| Tool fail | Partial output |
| AI fail | Error |

---

## 12. Evaluation
- Unit tests
- Edge cases
- Adversarial tests

---

## 13. Deployment
- Docker
- CI/CD

---

## 14. Scale
- Optimize queries
- Limit tokens

---

## 15. Limitations
- Data quality
- Legacy constraints

---

## 16. Forward Path
- More tools
- Better UX

---

## 17. Document Control
Version: 1.0