# GFA2_WK4_FULL_REPORTS

This index consolidates Week 4 reports and evidence artifacts for reviewer verification and future maintenance planning.

## PRD Deliverable Reports Table - PHASE_1_PRD_BUNDLE

| PRD Source | PRD Requirement ID | PRD deliverable | Primary report/evidence | Current status snapshot | Link |
| --- | --- | --- | --- | --- | --- |
| `PHASE_1_PRD_BUNDLE/PRD.md` | `SR-1` | Phase 1 Audit Report | Baseline audit with C1-C7 measurements | Present | [PHASE_1_AUDIT_REPORT.md](PHASE_1_PRD_BUNDLE/PHASE_1_AUDIT_REPORT.md) |
| `PHASE_1_PRD_BUNDLE/PRD.md` | `SR-1` | Reproducibility guidance | Baseline measurement reproducibility constraints | Present | [REPRODUCIBILITY.md](PHASE_1_PRD_BUNDLE/REPRODUCIBILITY.md) |
| `PHASE_1_PRD_BUNDLE/PRD.md` | `SR-1` | Baseline architecture/risk support | Supporting baseline analysis and prioritization docs | Present | [ARCHITECTURE_HEATMAP.md](PHASE_1_PRD_BUNDLE/ARCHITECTURE_HEATMAP.md), [RISK_SCORING.md](PHASE_1_PRD_BUNDLE/RISK_SCORING.md), [REMEDIATION_PRIORITY_PLAN.md](PHASE_1_PRD_BUNDLE/REMEDIATION_PRIORITY_PLAN.md) |

## PRD Deliverable Reports Table - PHASE_2_PRD_BUNDLE

| PRD Source | PRD Requirement ID | PRD deliverable | Primary report/evidence | Current status snapshot | Link |
| --- | --- | --- | --- | --- | --- |
| `PHASE_2_PRD_BUNDLE/PRD.md` | `SR-2` | Improvement Documentation | C1-C7 before/after/root-cause/fix/repro package | Present | [IMPROVEMENT_DOCUMENTATION.md](PHASE_2_PRD_BUNDLE/IMPROVEMENT_DOCUMENTATION.md) |
| `PHASE_2_PRD_BUNDLE/PRD.md` | `SR-3` | Discovery Write-up | Discovery narrative and reflection | Present | [DISCOVERY_WRITEUP.md](DISCOVERY_WRITEUP.md) |
| `PHASE_2_PRD_BUNDLE/PRD.md` | `SR-4` | Demo package | Demo video script/package and supporting notes | Present | [DEMO_VIDEO_PACKAGE.md](DEMO_VIDEO_PACKAGE.md) |
| `PHASE_2_PRD_BUNDLE/PRD.md` | `D-1` | AI Cost Analysis | Cost and tooling reflection report | Present | [AI_COST_ANALYSIS.md](AI_COST_ANALYSIS.md) |
| `PHASE_2_PRD_BUNDLE/PRD.md` | `SR-5` | Deployment and social evidence | Public deployment and social proof artifacts | Present | [DEPLOYMENT_EVIDENCE.md](DEPLOYMENT_EVIDENCE.md), [SOCIAL_POST_EVIDENCE.md](SOCIAL_POST_EVIDENCE.md) |
| `PHASE_2_PRD_BUNDLE/PRD.md` | `SR-6` | Fork/branch/setup evidence | Repository and branch setup verification | Present | [REPO_FORK_BRANCH_EVIDENCE.md](REPO_FORK_BRANCH_EVIDENCE.md) |

## PRD Deliverable Reports Table - PRD_CAT8

| PRD Source | PRD Requirement ID | PRD deliverable | Primary report/evidence | Current status snapshot | Link |
| --- | --- | --- | --- | --- | --- |
| `PRD_CAT8/PRD.md` | `C8-FIX` | Security fix closeout | Focused security fix evidence and reviewer closeout | Present | [REVIEWER_CLOSEOUT_REPORT.md](REVIEWER_CLOSEOUT_REPORT.md), [security-probe-closeout-4.md](PRD_CAT8/security-probe-closeout-4.md) |
| `PRD_CAT8/PRD.md` | `C8-T*`, `C8-M*`, `C8-R1` | Security probing and audit artifacts | Probe reports and security audit context | Present | [security-probe-report.md](PRD_CAT8/security-probe-report.md), [Shipshape - Security Audit.md](PRD_CAT8/Shipshape%20-%20Security%20Audit.md) |
| `PRD_CAT8/PRD.md` | `C8-*` | Dependency/security impact analysis | Security dependency decision support | Present | [dependency-feature-impact.md](PRD_CAT8/dependency-feature-impact.md) |

