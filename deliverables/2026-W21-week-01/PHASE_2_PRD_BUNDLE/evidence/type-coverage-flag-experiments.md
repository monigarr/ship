# Type-Coverage Flag Experiments (plantain-00)

Date: 2026-05-23  
Scope: `tsconfig.json` at repository root  
Tool: `type-coverage` (plantain-00)

## Purpose

Provide a data-driven view of how `type-coverage` changes under stricter and noise-filtering flag configurations, so maintainers can distinguish real typing debt from metric artifacts.

## Experiment Matrix Results

Baseline reference is the `default` run (`94.08%`).

| Run | Flags | Percent | Correct / Total | Delta vs default (pp) | What this indicates |
| --- | --- | ---: | ---: | ---: | --- |
| default | `--project tsconfig.json --json-output` | 94.08% | 168943 / 179556 | 0.00 | Canonical repository-wide baseline for this tool. |
| strict | `--strict` | 90.53% | 163244 / 180309 | -3.55 | Enabling strict mode reveals additional typing debt that is not visible in default settings. |
| ignore-catch | `--ignore-catch` | 94.01% | 166067 / 176647 | -0.07 | Catch-parameter typing is not a major driver of coverage posture in this codebase. |
| ignore-nested | `--ignore-nested` | 94.08% | 168943 / 179556 | 0.00 | Nested generic `any` is not materially affecting the current score. |
| ignore-as-assertion | `--ignore-as-assertion` | 94.08% | 168943 / 179556 | 0.00 | `as` assertions are not currently reducing this specific metric in a measurable way. |
| ignore-non-null-assertion | `--ignore-non-null-assertion` | 94.08% | 168943 / 179556 | 0.00 | Non-null assertions are not reducing this metric in a measurable way. |
| strict-ignore-catch | `--strict --ignore-catch` | 90.51% | 160559 / 177382 | -3.57 | Strict-mode debt remains the dominant gap even when catch paths are excluded. |
| strict-combined | `--strict --ignore-catch --ignore-nested --ignore-as-assertion --ignore-non-null-assertion` | 94.01% | 166066 / 176647 | -0.07 | Most strict drop comes from dimensions other than catch/nested/as/non-null flags; focus on core inferred/annotated typing gaps. |

## Recommended Use For Decision-Making

- Use `default` as the main cross-sprint KPI for continuity.
- Use `strict` as a risk-surface KPI for architectural hardening work.
- Treat `ignore-*` runs as diagnostic controls to avoid over-prioritizing low-impact metric dimensions.
- Prioritize improvements that raise both:
  1) exact C1 subtype quality (especially API + web hotspots), and  
  2) `strict` type-coverage score.

## Repro Commands

```powershell
pnpm dlx type-coverage --project "tsconfig.json" --json-output > "prd_dev_branch_one/PHASE_2_PRD_BUNDLE/evidence/type-coverage-experiments/default.json"
pnpm dlx type-coverage --project "tsconfig.json" --strict --json-output > "prd_dev_branch_one/PHASE_2_PRD_BUNDLE/evidence/type-coverage-experiments/strict.json"
pnpm dlx type-coverage --project "tsconfig.json" --ignore-catch --json-output > "prd_dev_branch_one/PHASE_2_PRD_BUNDLE/evidence/type-coverage-experiments/ignore-catch.json"
pnpm dlx type-coverage --project "tsconfig.json" --ignore-nested --json-output > "prd_dev_branch_one/PHASE_2_PRD_BUNDLE/evidence/type-coverage-experiments/ignore-nested.json"
pnpm dlx type-coverage --project "tsconfig.json" --ignore-as-assertion --json-output > "prd_dev_branch_one/PHASE_2_PRD_BUNDLE/evidence/type-coverage-experiments/ignore-as-assertion.json"
pnpm dlx type-coverage --project "tsconfig.json" --ignore-non-null-assertion --json-output > "prd_dev_branch_one/PHASE_2_PRD_BUNDLE/evidence/type-coverage-experiments/ignore-non-null-assertion.json"
pnpm dlx type-coverage --project "tsconfig.json" --strict --ignore-catch --json-output > "prd_dev_branch_one/PHASE_2_PRD_BUNDLE/evidence/type-coverage-experiments/strict-ignore-catch.json"
pnpm dlx type-coverage --project "tsconfig.json" --strict --ignore-catch --ignore-nested --ignore-as-assertion --ignore-non-null-assertion --json-output > "prd_dev_branch_one/PHASE_2_PRD_BUNDLE/evidence/type-coverage-experiments/strict-combined.json"
```
