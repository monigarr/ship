# SentinelBrief — USERS

## 1. Target User
- Role: Government case worker
- Environment: High-volume citizen interactions
- Constraint: 30–60 seconds context window

---

## 2. Workflow
1. Open citizen record
2. Need immediate context
3. Engage citizen

---

## 3. Core Needs
- Fast understanding
- Reliable data
- No hallucinations

---

## 4. Use Cases

### UC1 — Identity Brief
- Moment: Record open
- Need: Who is this person?
- Why AI: Requires synthesis across fields
- Success: Clear narrative

---

### UC2 — Recent Changes
- Moment: Pre-interaction
- Need: What changed?
- Why AI: Requires filtering + prioritization
- Success: Accurate delta

---

### UC3 — Verification Checklist
- Moment: Before action
- Need: What to confirm
- Why AI: Context-specific prompts
- Success: Actionable checklist

---

## 5. UX Entry
- Location: CRM record page
- Trigger: “Generate Brief”
- Latency: <5s

---

## 6. Trust Expectations
- Never fabricate
- Always cite sources
- Show uncertainty clearly

---

## 7. Out of Scope Users
- Analysts
- Admin staff

---

## 8. Traceability Matrix

| Use Case | Data | Risk | Mitigation |
|----------|------|------|-----------|
| UC1 | Identity records | Misidentification | Verification |
| UC2 | Change logs | Missed update | Tool constraints |
| UC3 | Flags | Wrong suggestion | Domain rules |

---

## 9. Document Control
Version: 1.0