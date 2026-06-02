import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { createApp } from '../app.js';
import { pool } from '../db/client.js';
import { ensureAgentOAuthApp } from './agent-platform.js';

describe('agent-as-citizen public API probe', () => {
  const runId = Date.now().toString(36);
  let workspaceId = '';
  let userId = '';

  beforeAll(async () => {
    const ws = await pool.query(`INSERT INTO workspaces (name) VALUES ($1) RETURNING id`, [`AG ${runId}`]);
    workspaceId = ws.rows[0].id as string;
    const passwordHash = await bcrypt.hash('x', 10);
    const user = await pool.query(
      `INSERT INTO users (email, password_hash, name, is_super_admin, last_workspace_id)
       VALUES ($1, $2, 'Agent', TRUE, $3) RETURNING id`,
      [`ag-${runId}@ship.local`, passwordHash, workspaceId]
    );
    userId = user.rows[0].id as string;
  });

  afterAll(async () => {
    await pool.query(`DELETE FROM platform_audit_log WHERE user_id = $1`, [userId]);
    await pool.query(`DELETE FROM oauth_apps WHERE owner_user_id = $1`, [userId]);
    await pool.query('DELETE FROM users WHERE id = $1', [userId]);
    await pool.query('DELETE FROM workspaces WHERE id = $1', [workspaceId]);
  });

  it('issues agent OAuth app token and reads /me via public API', async () => {
    const app = createApp();
    const { accessToken, clientId } = await ensureAgentOAuthApp({ ownerUserId: userId, workspaceId });
    const me = await request(app).get('/api/v1/me').set('Authorization', `Bearer ${accessToken}`);
    expect(me.status).toBe(200);
    expect(me.body.client_id).toBe(clientId);
    expect(me.body.email).toContain('@');
  });
});
