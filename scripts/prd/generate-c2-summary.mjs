import fs from 'node:fs';
import path from 'node:path';

const evidenceDir = path.resolve('deliverables/2026-W21-week-01/PHASE_2_PRD_BUNDLE/evidence');
const buildLogPath = path.join(evidenceDir, 'build-closeout.log');
const buildLog = fs.readFileSync(buildLogPath, 'utf8');

const baselineLargestChunkKb = 2025.14;
const baselineTotalDistKb = 11625.94;

const indexMatch = buildLog.match(/dist\/assets\/index-[^.\s]+\.js\s+([0-9,]+\.[0-9]+)\s+kB/);
const currentLargestChunkKb = indexMatch ? Number(indexMatch[1].replace(/,/g, '')) : null;

const distDir = path.resolve('web/dist');
function getDirectoryBytes(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  let total = 0;
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      total += getDirectoryBytes(full);
    } else if (entry.isFile()) {
      total += fs.statSync(full).size;
    }
  }
  return total;
}

const currentTotalDistKb = Number((getDirectoryBytes(distDir) / 1024).toFixed(2));
const totalReductionPct = Number((((baselineTotalDistKb - currentTotalDistKb) / baselineTotalDistKb) * 100).toFixed(2));
const initialReductionPct = currentLargestChunkKb === null
  ? null
  : Number((((baselineLargestChunkKb - currentLargestChunkKb) / baselineLargestChunkKb) * 100).toFixed(2));

const lines = [
  '# Category 2 After Bundle Summary',
  '',
  'Baseline source: `deliverables/2026-W21-week-01/PHASE_1_PRD_BUNDLE/PHASE_1_AUDIT_REPORT.md`',
  '',
  `- Baseline total dist size: ${baselineTotalDistKb} KB`,
  `- Current total dist size: ${currentTotalDistKb} KB`,
  `- Total dist reduction: ${totalReductionPct}%`,
  '',
  `- Baseline largest chunk: ${baselineLargestChunkKb} KB`,
  `- Current index chunk: ${currentLargestChunkKb ?? 'N/A'} KB`,
  `- Initial chunk reduction: ${initialReductionPct ?? 'N/A'}%`,
  '',
  `- Total-size target (>=15%): ${totalReductionPct >= 15 ? 'Met' : 'Not Met'}`,
  `- Initial-load target (>=20%): ${initialReductionPct !== null && initialReductionPct >= 20 ? 'Met' : 'Not Met'}`,
  '',
];

fs.writeFileSync(path.join(evidenceDir, 'c2-after-summary.md'), lines.join('\n'));
console.log('Generated c2-after-summary.md');
