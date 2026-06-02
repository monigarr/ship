import { ShipClient } from '@ship/sdk';
import { pool } from '../db/client.js';
import { insertOAuthApp } from './oauth.js';
import { issueAccessAndRefreshTokens } from './oauth-tokens.js';

const AGENT_APP_NAME = 'Ship Agent (first-party)';

export function isAgentPublicApiEnabled(): boolean {
  return process.env.SHIP_AGENT_USE_PUBLIC_API === 'true';
}

export async function ensureAgentOAuthApp(input: {
  ownerUserId: string;
  workspaceId: string;
}): Promise<{ clientId: string; accessToken: string }> {
  const existing = await pool.query(
    `SELECT client_id FROM oauth_apps WHERE name = $1 AND owner_user_id = $2 LIMIT 1`,
    [AGENT_APP_NAME, input.ownerUserId]
  );

  let clientId = existing.rows[0]?.client_id as string | undefined;
  let appId: string;

  if (!clientId) {
    const app = await insertOAuthApp({
      ownerUserId: input.ownerUserId,
      workspaceId: input.workspaceId,
      name: AGENT_APP_NAME,
      redirectUris: ['https://localhost/oauth/callback'],
      requestedScopes: ['documents:read', 'documents:write', 'issues:read', 'webhooks:manage'],
    });
    clientId = app.clientId;
    appId = app.id;
  } else {
    const row = await pool.query(`SELECT id FROM oauth_apps WHERE client_id = $1`, [clientId]);
    appId = row.rows[0].id as string;
  }

  const tokens = await issueAccessAndRefreshTokens({
    appId,
    userId: input.ownerUserId,
    workspaceId: input.workspaceId,
    scopes: ['documents:read', 'documents:write', 'issues:read'],
  });

  return { clientId, accessToken: tokens.accessToken };
}

export async function agentPublicApiProbe(baseUrl: string, accessToken: string): Promise<{
  clientId: string;
  email: string;
}> {
  const client = new ShipClient({ baseUrl, token: accessToken });
  const me = await client.me();
  return { clientId: me.client_id, email: me.email };
}
