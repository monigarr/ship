/**
 * Playwright Global Setup
 *
 * Runs once before all tests start. Builds both API and Web so each
 * worker can spawn fresh, lightweight server instances quickly.
 *
 * CRITICAL: We build web upfront so workers can use `vite preview`
 * instead of `vite dev`. This prevents the 90GB memory explosion that
 * occurred when 8 workers each ran full Vite dev servers with HMR.
 *
 * CI (mvp-gates) builds API/Web before E2E; set SKIP_E2E_GLOBAL_BUILD=true
 * to reuse those artifacts and avoid duplicate compiles.
 */

import { execSync } from 'child_process';
import { existsSync } from 'fs';
import path from 'path';
import os from 'os';

const PROJECT_ROOT = path.resolve(__dirname, '..');
const API_DIST_ENTRY = path.join(PROJECT_ROOT, 'api/dist/index.js');
const WEB_DIST_INDEX = path.join(PROJECT_ROOT, 'web/dist/index.html');

function assertBuildArtifacts(): void {
  const missing: string[] = [];
  if (!existsSync(API_DIST_ENTRY)) {
    missing.push('api/dist (pnpm build:api)');
  }
  if (!existsSync(WEB_DIST_INDEX)) {
    missing.push('web/dist (pnpm build:web with VITE_APP_ENV=test_e2e)');
  }
  if (missing.length > 0) {
    throw new Error(`E2E build artifacts missing: ${missing.join('; ')}`);
  }
}

function buildApiAndWeb(): void {
  console.log('\nBuilding API for tests...');
  try {
    execSync('pnpm build:api', {
      cwd: PROJECT_ROOT,
      stdio: 'inherit',
    });
    console.log('✓ API build complete');
  } catch (error) {
    console.error('Failed to build API:', error);
    throw error;
  }

  console.log('\nBuilding Web for tests (enables lightweight preview servers)...');
  try {
    execSync('pnpm build:web', {
      cwd: PROJECT_ROOT,
      stdio: 'inherit',
      env: { ...process.env, VITE_APP_ENV: 'test_e2e' },
    });
    console.log('✓ Web build complete');
  } catch (error) {
    console.error('Failed to build Web:', error);
    throw error;
  }
}

export default async function globalSetup() {
  const totalMemGB = os.totalmem() / (1024 * 1024 * 1024);
  const freeMemGB = os.freemem() / (1024 * 1024 * 1024);
  console.log(`\n[Memory] Total: ${totalMemGB.toFixed(1)}GB, Available: ${freeMemGB.toFixed(1)}GB`);

  if (freeMemGB < 4) {
    console.warn(`⚠️  WARNING: Low memory (${freeMemGB.toFixed(1)}GB free)`);
    console.warn(`   Consider closing other apps or reducing workers.`);
    console.warn(`   Each worker needs ~500MB (Postgres + API + Preview)`);
  }

  if (process.env.SKIP_E2E_GLOBAL_BUILD === 'true') {
    assertBuildArtifacts();
    console.log('\nℹ️  Skipping API/Web rebuild (SKIP_E2E_GLOBAL_BUILD); using existing dist artifacts.');
  } else {
    buildApiAndWeb();
  }

  console.log('\n✓ Global setup complete. Starting tests...\n');
}
