# Category 3 After Benchmark Summary

Baseline source: `prd_dev_branch_one/PHASE_1_PRD_BUNDLE/PHASE_1_AUDIT_REPORT.md`

| Endpoint | P50 (after) | P95 (after) | P99 (after) | P95 reduction vs baseline |
| --- | ---: | ---: | ---: | ---: |
| /api/auth/session | 96 ms | 138 ms | 198 ms | -404.94% |
| /api/documents | 404 ms | 471 ms | 490 ms | -1582.14% |
| /api/issues | 292 ms | 328 ms | 346 ms | -14.02% |
| /api/projects | 124 ms | 144.33 ms | 153 ms | -448.17% |
| /api/team/grid | 139 ms | 153.33 ms | 159 ms | -47.44% |

Endpoints meeting >=20% P95 reduction: 0