## Core Control And Summary Reports

| PRD Source | PRD Requirement ID | Area | Report | Why it matters | Link |
| --- | --- | --- | --- | --- | --- |
| `PHASE_2_PRD_BUNDLE`, `PRD_CAT8`, `PHASE_1_PRD_BUNDLE` | `SR-1..SR-6`, `C1..C8` | Overall status | Final compliance snapshot | Consolidated status and C1-C8 delta table | [FINAL_COMPLIANCE_STATUS.md](FINAL_COMPLIANCE_STATUS.md) |
| `PRD_CAT8`, `PHASE_2_PRD_BUNDLE` | `C8-FIX`, `IR-*` | Reviewer closeout | Reviewer closeout report | Security-focused closeout narrative and proof references | [REVIEWER_CLOSEOUT_REPORT.md](REVIEWER_CLOSEOUT_REPORT.md) |
| `PHASE_2_PRD_BUNDLE`, `PRD_CAT8`, `PHASE_1_PRD_BUNDLE` | `C*`, `SR-*`, `IR-*`, `D-1` | Requirement tracking | Strict requirement checklist | Requirement-by-requirement pass/fail tracking | [STRICT_REQUIREMENT_CHECKLIST.md](STRICT_REQUIREMENT_CHECKLIST.md) |
| `PHASE_2_PRD_BUNDLE`, `PRD_CAT8`, `PHASE_1_PRD_BUNDLE` | `C*`, `SR-*`, `IR-*`, `D-1`, `C8-*` | Requirement tracking | Master PRD compliance matrix | Detailed PRD requirement mapping to evidence | [MASTER_PRD_COMPLIANCE_MATRIX.md](MASTER_PRD_COMPLIANCE_MATRIX.md) |
| `PHASE_2_PRD_BUNDLE`, `PRD_CAT8`, `PHASE_1_PRD_BUNDLE` | `C*`, `SR-*`, `IR-*`, `D-1`, `C8-*` | Reviewer gate | Final reviewer signoff checklist | Reviewer acceptance criteria and validation flow | [FINAL_REVIEWER_SIGNOFF_CHECKLIST.md](FINAL_REVIEWER_SIGNOFF_CHECKLIST.md) |

## C1 Deep-Dive And Type-Safety Reports

| PRD Source | PRD Requirement ID | Area | Report | Why it matters | Link |
| --- | --- | --- | --- | --- | --- |
| `PHASE_2_PRD_BUNDLE/PRD.md` | `C1-B1`, `C1-I1` | C1 exact measurement | Exact C1 report (markdown) | PRD-aligned table with explicit subtype counters | [c1-measurement.md](PHASE_2_PRD_BUNDLE/evidence/c1-measurement.md) |
| `PHASE_2_PRD_BUNDLE/PRD.md` | `C1-B1`, `C1-I1` | C1 exact measurement | Exact C1 raw JSON | Machine-readable totals, package breakdown, top dense files | [c1-measurement.json](PHASE_2_PRD_BUNDLE/evidence/c1-measurement.json) |
| `PHASE_2_PRD_BUNDLE/PRD.md` | `C1-I1` | C1 reproducibility | Exact C1 run snapshot 1 | Reproducibility run output (pass 1) | [c1-measurement-run1.json](PHASE_2_PRD_BUNDLE/evidence/c1-measurement-run1.json) |
| `PHASE_2_PRD_BUNDLE/PRD.md` | `C1-I1` | C1 reproducibility | Exact C1 run snapshot 2 | Reproducibility run output (pass 2) | [c1-measurement-run2.json](PHASE_2_PRD_BUNDLE/evidence/c1-measurement-run2.json) |
| `PHASE_2_PRD_BUNDLE/PRD.md` | `C1-B1`, `C1-I1` | C1 comparison | Legacy vs exact + package priority | Side-by-side methodology and targeting interpretation | [c1-measurement-comparison.md](PHASE_2_PRD_BUNDLE/evidence/c1-measurement-comparison.md) |
| `PHASE_2_PRD_BUNDLE/PRD.md` | `C1-I1` | Type-coverage analysis | Flag experiment analysis report | Interpretation of strict and ignore-flag experiments | [type-coverage-flag-experiments.md](PHASE_2_PRD_BUNDLE/evidence/type-coverage-flag-experiments.md) |

## Plantain-00 Run Matrix (Decision Table)

