import fs from 'node:fs';
import path from 'node:path';

const evidenceDir = path.resolve('prd_dev_branch_one/PHASE_2_PRD_BUNDLE/evidence');

const baselineP95 = {
  'api-auth-session': 27.33,
  'api-documents': 28.0,
  'api-issues': 287.67,
  'api-projects': 26.33,
  'api-team-grid': 104.0,
};

const endpointLabel = {
  'api-auth-session': '/api/auth/session',
  'api-documents': '/api/documents',
  'api-issues': '/api/issues',
  'api-projects': '/api/projects',
  'api-team-grid': '/api/team/grid',
};

const rows = Object.entries(baselineP95).map(([key, baseline]) => {
  const filePath = path.join(evidenceDir, `c3-remed-${key}-c25.json`);
  const raw = fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '');
  const json = JSON.parse(raw);
  const p50 = Number(json.latency.p50);
  const p90 = Number(json.latency.p90);
  const p975 = Number(json.latency.p97_5);
  const p95 = p90 + ((95 - 90) / (97.5 - 90)) * (p975 - p90);
  const p99 = Number(json.latency.p99);
  const reductionPct = ((baseline - p95) / baseline) * 100;
  return {
    endpoint: endpointLabel[key],
    p50: Number(p50.toFixed(2)),
    p95: Number(p95.toFixed(2)),
    p99: Number(p99.toFixed(2)),
    reductionPct: Number(reductionPct.toFixed(2)),
  };
});

const metCount = rows.filter((row) => row.reductionPct >= 20).length;

const lines = [
  '# Category 3 Remediation Benchmark Summary',
  '',
  'Baseline source: `prd_dev_branch_one/PHASE_1_PRD_BUNDLE/PHASE_1_AUDIT_REPORT.md`',
  '',
  '| Endpoint | P50 (after) | P95 (after) | P99 (after) | P95 reduction vs baseline |',
  '| --- | ---: | ---: | ---: | ---: |',
  ...rows.map(
    (row) =>
      `| ${row.endpoint} | ${row.p50} ms | ${row.p95} ms | ${row.p99} ms | ${row.reductionPct}% |`,
  ),
  '',
  `Endpoints meeting >=20% P95 reduction: ${metCount}`,
  '',
];

fs.writeFileSync(path.join(evidenceDir, 'c3-remediation-summary.md'), lines.join('\n'));
console.log('Generated c3-remediation-summary.md');
