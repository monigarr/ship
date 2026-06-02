import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { createApp } from '../app.js';
import { pool } from '../db/client.js';
import { insertOAuthApp } from './oauth.js';
import { issueAccessAndRefreshTokens, redeemRefreshToken } from './oauth-tokens.js';

describe('refresh token rotation', () => {
  const app = createApp();
  const runId = Date.now().toString(36);
  let workspaceId = '';
  let userId = '';
  let appId = '';
  let clientId = '';

  beforeAll(async () => {
    const ws = await pool.query(`INSERT INTO workspaces (name) VALUES ($1) RETURNING id`, [`RT ${runId}`]);
    workspaceId = ws.rows[0].id as string;
    const passwordHash = await bcrypt.hash('password', 10);
    const user = await pool.query(
      `INSERT INTO users (email, password_hash, name, is_super_admin, last_workspace_id)
       VALUES ($1, $2, 'RT User', TRUE, $3) RETURNING id`,
      [`rt-${runId}@ship.local`, passwordHash, workspaceId]
    );
    userId = user.rows[0].id as string;
    const oauthApp = await insertOAuthApp({
      ownerUserId: userId,
      workspaceId,
      name: 'RT App',
      redirectUris: ['https://example.local/cb'],
      requestedScopes: ['documents:read'],
    });
    appId = oauthApp.id;
    clientId = oauthApp.clientId;
  });

  afterAll(async () => {
    await pool.query('DELETE FROM oauth_refresh_tokens WHERE app_id = $1', [appId]);
    await pool.query('DELETE FROM oauth_access_tokens WHERE app_id = $1', [appId]);
    await pool.query('DELETE FROM oauth_apps WHERE id = $1', [appId]);
    await pool.query('DELETE FROM users WHERE id = $1', [userId]);
    await pool.query('DELETE FROM workspaces WHERE id = $1', [workspaceId]);
  });

  it('rotates refresh token and revokes family on reuse', async () => {
    const first = await issueAccessAndRefreshTokens({
      appId,
      userId,
      workspaceId,
      scopes: ['documents:read'],
    });

    const second = await redeemRefreshToken({
      clientId,
      refreshToken: first.refreshToken,
    });
    expect(second.refreshToken).not.toBe(first.refreshToken);

    await expect(
      redeemRefreshToken({ clientId, refreshToken: first.refreshToken })
    ).rejects.toMatchObject({ code: 'invalid_grant' });

    await expect(
      redeemRefreshToken({ clientId, refreshToken: second.refreshToken })
    ).rejects.toMatchObject({ code: 'invalid_grant' });
  });

  it('exchanges refresh_token grant via HTTP', async () => {
    const issued = await issueAccessAndRefreshTokens({
      appId,
      userId,
      workspaceId,
      scopes: ['documents:read'],
    });

    const res = await request(app)
      .post('/api/v1/oauth/token')
      .send({
        grant_type: 'refresh_token',
        client_id: clientId,
        refresh_token: issued.refreshToken,
      });

    expect(res.status).toBe(200);
    expect(res.body.access_token).toBeTypeOf('string');
    expect(res.body.refresh_token).toBeTypeOf('string');
  });
});
