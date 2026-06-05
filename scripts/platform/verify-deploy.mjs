#!/usr/bin/env node
/**
 * Verify deployed Ship instance exposes Week 03 post-MVP routes.
 * Usage: node scripts/platform/verify-deploy.mjs [baseUrl]
 */
const BASE = process.argv[2] ?? 'https://ship-web-jyqh.onrender.com';

const REQUIRED_OPENAPI_PATHS = [
  '/oauth/device/code',
  '/oauth/device/verify',
  '/webhooks',
  '/webhooks/deliveries',
];

async function check(name, fn) {
  try {
    await fn();
    console.log(`OK  ${name}`);
    return true;
  } catch (err) {
    console.error(`FAIL ${name}: ${err.message}`);
    return false;
  }
}

async function main() {
  console.log(`Verifying deployment: ${BASE}\n`);
  let ok = true;

  ok =
    (await check('health (via /api/v1/me auth gate)', async () => {
      const res = await fetch(`${BASE}/api/v1/me`);
      if (res.status !== 401) throw new Error(`expected 401, got ${res.status}`);
    })) && ok;

  ok =
    (await check('public OpenAPI', async () => {
      const res = await fetch(`${BASE}/api/v1/openapi.json`);
      if (!res.ok) throw new Error(`status ${res.status}`);
      const spec = await res.json();
      const paths = Object.keys(spec.paths ?? {});
      for (const p of REQUIRED_OPENAPI_PATHS) {
        if (!paths.includes(p)) {
          throw new Error(`missing path ${p} — redeploy gfa2_wk6-final required`);
        }
      }
    })) && ok;

  ok =
    (await check('SPA /developer route', async () => {
      const res = await fetch(`${BASE}/developer`);
      if (!res.ok) throw new Error(`status ${res.status}`);
      const html = await res.text();
      if (!html.includes('Ship')) throw new Error('unexpected HTML');
    })) && ok;

  ok =
    (await check('SPA /oauth/device route', async () => {
      const res = await fetch(`${BASE}/oauth/device`);
      if (!res.ok) throw new Error(`status ${res.status}`);
    })) && ok;

  ok =
    (await check('bearer enforcement /api/v1/me', async () => {
      const res = await fetch(`${BASE}/api/v1/me`);
      if (res.status !== 401) throw new Error(`expected 401, got ${res.status}`);
      const body = await res.json();
      if (!body.request_id) throw new Error('missing ApiError shape');
    })) && ok;

  console.log(ok ? '\nAll deployment checks passed.' : '\nSome checks failed — redeploy from gfa2_wk6-final.');
  process.exit(ok ? 0 : 1);
}

main();
