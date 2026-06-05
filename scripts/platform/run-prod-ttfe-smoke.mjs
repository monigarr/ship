#!/usr/bin/env node
/**
 * Production TTFE smoke against deployed Ship (Render).
 * Full loop requires super-admin credentials to register a scoped OAuth app and verify device codes.
 *
 * Usage:
 *   SHIP_PROD_EMAIL=... SHIP_PROD_PASSWORD=... node scripts/platform/run-prod-ttfe-smoke.mjs
 *   node scripts/platform/run-prod-ttfe-smoke.mjs   # endpoint-only smoke (no credentials)
 */
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const { ShipClient, verifyWebhook } = await import(
  pathToFileURL(path.join(root, 'sdk/dist/index.js')).href
);

const BASE = process.env.SHIP_API_URL ?? 'https://ship-web-jyqh.onrender.com';
const EMAIL = process.env.SHIP_PROD_EMAIL;
const PASSWORD = process.env.SHIP_PROD_PASSWORD;

function parseCookies(setCookie) {
  const jar = new Map();
  for (const line of setCookie ?? []) {
    const [pair] = line.split(';');
    const idx = pair.indexOf('=');
    if (idx > 0) jar.set(pair.slice(0, idx), pair.slice(idx + 1));
  }
  return jar;
}

function cookieHeader(jar) {
  return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join('; ');
}

async function api(path, { method = 'GET', body, jar, csrf } = {}) {
  const headers = { Accept: 'application/json' };
  if (body) headers['Content-Type'] = 'application/json';
  if (csrf) headers['x-csrf-token'] = csrf;
  if (jar && jar.size) headers.Cookie = cookieHeader(jar);

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }
  const setCookie = res.headers.getSetCookie?.() ?? [];
  return { status: res.status, json, setCookie };
}

function startTestListener() {
  return new Promise((resolve) => {
    const deliveries = [];
    const server = http.createServer((req, res) => {
      const chunks = [];
      req.on('data', (c) => chunks.push(c));
      req.on('end', () => {
        const body = Buffer.concat(chunks).toString('utf8');
        const headers = {};
        for (const [k, v] of Object.entries(req.headers)) {
          if (typeof v === 'string') headers[k] = v;
        }
        deliveries.push({ headers, body });
        res.statusCode = 200;
        res.end('ok');
      });
    });
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      resolve({
        url: `http://127.0.0.1:${port}/hook`,
        waitFor: async (predicate, { timeoutMs = 15_000 } = {}) => {
          const deadline = Date.now() + timeoutMs;
          while (Date.now() < deadline) {
            for (const d of deliveries) {
              if (predicate(d.headers, d.body)) {
                return { ...d, event: JSON.parse(d.body) };
              }
            }
            await new Promise((r) => setTimeout(r, 200));
          }
          throw new Error('Timed out waiting for webhook delivery');
        },
        close: () => new Promise((done, reject) => server.close((e) => (e ? reject(e) : done()))),
      });
    });
  });
}

async function endpointSmoke() {
  console.log(`Endpoint smoke: ${BASE}\n`);
  let ok = true;

  const me = await api('/api/v1/me');
  ok = me.status === 401 && ok;
  console.log(ok ? 'OK' : 'FAIL', 'GET /api/v1/me → 401 without token');

  const spec = await api('/api/v1/openapi.json');
  const paths = Object.keys(spec.json?.paths ?? {});
  for (const required of ['/oauth/device/code', '/webhooks', '/issues']) {
    const present = paths.includes(required);
    ok = present && ok;
    console.log(present ? 'OK' : 'FAIL', `OpenAPI path ${required}`);
  }

  const device = await api('/api/v1/oauth/device/code', {
    method: 'POST',
    body: { client_id: 'ship_9ba67d9391c53a610558563b93627298', scope: 'documents:read' },
  });
  ok = device.status === 200 && device.json?.user_code && ok;
  console.log(ok ? 'OK' : 'FAIL', 'POST /api/v1/oauth/device/code → user_code');

  return ok;
}

