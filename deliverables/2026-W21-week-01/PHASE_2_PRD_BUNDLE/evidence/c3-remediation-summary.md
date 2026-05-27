# Category 3 Remediation Benchmark Summary

Baseline source: `prd_dev_branch_one/PHASE_1_PRD_BUNDLE/PHASE_1_AUDIT_REPORT.md`

| Endpoint | P50 (after) | P95 (after) | P99 (after) | P95 reduction vs baseline |
| --- | ---: | ---: | ---: | ---: |
| /api/auth/session | 24 ms | 61 ms | 114 ms | -123.2% |
| /api/documents | 157 ms | 245 ms | 439 ms | -775% |
| /api/issues | 74 ms | 103.33 ms | 306 ms | 64.08% |
| /api/projects | 28 ms | 42 ms | 50 ms | -59.51% |
| /api/team/grid | 19 ms | 34.67 ms | 45 ms | 66.67% |

Endpoints meeting >=20% P95 reduction: 2
