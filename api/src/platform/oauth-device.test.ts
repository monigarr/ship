import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { createApp } from '../app.js';
import { pool } from '../db/client.js';
import { insertOAuthApp } from './oauth.js';

describe('device authorization grant', () => {
  const app = createApp();
  const runId = Date.now().toString(36);
  let workspaceId = '';
  let userId = '';
  let cookieHeader = '';
  let clientId = '';

  beforeAll(async () => {
    const ws = await pool.query(`INSERT INTO workspaces (name) VALUES ($1) RETURNING id`, [`DV ${runId}`]);
    workspaceId = ws.rows[0].id as string;
    const passwordHash = await bcrypt.hash('AdminPassword123!', 10);
    const user = await pool.query(
      `INSERT INTO users (email, password_hash, name, is_super_admin, last_workspace_id)
       VALUES ($1, $2, 'DV', TRUE, $3) RETURNING id`,
      [`dv-${runId}@ship.local`, passwordHash, workspaceId]
    );
    userId = user.rows[0].id as string;

    const oauthApp = await insertOAuthApp({
      ownerUserId: userId,
      workspaceId,
      name: 'Device App',
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
      .send({ email: `dv-${runId}@ship.local`, password: 'AdminPassword123!' });
    const cookies = loginRes.headers['set-cookie'] as string[] | undefined;
    cookieHeader = (cookies ?? []).map((c) => c.split(';')[0]).join('; ');
  });

  afterAll(async () => {
    await pool.query('DELETE FROM oauth_device_codes WHERE app_id IN (SELECT id FROM oauth_apps WHERE client_id = $1)', [clientId]);
    await pool.query('DELETE FROM oauth_refresh_tokens WHERE app_id IN (SELECT id FROM oauth_apps WHERE client_id = $1)', [clientId]);
    await pool.query('DELETE FROM oauth_access_tokens WHERE app_id IN (SELECT id FROM oauth_apps WHERE client_id = $1)', [clientId]);
    await pool.query('DELETE FROM oauth_apps WHERE client_id = $1', [clientId]);
    await pool.query('DELETE FROM users WHERE id = $1', [userId]);
    await pool.query('DELETE FROM workspaces WHERE id = $1', [workspaceId]);
  });

  it('completes device flow with slow_down honored', async () => {
    const start = await request(app)
      .post('/api/v1/oauth/device/code')
      .send({ client_id: clientId, scope: 'documents:read documents:write' });

    expect(start.status).toBe(200);
    expect(start.body.user_code).toBeTypeOf('string');

    const pending = await request(app)
      .post('/api/v1/oauth/token')
      .send({
        grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
        client_id: clientId,
        device_code: start.body.device_code,
      });
    expect(pending.status).toBe(400);
    expect(pending.body.error).toBe('authorization_pending');

    const fast = await request(app)
      .post('/api/v1/oauth/token')
      .send({
        grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
        client_id: clientId,
        device_code: start.body.device_code,
      });
    expect(fast.status).toBe(400);
    expect(['slow_down', 'authorization_pending']).toContain(fast.body.error);

    const verify = await request(app)
      .post('/api/v1/oauth/device/verify')
      .set('Cookie', cookieHeader)
      .send({ user_code: start.body.user_code });
    expect(verify.status).toBe(200);

    let tokenRes = await request(app)
      .post('/api/v1/oauth/token')
      .send({
        grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
        client_id: clientId,
        device_code: start.body.device_code,
      });

    for (let i = 0; i < 5 && tokenRes.status !== 200; i++) {
      await new Promise((r) => setTimeout(r, 6000));
      tokenRes = await request(app)
        .post('/api/v1/oauth/token')
        .send({
          grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
          client_id: clientId,
          device_code: start.body.device_code,
        });
    }

    expect(tokenRes.status).toBe(200);
    expect(tokenRes.body.access_token).toBeTypeOf('string');

    const me = await request(app)
      .get('/api/v1/me')
      .set('Authorization', `Bearer ${tokenRes.body.access_token}`);
    expect(me.status).toBe(200);
  });
});