async function fullTtfeSmoke() {
  if (!EMAIL || !PASSWORD) {
    console.log('\nSkipping full TTFE loop — set SHIP_PROD_EMAIL and SHIP_PROD_PASSWORD for end-to-end smoke.');
    return false;
  }

  console.log('\nFull TTFE loop against production...\n');
  const t0 = performance.now();
  const jar = new Map();

  const csrfRes = await api('/api/csrf-token');
  for (const c of csrfRes.setCookie) {
    const [pair] = c.split(';');
    const idx = pair.indexOf('=');
    jar.set(pair.slice(0, idx), pair.slice(idx + 1));
  }
  const csrf = csrfRes.json?.token;

  const login = await api('/api/auth/login', {
    method: 'POST',
    jar,
    csrf,
    body: { email: EMAIL, password: PASSWORD },
  });
  if (login.status !== 200) throw new Error(`Login failed: ${login.status} ${JSON.stringify(login.json)}`);
  for (const c of login.setCookie) {
    const [pair] = c.split(';');
    const idx = pair.indexOf('=');
    jar.set(pair.slice(0, idx), pair.slice(idx + 1));
  }
  console.log('OK  super-admin login');

  const appRes = await api('/api/v1/oauth/apps', {
    method: 'POST',
    jar,
    csrf,
    body: {
      name: `TTFE smoke ${Date.now()}`,
      redirect_uris: ['https://example.local/cb'],
      requested_scopes: ['documents:write', 'webhooks:manage'],
    },
  });
  if (appRes.status !== 200 && appRes.status !== 201) {
    throw new Error(`OAuth app registration failed: ${appRes.status}`);
  }
  const clientId = appRes.json.client_id;
  console.log('OK  OAuth app registered', clientId);

  const listener = await startTestListener();
  const start = await api('/api/v1/oauth/device/code', {
    method: 'POST',
    body: { client_id: clientId, scope: 'documents:write webhooks:manage' },
  });
  if (start.status !== 200) throw new Error('device/code failed');

  const verify = await api('/api/v1/oauth/device/verify', {
    method: 'POST',
    jar,
    csrf,
    body: { user_code: start.json.user_code },
  });
  if (verify.status !== 200) throw new Error('device/verify failed');
  console.log('OK  device code verified');

  let tokenRes;
  for (let i = 0; i < 15; i++) {
    tokenRes = await api('/api/v1/oauth/token', {
      method: 'POST',
      body: {
        grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
        client_id: clientId,
        device_code: start.json.device_code,
      },
    });
    if (tokenRes.status === 200) break;
    await new Promise((r) => setTimeout(r, 2000));
  }
  if (tokenRes.status !== 200) throw new Error('device token poll failed');

  const client = new ShipClient({ baseUrl: BASE, token: tokenRes.json.access_token });
  const sub = await client.webhooks.create({ event: 'document.created', target_url: listener.url });
  const doc = await client.documents.create({ title: 'hello' });
  const delivery = await listener.waitFor((h, body) => verifyWebhook(h, body, sub.signing_secret), {
    timeoutMs: 10_000,
  });

  console.log('OK  document.created webhook verified');
  console.log(`OK  doc id ${doc.id}`);
  console.log(`OK  elapsed ${Math.round(performance.now() - t0)}ms`);
  await listener.close();
  return true;
}

async function main() {
  const endpointOk = await endpointSmoke();
  let fullOk = false;
  try {
    fullOk = await fullTtfeSmoke();
  } catch (err) {
    console.error('FAIL full TTFE:', err.message);
  }

  const pass = endpointOk && (fullOk || (!EMAIL && !PASSWORD));
  console.log(
    pass
      ? '\nProduction smoke passed (endpoint' + (fullOk ? ' + full TTFE' : ' only') + ').'
      : '\nProduction smoke failed.'
  );
  process.exit(pass ? 0 : 1);
}

main();
