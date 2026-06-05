import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '../..');

const baselinePath = path.join(repoRoot, 'deliverables/2026-W23-week-03/perf-baseline.json');
const currentPath = path.join(repoRoot, 'artifacts/perf/current-metrics.json');
const threshold = 1.1;

if (!fs.existsSync(baselinePath)) {
  console.error(`Missing perf baseline file: ${baselinePath}`);
  process.exit(1);
}

if (!fs.existsSync(currentPath)) {
  console.log(`No current perf metrics at ${currentPath}. Skipping strict perf check.`);
  process.exit(0);
}

const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
const current = JSON.parse(fs.readFileSync(currentPath, 'utf8'));

const queryCountNote = current.notes?.queryCount ?? '';
if (queryCountNote.includes('estimate')) {
  console.error(
    'Performance regression check failed: queryCountPerRoute is estimated, not measured. ' +
      'Run node scripts/mvp/run-perf-probe.mjs (sets PERF_PROBE_URL + QUERY_COUNT_METRICS=1).'
  );
  process.exit(1);
}

const checks = [
  { metric: 'latency_p95_ms', label: 'P95 latency' },
  { metric: 'bundleSizeKb', label: 'bundle size' },
  { metric: 'queryCountPerRoute', label: 'query count per route' },
];

const failures = [];
for (const check of checks) {
  const baselineValue = Number(baseline[check.metric]);
  const currentValue = Number(current[check.metric]);

  if (!Number.isFinite(baselineValue) || !Number.isFinite(currentValue)) {
    failures.push(`${check.label}: invalid values (baseline=${baselineValue}, current=${currentValue})`);
    continue;
  }

  const allowedMax = baselineValue * threshold;
  if (currentValue > allowedMax) {
    failures.push(
      `${check.label}: current ${currentValue} exceeds allowed ${allowedMax.toFixed(2)} (baseline ${baselineValue})`
    );
  }
}

if (failures.length > 0) {
  console.error('Performance regression check failed:');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log('Performance regression check passed (<= +10% across tracked metrics).');
