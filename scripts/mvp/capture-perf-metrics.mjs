/**
 * Capture MVP perf metrics for scripts/mvp/perf-regression-check.mjs
 *
 * Usage (from repo root):
 *   node scripts/mvp/capture-perf-metrics.mjs
 *   node scripts/mvp/perf-regression-check.mjs
 *
 * Optional: PERF_PROBE_URL=http://127.0.0.1:3001 node scripts/mvp/capture-perf-metrics.mjs
 *   (adds live /health P95 samples; requires API running with QUERY_COUNT_METRICS=1 for query probe)
 */
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { gzipSync } from 'zlib';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '../..');

const assetsDir = path.join(repoRoot, 'web/dist/assets');
const outDir = path.join(repoRoot, 'artifacts/perf');
const outPath = path.join(outDir, 'current-metrics.json');
const c3EvidenceDir = path.join(
  repoRoot,
  'deliverables/2026-W21-week-01/PHASE_2_PRD_BUNDLE/evidence'
);

function ensureWebBuild() {
  if (process.env.SKIP_WEB_BUILD === '1' && fs.existsSync(assetsDir)) {
    return;
  }
  console.log('Building web (pnpm build:web)...');
  execSync('pnpm build:web', { cwd: repoRoot, stdio: 'inherit' });
}

/** Sum gzip-compressed sizes (KB) of all JS chunks shipped in the web build. */
function measureBundleSizeKb() {
  if (!fs.existsSync(assetsDir)) {
    throw new Error(`Missing ${assetsDir}. Run pnpm build:web first.`);
  }
  const files = fs.readdirSync(assetsDir).filter((f) => f.endsWith('.js'));
  let totalGzipBytes = 0;
  for (const file of files) {
    const raw = fs.readFileSync(path.join(assetsDir, file));
    totalGzipBytes += gzipSync(raw).length;
  }
  const kb = totalGzipBytes / 1024;
  console.log(`bundleSizeKb: ${kb.toFixed(2)} (${files.length} JS assets, gzip sum)`);
  return Math.ceil(kb);
}

/** Interpolate P95 from C3 autocannon JSON (same method as scripts/prd/generate-c3-summary.mjs). */
function p95FromC3Json(json) {
  const p90 = Number(json.latency.p90);
  const p975 = Number(json.latency.p97_5);
  return p90 + ((95 - 90) / (97.5 - 90)) * (p975 - p90);
}

/** Max API P95 from Part 1 C3 evidence (internal routes envelope). */
function measureApiP95FromC3Evidence() {
  if (!fs.existsSync(c3EvidenceDir)) {
    console.warn('C3 evidence dir missing; using fallback latency_p95_ms=500');
    return 500;
  }
  const files = fs
    .readdirSync(c3EvidenceDir)
    .filter((f) => f.startsWith('c3-perf-') && f.endsWith('-c25.json'));
  let maxP95 = 0;
  for (const file of files) {
    const raw = fs.readFileSync(path.join(c3EvidenceDir, file), 'utf8').replace(/^\uFEFF/, '');
    const json = JSON.parse(raw);
    const p95 = p95FromC3Json(json);
    maxP95 = Math.max(maxP95, p95);
  }
  console.log(`API P95 envelope (C3 c25, ${files.length} routes): ${maxP95.toFixed(2)} ms`);
  return Math.ceil(maxP95);
}

function percentile(sorted, p) {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[Math.max(0, idx)];
}

/** Optional live /health probe when PERF_PROBE_URL is set. */
async function measureLiveHealthP95(baseUrl) {
  const url = `${baseUrl.replace(/\/$/, '')}/health`;
  const samples = [];
  for (let i = 0; i < 50; i++) {
    const t0 = performance.now();
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${url} returned ${res.status}`);
    await res.text();
    samples.push(performance.now() - t0);
  }
  samples.sort((a, b) => a - b);
  const p95 = percentile(samples, 95);
  console.log(`Live /health P95 (${url}, n=50): ${p95.toFixed(2)} ms`);
  return Math.ceil(p95);
}

/** Probe query count for one route when metrics API is available. */
async function measureQueryCountPerRoute(baseUrl) {
  const root = baseUrl.replace(/\/$/, '');
  try {
    await fetch(`${root}/api/_metrics/query-count/reset`, { method: 'POST' });
    const docRes = await fetch(`${root}/api/documents`, {
      headers: { cookie: process.env.PERF_PROBE_COOKIE ?? '' },
    });
    if (!docRes.ok) {
      console.warn(`GET /api/documents returned ${docRes.status}; using estimate queryCountPerRoute=95`);
      return 95;
    }
    const metricsRes = await fetch(`${root}/api/_metrics/query-count`);
    if (!metricsRes.ok) {
      console.warn('Query metrics endpoint unavailable; using estimate queryCountPerRoute=95');
      return 95;
    }
    const body = await metricsRes.json();
    const count = Number(body?.data?.queryCount ?? 0);
    console.log(`queryCount (1 route GET /api/documents): ${count}`);
    return Math.max(1, Math.ceil(count));
  } catch (err) {
    console.warn(`Query count probe failed: ${err.message}; using estimate queryCountPerRoute=95`);
    return 95;
  }
}

async function main() {
  ensureWebBuild();
  const bundleSizeKb = measureBundleSizeKb();

  let latency_p95_ms = measureApiP95FromC3Evidence();
  let queryCountPerRoute = 95;

  const probeUrl = process.env.PERF_PROBE_URL;
  if (probeUrl) {
    const liveP95 = await measureLiveHealthP95(probeUrl);
    latency_p95_ms = Math.max(latency_p95_ms, liveP95);
    queryCountPerRoute = await measureQueryCountPerRoute(probeUrl);
  }

  const metrics = {
    capturedAt: new Date().toISOString(),
    bundleSizeKb,
    latency_p95_ms,
    queryCountPerRoute,
    notes: {
      bundle: 'gzip sum of web/dist/assets/*.js',
      latency: probeUrl
        ? 'max(C3 internal-route P95 envelope, live /health P95)'
        : 'max C3 internal-route P95 from Week 01 evidence',
      queryCount: probeUrl
        ? 'pool.query count after GET /api/documents with QUERY_COUNT_METRICS=1'
        : 'estimate when PERF_PROBE_URL unset',
    },
  };

  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(outPath, `${JSON.stringify(metrics, null, 2)}\n`);
  console.log(`Wrote ${outPath}`);
  console.log(JSON.stringify(metrics, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
