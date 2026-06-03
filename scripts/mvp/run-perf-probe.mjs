/**
 * Orchestrate live MVP perf probe for measured query counts.
 *
 * Usage (from repo root, after build:api + build:web + db:migrate):
 *   node scripts/mvp/run-perf-probe.mjs
 *   node scripts/mvp/perf-regression-check.mjs
 *
 * Requires DATABASE_URL. Seeds dev@ship.local / admin123 unless SKIP_PERF_SEED=1.
 */
import { execSync, spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '../..');
const apiDist = path.join(repoRoot, 'api/dist/index.js');
const webDist = path.join(repoRoot, 'web/dist/index.html');
const metricsPath = path.join(repoRoot, 'artifacts/perf/current-metrics.json');

const PROBE_PORT = process.env.PERF_PROBE_PORT ?? '3001';
const PROBE_URL = `http://127.0.0.1:${PROBE_PORT}`;
const STARTUP_TIMEOUT_MS = 60_000;

function assertPrerequisites() {
  if (!fs.existsSync(apiDist)) {
    throw new Error(`Missing ${apiDist}. Run: pnpm build:api`);
  }
  if (!fs.existsSync(webDist)) {
    throw new Error(`Missing ${webDist}. Run: pnpm build:web`);
  }
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required');
  }
}

async function waitForServer(url, timeout) {
  const start = Date.now();
  let lastError = null;
  while (Date.now() - start < timeout) {
    try {
      const res = await fetch(url);
      if (res.ok || res.status === 401 || res.status === 403) {
        return;
      }
    } catch (err) {
      lastError = err;
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(
    `Server at ${url} did not start within ${timeout}ms. Last error: ${lastError?.message}`
  );
}

function runSeed() {
  if (process.env.SKIP_PERF_SEED === '1') {
    console.log('Skipping db:seed (SKIP_PERF_SEED=1)');
    return;
  }
  console.log('Seeding database (pnpm --filter @ship/api db:seed)...');
  execSync('pnpm --filter @ship/api db:seed', { cwd: repoRoot, stdio: 'inherit' });
}

function startApi() {
  console.log(`Starting API on ${PROBE_URL} with QUERY_COUNT_METRICS=1...`);
  const proc = spawn('node', ['dist/index.js'], {
    cwd: path.join(repoRoot, 'api'),
    env: {
      ...process.env,
      PORT: PROBE_PORT,
      NODE_ENV: 'test',
      QUERY_COUNT_METRICS: '1',
      CORS_ORIGIN: '*',
      SESSION_SECRET: process.env.SESSION_SECRET ?? 'dev-only-secret-do-not-use-in-production',
    },
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  proc.stderr?.on('data', (data) => {
    if (process.env.DEBUG === '1') {
      console.error(`API: ${data.toString().trim()}`);
    }
  });
  return proc;
}

function parseCookieHeader(setCookieHeader) {
  if (!setCookieHeader) return '';
  const parts = Array.isArray(setCookieHeader) ? setCookieHeader : [setCookieHeader];
  return parts.map((cookie) => cookie.split(';')[0]).join('; ');
}

async function loginForCookie(baseUrl) {
  const csrfRes = await fetch(`${baseUrl}/api/csrf-token`);
  if (!csrfRes.ok) {
    throw new Error(`CSRF token request failed (${csrfRes.status})`);
  }
  const csrfBody = await csrfRes.json();
  const csrfToken = csrfBody?.token;
  if (!csrfToken) {
    throw new Error('CSRF token response missing token');
  }
  const csrfCookie = parseCookieHeader(csrfRes.headers.getSetCookie?.() ?? csrfRes.headers.get('set-cookie'));

  const res = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-csrf-token': csrfToken,
      ...(csrfCookie ? { cookie: csrfCookie } : {}),
    },
    body: JSON.stringify({ email: 'dev@ship.local', password: 'admin123' }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Login failed (${res.status}): ${body}`);
  }
  const loginCookies = parseCookieHeader(res.headers.getSetCookie?.() ?? res.headers.get('set-cookie'));
  const cookieHeader = [csrfCookie, loginCookies].filter(Boolean).join('; ');
  if (!cookieHeader.includes('session_id=')) {
    throw new Error(`Login succeeded but session_id cookie missing: ${cookieHeader}`);
  }
  return cookieHeader;
}

function runCapture(probeUrl, cookie) {
  console.log('Running capture-perf-metrics.mjs with live probe...');
  execSync('node scripts/mvp/capture-perf-metrics.mjs', {
    cwd: repoRoot,
    stdio: 'inherit',
    env: {
      ...process.env,
      PERF_PROBE_URL: probeUrl,
      PERF_PROBE_COOKIE: cookie,
      SKIP_WEB_BUILD: '1',
    },
  });
}

function assertMeasuredMetrics() {
  const metrics = JSON.parse(fs.readFileSync(metricsPath, 'utf8'));
  const note = metrics.notes?.queryCount ?? '';
  if (note.includes('estimate')) {
    throw new Error(`Query count was not measured: ${note}`);
  }
  console.log(`Measured queryCountPerRoute: ${metrics.queryCountPerRoute}`);
}

async function stopApi(proc) {
  proc.kill('SIGTERM');
  await new Promise((r) => setTimeout(r, 500));
  if (!proc.killed) {
    proc.kill('SIGKILL');
  }
}

async function main() {
  assertPrerequisites();
  runSeed();
  const apiProc = startApi();
  try {
    await waitForServer(`${PROBE_URL}/health`, STARTUP_TIMEOUT_MS);
    const cookie = await loginForCookie(PROBE_URL);
    runCapture(PROBE_URL, cookie);
    assertMeasuredMetrics();
  } finally {
    await stopApi(apiProc);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
