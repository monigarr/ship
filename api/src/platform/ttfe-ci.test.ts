import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import { createApp } from '../app.js';
import { pool } from '../db/client.js';
import { insertOAuthApp } from './oauth.js';
import { ShipClient, verifyWebhook } from '@ship/sdk';

function startTestListener(): Promise<{
  url: string;
  waitFor: (
    predicate: (headers: Record<string, string>, body: string) => boolean,
    opts?: { timeoutMs?: number }
  ) => Promise<{ headers: Record<string, string>; body: string; event: { type: string } }>;
  close: () => Promise<void>;
}> {
  return new Promise((resolve) => {
    const deliveries: Array<{ headers: Record<string, string>; body: string }> = [];

    const server = http.createServer((req, res) => {
      const chunks: Buffer[] = [];
      req.on('data', (chunk) => chunks.push(chunk as Buffer));
      req.on('end', () => {
        const body = Buffer.concat(chunks).toString('utf8');
        const headers: Record<string, string> = {};
        for (const [key, value] of Object.entries(req.headers)) {
          if (typeof value === 'string') headers[key] = value;
        }
        deliveries.push({ headers, body });
        res.statusCode = 200;
        res.end('ok');
      });
    });

    server.listen(0, '127.0.0.1', () => {
      const addr = server.address() as AddressInfo;
      const url = `http://127.0.0.1:${addr.port}/hook`;

      resolve({
        url,
        waitFor: async (predicate, opts) => {
          const timeoutMs = opts?.timeoutMs ?? 15_000;
          const deadline = Date.now() + timeoutMs;
          while (Date.now() < deadline) {
            for (const d of deliveries) {
              if (predicate(d.headers, d.body)) {
                const parsed = JSON.parse(d.body) as { type: string };
                return { ...d, event: parsed };
              }
            }
            await new Promise((r) => setTimeout(r, 200));
          }
          throw new Error('Timed out waiting for webhook delivery');
        },
        close: () =>
          new Promise((done, reject) => {
            server.close((err) => (err ? reject(err) : done()));
          }),
      });
    });
  });
}

describe('TTFE CI drill', () => {
  const app = createApp();
  const runId = Date.now().toString(36);
  let clientId = '';
  let cookieHeader = '';
  let baseUrl = '';
  let apiServer: http.Server;

  beforeAll(async () => {
    await new Promise<void>((resolve) => {
      apiServer = http.createServer(app);
      apiServer.listen(0, '127.0.0.1', () => {
        const addr = apiServer.address() as AddressInfo;
        baseUrl = `http://127.0.0.1:${addr.port}`;
        resolve();
      });
    });

    const ws = await pool.query(`INSERT INTO workspaces (name) VALUES ($1) RETURNING id`, [`TTFE ${runId}`]);
    const workspaceId = ws.rows[0].id as string;
    const passwordHash = await bcrypt.hash('TtfeCiPassword123!', 10);
    const user = await pool.query(
      `INSERT INTO users (email, password_hash, name, is_super_admin, last_workspace_id)
       VALUES ($1, $2, 'TTFE', TRUE, $3) RETURNING id`,
      [`ttfe-${runId}@ship.local`, passwordHash, workspaceId]
    );
    const userId = user.rows[0].id as string;
    await pool.query(
      `INSERT INTO workspace_memberships (workspace_id, user_id, role) VALUES ($1, $2, 'admin')`,
      [workspaceId, userId]
    );

    const oauthApp = await insertOAuthApp({
      ownerUserId: userId,
      workspaceId,
      name: 'TTFE CI',
      redirectUris: ['https://example.local/cb'],
      requestedScopes: ['documents:read', 'documents:write', 'webhooks:manage'],
    });
    clientId = oauthApp.clientId;

    const csrfRes = await request(app).get('/api/csrf-token');
    const csrfToken = csrfRes.body.token as string;
    const baseCookie = csrfRes.headers['set-cookie']?.[0]?.split(';')[0] ?? '';
    const loginRes = await request(app)
      .post('/api/auth/login')
      .set('Cookie', baseCookie)
      .set('x-csrf-token', csrfToken)
      .send({ email: `ttfe-${runId}@ship.local`, password: 'TtfeCiPassword123!' });
    expect(loginRes.status).toBe(200);
    const cookies = loginRes.headers['set-cookie'] as string[] | undefined;
    cookieHeader = (cookies ?? []).map((c) => c.split(';')[0]).join('; ');
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      apiServer.close((err) => (err ? reject(err) : resolve()));
    });
  });

  it('completes time to first event under 60s', async () => {
    const t0 = performance.now();
    const listener = await startTestListener();

    const start = await request(baseUrl)
      .post('/api/v1/oauth/device/code')
      .send({ client_id: clientId, scope: 'documents:write webhooks:manage' });
    expect(start.status).toBe(200);

    const verify = await request(baseUrl)
      .post('/api/v1/oauth/device/verify')
      .set('Cookie', cookieHeader)
      .send({ user_code: start.body.user_code });
    expect(verify.status).toBe(200);

    let tokenRes = await request(baseUrl)
      .post('/api/v1/oauth/token')
      .send({
        grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
        client_id: clientId,
        device_code: start.body.device_code,
      });

    for (let i = 0; i < 10 && tokenRes.status !== 200; i++) {
      await new Promise((r) => setTimeout(r, 2000));
      tokenRes = await request(baseUrl)
        .post('/api/v1/oauth/token')
        .send({
          grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
          client_id: clientId,
          device_code: start.body.device_code,
        });
    }

    expect(tokenRes.status).toBe(200);
    const accessToken = tokenRes.body.access_token as string;

    const client = new ShipClient({ baseUrl, token: accessToken });

    const sub = await client.webhooks.create({
      event: 'document.created',
      target_url: listener.url,
    });

    const doc = await client.documents.create({ title: 'hello' });

    const delivery = await listener.waitFor(
      (h, body) => verifyWebhook(h, body, sub.signing_secret),
      { timeoutMs: 10_000 }
    );

    expect(delivery.event.type).toBe('document.created');
    expect(doc.id).toBeTruthy();
    expect(performance.now() - t0).toBeLessThan(60_000);

    await listener.close();
  });
});