Use this table to compare type-coverage outputs across flags for data-driven maintenance decisions.

| PRD Source | PRD Requirement ID | Run name | Flags | Coverage % | Correct count | Total count | Delta vs default (pp) | Raw JSON |
| --- | --- | --- | --- | ---: | ---: | ---: | ---: | --- |
| `PHASE_2_PRD_BUNDLE/PRD.md` | `C1-I1` | default | `--project tsconfig.json --json-output` | 94.08 | 168943 | 179556 | 0.00 | [default.json](PHASE_2_PRD_BUNDLE/evidence/type-coverage-experiments/default.json) |
| `PHASE_2_PRD_BUNDLE/PRD.md` | `C1-I1` | strict | `--strict` | 90.53 | 163244 | 180309 | -3.55 | [strict.json](PHASE_2_PRD_BUNDLE/evidence/type-coverage-experiments/strict.json) |
| `PHASE_2_PRD_BUNDLE/PRD.md` | `C1-I1` | ignore-catch | `--ignore-catch` | 94.01 | 166067 | 176647 | -0.07 | [ignore-catch.json](PHASE_2_PRD_BUNDLE/evidence/type-coverage-experiments/ignore-catch.json) |
| `PHASE_2_PRD_BUNDLE/PRD.md` | `C1-I1` | ignore-nested | `--ignore-nested` | 94.08 | 168943 | 179556 | 0.00 | [ignore-nested.json](PHASE_2_PRD_BUNDLE/evidence/type-coverage-experiments/ignore-nested.json) |
| `PHASE_2_PRD_BUNDLE/PRD.md` | `C1-I1` | ignore-as-assertion | `--ignore-as-assertion` | 94.08 | 168943 | 179556 | 0.00 | [ignore-as-assertion.json](PHASE_2_PRD_BUNDLE/evidence/type-coverage-experiments/ignore-as-assertion.json) |
| `PHASE_2_PRD_BUNDLE/PRD.md` | `C1-I1` | ignore-non-null-assertion | `--ignore-non-null-assertion` | 94.08 | 168943 | 179556 | 0.00 | [ignore-non-null-assertion.json](PHASE_2_PRD_BUNDLE/evidence/type-coverage-experiments/ignore-non-null-assertion.json) |
| `PHASE_2_PRD_BUNDLE/PRD.md` | `C1-I1` | strict-ignore-catch | `--strict --ignore-catch` | 90.51 | 160559 | 177382 | -3.57 | [strict-ignore-catch.json](PHASE_2_PRD_BUNDLE/evidence/type-coverage-experiments/strict-ignore-catch.json) |
| `PHASE_2_PRD_BUNDLE/PRD.md` | `C1-I1` | strict-combined | `--strict --ignore-catch --ignore-nested --ignore-as-assertion --ignore-non-null-assertion` | 94.01 | 166066 | 176647 | -0.07 | [strict-combined.json](PHASE_2_PRD_BUNDLE/evidence/type-coverage-experiments/strict-combined.json) |

## Suggested Ongoing Maintenance KPI Set

| PRD Source | PRD Requirement ID | KPI | Source | Why keep it |
| --- | --- | --- | --- | --- |
| `PHASE_2_PRD_BUNDLE/PRD.md` | `C1-B1`, `C1-I1` | C1 explicit subtype totals | [c1-measurement.json](PHASE_2_PRD_BUNDLE/evidence/c1-measurement.json) | Shows where specific typing debt exists (untyped params, implicit-any returns, assertions). |
| `PHASE_2_PRD_BUNDLE/PRD.md` | `C1-I1` | Type-coverage default % | [default.json](PHASE_2_PRD_BUNDLE/evidence/type-coverage-experiments/default.json) | Stable cross-sprint comparison metric. |
| `PHASE_2_PRD_BUNDLE/PRD.md` | `C1-I1` | Type-coverage strict % | [strict.json](PHASE_2_PRD_BUNDLE/evidence/type-coverage-experiments/strict.json) | Early warning for stricter typing debt. |
| `PHASE_2_PRD_BUNDLE/PRD.md` | `C1-I1` | Package-level type-coverage | [type-coverage-web.json](PHASE_2_PRD_BUNDLE/evidence/type-coverage-web.json), [type-coverage-api.json](PHASE_2_PRD_BUNDLE/evidence/type-coverage-api.json), [type-coverage-shared.json](PHASE_2_PRD_BUNDLE/evidence/type-coverage-shared.json) | Helps allocate maintenance work by package risk profile. |
