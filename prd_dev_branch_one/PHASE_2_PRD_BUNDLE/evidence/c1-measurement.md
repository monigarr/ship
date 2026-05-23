# C1 Exact Measurement Report

Generated: 2026-05-23T14:28:21.092Z

Command: `pnpm audit:c1`

## Audit Deliverable Table

| Metric | Your Baseline |
| --- | ---: |
| Total any types | 224 |
| Total type assertions (as) | 697 |
| Total non-null assertions (!) | 324 |
| Total @ts-ignore / @ts-expect-error | 1 |
| Strict mode enabled? | Yes |
| Strict mode error count (if disabled) | N/A |
| Untyped function parameters | 1478 |
| Implicit-any-style missing return annotations | 88 |

## Breakdown By Package And Violation Type

| Package | any | as | non-null ! | ts directives | untyped params | implicit-any returns |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| api | 191 | 325 | 291 | 0 | 314 | 36 |
| shared | 0 | 2 | 0 | 0 | 0 | 0 |
| web | 33 | 370 | 33 | 1 | 1164 | 52 |

## Top 5 Violation-Dense Files

| File | Package | Total | any | as | non-null ! | ts directives | untyped params | implicit-any returns | Why problematic |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| `api/src/routes/weeks.ts` | api | 100 | 0 | 23 | 46 | 0 | 26 | 5 | frequent non-null assertions can hide unsafe nullability assumptions; secondary driver: many untyped parameters reduce call-site and contract clarity. |
| `api/src/services/accountability.test.ts` | api | 77 | 32 | 32 | 0 | 0 | 13 | 0 | extensive explicit any usage weakens compile-time guarantees; secondary driver: heavy type assertion usage suggests runtime shape uncertainty. |
| `api/src/__tests__/transformIssueLinks.test.ts` | api | 71 | 37 | 28 | 1 | 0 | 0 | 5 | extensive explicit any usage weakens compile-time guarantees; secondary driver: heavy type assertion usage suggests runtime shape uncertainty. |
| `api/src/routes/issues.ts` | api | 67 | 0 | 1 | 34 | 0 | 29 | 3 | frequent non-null assertions can hide unsafe nullability assumptions; secondary driver: many untyped parameters reduce call-site and contract clarity. |
| `web/src/pages/ReviewsPage.tsx` | web | 67 | 0 | 6 | 4 | 0 | 57 | 0 | many untyped parameters reduce call-site and contract clarity; secondary driver: heavy type assertion usage suggests runtime shape uncertainty. |

## Strict Mode Detail

- web strict: true
- api strict: true
- shared strict: true
