import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { Request } from 'express';
import { createApp } from '../app.js';
import { pool } from '../db/client.js';
import { getPublicRouteMetadata } from './spec/route-metadata.js';
import { generatePublicOpenApiSpec } from './spec/openapi.js';

function getCookiesArray(setCookie: string | string[] | undefined): string[] {
  if (!setCookie) return [];
  return Array.isArray(setCookie) ? setCookie : [setCookie];
}

function pkceChallenge(verifier: string): string {
  return crypto.createHash('sha256').update(verifier).digest('base64url');
}

describe('public MVP hard-gates', () => {
  const app = createApp();
  const runId = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const workspaceName = `Public API Workspace ${runId}`;
  const adminEmail = `public-admin-${runId}@ship.local`;
  const adminPassword = 'AdminPassword123!';
  const userName = 'Public API Admin';
  const redirectUri = 'https://example.local/callback';

  let workspaceId = '';
  let adminUserId = '';
  let cookieHeader = '';
  let oauthClientId = '';
  let oauthClientSecret = '';
  let accessToken = '';

  beforeAll(async () => {
    const ws = await pool.query(
      `INSERT INTO workspaces (name) VALUES ($1) RETURNING id`,
      [workspaceName]
    );
    workspaceId = ws.rows[0].id as string;

    const passwordHash = await bcrypt.hash(adminPassword, 10);
    const user = await pool.query(
      `INSERT INTO users (email, password_hash, name, is_super_admin, last_workspace_id)
       VALUES ($1, $2, $3, TRUE, $4)
       RETURNING id`,
      [adminEmail, passwordHash, userName, workspaceId]
    );
    adminUserId = user.rows[0].id as string;

    await pool.query(
      `INSERT INTO workspace_memberships (workspace_id, user_id, role)
       VALUES ($1, $2, 'admin')`,
      [workspaceId, adminUserId]
    );

    const csrfRes = await request(app).get('/api/csrf-token');
    const csrfToken = csrfRes.body.token as string;
    const baseCookie = csrfRes.headers['set-cookie']?.[0]?.split(';')[0] ?? '';

    const loginRes = await request(app)
      .post('/api/auth/login')
      .set('Cookie', baseCookie)
      .set('x-csrf-token', csrfToken)
      .send({ email: adminEmail, password: adminPassword });

    const cookies = getCookiesArray(loginRes.headers['set-cookie']);
    cookieHeader = cookies.map((cookie) => cookie.split(';')[0]).join('; ');
  });

  afterAll(async () => {
    await pool.query('DELETE FROM oauth_access_tokens WHERE user_id = $1', [adminUserId]);
    await pool.query('DELETE FROM oauth_authorization_codes WHERE user_id = $1', [adminUserId]);
    await pool.query('DELETE FROM oauth_apps WHERE owner_user_id = $1', [adminUserId]);
    await pool.query('DELETE FROM workspace_memberships WHERE user_id = $1', [adminUserId]);
    await pool.query('DELETE FROM users WHERE id = $1', [adminUserId]);
    await pool.query('DELETE FROM workspaces WHERE id = $1', [workspaceId]);
  });

  it('registers OAuth app and reveals secret once', async () => {
    const response = await request(app)
      .post('/api/v1/oauth/apps')
      .set('Cookie', cookieHeader)
      .send({
        name: 'Public MVP App',
        redirect_uris: [redirectUri],
        requested_scopes: ['documents:read', 'documents:write'],
      });

    expect(response.status).toBe(201);
    expect(response.body.client_id).toBeTypeOf('string');
    expect(response.body.client_secret).toBeTypeOf('string');
    oauthClientId = response.body.client_id as string;
    oauthClientSecret = response.body.client_secret as string;

    const db = await pool.query(
      `SELECT client_secret_hash FROM oauth_apps WHERE client_id = $1`,
      [oauthClientId]
    );
    expect(db.rows).toHaveLength(1);
    expect(db.rows[0].client_secret_hash).not.toBe(oauthClientSecret);
  });

  it('completes authorization code + PKCE flow and returns typed me payload', async () => {
    const state = `state-${runId}`;
    const verifier = 'abcdefghijklmnopqrstuvwxyz1234567890abcdefghijk';
    const challenge = pkceChallenge(verifier);

    const authorizeRes = await request(app)
      .get('/api/v1/oauth/authorize')
      .set('Cookie', cookieHeader)
      .query({
        response_type: 'code',
        client_id: oauthClientId,
        redirect_uri: redirectUri,
        scope: 'documents:read documents:write',
        state,
        code_challenge: challenge,
        code_challenge_method: 'S256',
        approve: '1',
      });

    expect(authorizeRes.status).toBe(302);
    const redirectLocation = authorizeRes.headers.location as string;
    const redirectUrl = new URL(redirectLocation);
    const code = redirectUrl.searchParams.get('code');
    expect(code).toBeTruthy();
    expect(redirectUrl.searchParams.get('state')).toBe(state);

    const tokenRes = await request(app)
      .post('/api/v1/oauth/token')
      .send({
        grant_type: 'authorization_code',
        client_id: oauthClientId,
        client_secret: oauthClientSecret,
        code,
        code_verifier: verifier,
        redirect_uri: redirectUri,
      });

    expect(tokenRes.status).toBe(200);
    expect(tokenRes.body.access_token).toBeTypeOf('string');
    expect(tokenRes.body.token_type).toBe('Bearer');
    accessToken = tokenRes.body.access_token as string;

    const meRes = await request(app)
      .get('/api/v1/me')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(meRes.status).toBe(200);
    expect(meRes.body.id).toBe(adminUserId);
    expect(meRes.body.email).toBe(adminEmail);
    expect(Array.isArray(meRes.body.scopes)).toBe(true);
  });

  it('rejects wrong code_verifier with invalid_grant', async () => {
    const verifier = '01234567890123456789012345678901234567890123aaa';
    const challenge = pkceChallenge(verifier);

    const authorizeRes = await request(app)
      .get('/api/v1/oauth/authorize')
      .set('Cookie', cookieHeader)
      .query({
        response_type: 'code',
        client_id: oauthClientId,
        redirect_uri: redirectUri,
        scope: 'documents:read',
        code_challenge: challenge,
        code_challenge_method: 'S256',
        approve: '1',
      });

    const redirectLocation = authorizeRes.headers.location as string;
    const code = new URL(redirectLocation).searchParams.get('code');

    const tokenRes = await request(app)
      .post('/api/v1/oauth/token')
      .send({
        grant_type: 'authorization_code',
        client_id: oauthClientId,
        client_secret: oauthClientSecret,
        code,
        code_verifier: 'wrongverifier01234567890123456789012345678901234567',
        redirect_uri: redirectUri,
      });

    expect(tokenRes.status).toBe(400);
    expect(tokenRes.body.code).toBe('invalid_grant');
    expect(tokenRes.body.request_id).toBeTypeOf('string');
  });

  it('enforces bearer middleware with distinct expired-token error code', async () => {
    const missing = await request(app).get('/api/v1/documents');
    expect(missing.status).toBe(401);
    expect(missing.body.code).toBe('unauthorized');
    expect(missing.body.request_id).toBeTypeOf('string');

    const invalid = await request(app)
      .get('/api/v1/documents')
      .set('Authorization', 'Bearer atk_invalid_token');
    expect(invalid.status).toBe(401);
    expect(invalid.body.code).toBe('unauthorized');

    await pool.query(
      `UPDATE oauth_access_tokens SET expires_at = NOW() - interval '5 minutes' WHERE token_hash = $1`,
      [crypto.createHash('sha256').update(accessToken).digest('hex')]
    );
    const expired = await request(app)
      .get('/api/v1/documents')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(expired.status).toBe(401);
    expect(expired.body.code).toBe('token_expired');
  });

  it('requires scopes and names missing scope in 403 body', async () => {
    const verifier = 'verifierwithenoughlength012345678901234567890123456789';
    const challenge = pkceChallenge(verifier);

    const authorizeRes = await request(app)
      .get('/api/v1/oauth/authorize')
      .set('Cookie', cookieHeader)
      .query({
        response_type: 'code',
        client_id: oauthClientId,
        redirect_uri: redirectUri,
        scope: 'documents:read',
        code_challenge: challenge,
        code_challenge_method: 'S256',
        approve: '1',
      });
    const code = new URL(authorizeRes.headers.location as string).searchParams.get('code');
    const tokenRes = await request(app)
      .post('/api/v1/oauth/token')
      .send({
        grant_type: 'authorization_code',
        client_id: oauthClientId,
        client_secret: oauthClientSecret,
        code,
        code_verifier: verifier,
        redirect_uri: redirectUri,
      });
    const readOnlyToken = tokenRes.body.access_token as string;

    const forbidden = await request(app)
      .post('/api/v1/documents')
      .set('Authorization', `Bearer ${readOnlyToken}`)
      .send({ title: 'new doc', document_type: 'wiki' });

    expect(forbidden.status).toBe(403);
    expect(forbidden.body.code).toBe('forbidden');
    expect(forbidden.body.details?.missing_scope).toBe('documents:write');
    expect(forbidden.body.request_id).toBeTypeOf('string');
  });

  it('supports /api/v1 documents list/get/post with cursor pagination shape', async () => {
    const create1 = await request(app)
      .post('/api/v1/documents')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ title: 'MVP Doc 1', document_type: 'wiki' });
    expect(create1.status).toBe(201);

    const create2 = await request(app)
      .post('/api/v1/documents')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ title: 'MVP Doc 2', document_type: 'wiki' });
    expect(create2.status).toBe(201);

    const listRes = await request(app)
      .get('/api/v1/documents?limit=1')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(listRes.status).toBe(200);
    expect(Array.isArray(listRes.body.data)).toBe(true);
    expect(Object.prototype.hasOwnProperty.call(listRes.body, 'next_cursor')).toBe(true);
    expect(listRes.body.data).toHaveLength(1);

    const getRes = await request(app)
      .get(`/api/v1/documents/${create1.body.id as string}`)
      .set('Authorization', `Bearer ${accessToken}`);
    expect(getRes.status).toBe(200);
    expect(getRes.body.title).toBe('MVP Doc 1');
  });

  it('serves generated OpenAPI at /api/v1/openapi.json and keeps route parity', async () => {
    const response = await request(app).get('/api/v1/openapi.json');
    expect(response.status).toBe(200);
    expect(response.body.openapi).toBe('3.1.0');
    expect(response.body.paths).toBeDefined();

    const generated = generatePublicOpenApiSpec({
      protocol: 'http',
      get(header: string) {
        return header === 'host' ? 'localhost:3001' : undefined;
      },
    } as Request);
    const metadata = getPublicRouteMetadata();

    for (const route of metadata) {
      const operation = generated.paths?.[route.path]?.[route.method];
      expect(operation).toBeDefined();
    }
  });
});
