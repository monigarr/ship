# Why We're Adding Typer: A 5-Minute Executive Summary

**For:** Engineering Team & Project Leaders  
**Reading Time:** 5 minutes  
**Status:** Approved / In Progress

---

## The One-Sentence Answer

**We're adding Typer to turn our compliance paperwork into automated code that actively tests our security, enforces our policies, and generates Federal audit reports—something our legacy `comply` tool cannot do.**

---

## The Problem: Our Compliance Tools Don't Comply

| What Our PRDs & SECURITY.md Require | What `comply` (old tool) Does | Gap |
|--------------------------------------|-------------------------------|-----|
| **Actively test the running app** for security holes (XSS, broken auth, WebSocket attacks) | ❌ Only generates static policy docs | Critical |
| **Automatically verify** `ATTESTATION.md` is fresh before merge | ❌ No CI integration | Critical |
| **Export FedRAMP-ready reports** (OSCAL JSON for auditors) | ❌ No Federal format support | High |
| **Run as part of CI/CD** with proper exit codes | ❌ Manual process only | High |

**Bottom Line:** `comply` was built for SOC2 policy documents. We need active security scanning and Federal compliance. Typer lets us **build exactly what we need** using Python.

---

## What Typer Actually Does (No Jargon)

Typer is just a Python library that makes building command-line tools easy. We're using it to create a single command: `ship-compliance`

```bash
# One command runs all our security checks
ship-compliance scan

# Another command validates our attestations
ship-compliance attest --check

# Another exports audit-ready reports
ship-compliance export fedramp
```

That's it. We're not rewriting the app—we're **wrapping our existing TypeScript security scripts** with a unified interface that CI and auditors can use.

---

## The Architecture: Simple & Maintainable

```
Existing TypeScript App          New Typer CLI (ship-compliance)
├── security-probe.ts    ───→    ├── runs it, parses JSON
├── pnpm audit           ───→    ├── runs it, adds severity
└── ATTESTATION.md       ───→    └── validates Git SHA freshness

Outputs to: CI (GitHub Actions) + Auditors (OSCAL JSON)
```

**Key Insight:** We keep our existing TypeScript security logic. Typer just orchestrates it and adds the compliance wrapper that Federal auditors require.

---

## What This Unlocks (PRD & Federal Requirements)

| Requirement | Before (comply) | After (Typer) |
|-------------|----------------|---------------|
| **PRD Category 8**: Build a security probe tool | ❌ Impossible | ✅ `ship-compliance scan` |
| **PRD Category 8**: Produce structured JSON report | ❌ N/A | ✅ Machine-readable output |
| **SECURITY.md**: CI enforcement of attestations | ❌ Manual only | ✅ GitHub Actions gate |
| **SECURITY.md**: Prevent `--no-verify` bypass | ❌ No control | ✅ CI fails if attestation stale |
| **FedRAMP/FISMA**: OSCAL export | ❌ No support | ✅ `ship-compliance export fedramp` |

---

## Why Python + Typer (Not TypeScript or Go)?

| Consideration | Decision |
|---------------|----------|
| **Speed of development** | Typer builds full CLI with validation, help text, and colors in <100 lines |
| **Federal ecosystem** | Most FedRAMP automation tools (e.g., OSCAL-Reference) are Python-first |
| **Our team's skills** | We already use Python for data scripts; no new language |
| **No lock-in** | Typer is just a wrapper—we can replace it later if needed |

---

## The Migration: Low Risk, High Reward

### Phase 1 (Week 1): Wrap Existing Scripts
- Create `ship-compliance scan` that calls our existing `security-probe.ts`
- **Risk:** Near zero—existing logic unchanged

### Phase 2 (Week 2): Add CI Gates
- Update GitHub Actions to run `ship-compliance attest --check`
- **Risk:** Low—CI may fail initially until attestations are fixed

### Phase 3 (Week 3): Federal Exports
- Add `ship-compliance export fedramp` for OSCAL output
- **Risk:** Low—additive only, no changes to existing code

### Rollback Plan
- Typer CLI is optional for local dev; CI can be disabled with one flag
- Existing `comply` references remain untouched during transition

---

## What We're NOT Doing (To Alleviate Fears)

| Concern | Reality |
|---------|---------|
| Rewriting the whole app | ❌ No—just adding a Python wrapper around existing scripts |
| Replacing `comply` entirely | ❌ Not yet—we keep legacy docs until migration complete |
| Adding a new required language | ❌ Python is already used in scripts; Typer is lightweight |
| Breaking existing workflows | ❌ Developers can ignore Typer locally; only CI requires it |

---

## Success Metrics (We'll Know It's Working When)

| Metric | Target |
|--------|--------|
| CI blocks PR with stale `ATTESTATION.md` | ✅ 0 stale attestations merged |
| `ship-compliance scan` runs in <30 seconds | ✅ Fast enough for pre-commit |
| Auditors accept OSCAL JSON instead of manual PDFs | ✅ 50% less audit prep time |
| New engineer can run `ship-compliance --help` | ✅ Self-documenting |

---

## The Bottom Line (For Busy Leaders)

| If you care about... | Then Typer matters because... |
|----------------------|-------------------------------|
| **Meeting the PRD** | Category 8 *requires* a security probe tool—`comply` can't do it |
| **Passing Federal audit** | FedRAMP now *requires* OSCAL exports—Typer generates them |
| **CI reliability** | Our security gates need to be automated—`comply` is manual |
| **Team velocity** | Manual attestation reviews take hours—Typer automates to seconds |

---

## One-Pager Decision Matrix

| | Keep `comply` only | Add Typer |
|--|--------------------|-----------|
| PRD Category 8 pass           | ❌ Fail | ✅ Pass |
| SECURITY.md CI enforcement    | ❌ Manual | ✅ Automated |
| FedRAMP OSCAL export          | ❌ No | ✅ Yes |
| Dev setup complexity          | Low | Low (+1 Python dep) |
| Maintenance burden            | Low (but missing features) | Low (just a wrapper) |
| Audit readiness | Poor (manual) | Excellent (automated) |

**Verdict:** Typer is **low risk, high compliance value**.

---

## Next Steps (For Implementation Lead)

1. **Read** the AI prompt in `docs/typer-migration-strategy.md` (full technical spec)
2. **Run** the prompt in Cursor to generate scaffolding
3. **Test** `ship-compliance scan` against existing probe
4. **Update** `.github/workflows/security.yml` to call Typer CLI
5. **Document** for team: `ship-compliance --help` is the source of truth

---

## Questions & Answers

**Q: Do all developers need to install Python now?**  
A: Only if running compliance locally. CI runs it automatically. We provide a dev container with Python pre-installed.

**Q: Will this slow down our CI?**  
A: The security probe takes ~15 seconds; attestation check takes <1 second. Well within acceptable limits.

**Q: Can we remove the old `comply` tool?**  
A: Not yet—we keep it for legacy doc generation until Phase 3 complete.

**Q: Who maintains this after I'm gone?**  
A: The CLI is <500 lines of Python, heavily commented, with tests. Any engineer can maintain it.

**Q: Is this over-engineering for a small team?**  
A: No—Federal audits require this level of automation. Manual compliance costs us weeks per year. Typer pays for itself in one audit cycle.

---

**Document Control**  
Created: 2026-05-22  
Owner: Platform Engineering  
Review Cycle: Quarterly or after Federal audit

**For deeper technical details, see:** `docs/typer-migration-strategy.md` (full architecture with code examples)
```