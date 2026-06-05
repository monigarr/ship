import { ShipClient } from '@ship/sdk';
import { pool } from '../db/client.js';
import { insertOAuthApp } from './oauth.js';
import { issueAccessAndRefreshTokens } from './oauth-tokens.js';

const AGENT_APP_NAME = 'Ship Agent (first-party)';

export interface AgentDocumentRow {
  id: string;
  title: string;
  document_type: string;
  content: unknown;
  properties: Record<string, unknown>;
  updated_at: string;
}

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
      requestedScopes: [
        'documents:read',
        'documents:write',
        'issues:read',
        'issues:write',
        'sprints:read',
        'webhooks:manage',
      ],
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
    scopes: [
      'documents:read',
      'documents:write',
      'issues:read',
      'issues:write',
      'sprints:read',
    ],
  });

  return { clientId, accessToken: tokens.accessToken };
}

export async function agentPublicApiProbe(baseUrl: string, accessToken: string): Promise<{
  clientId: string;
  email: string;
}> {
  const client = new ShipClient({ baseUrl, token: accessToken });
  const me = await client.me();
  await client.documents.list({ limit: 1 });
  await client.issues.list({ limit: 1 });
  return { clientId: me.client_id, email: me.email };
}

export async function fetchAgentContextDocumentsViaPublicApi(
  context: { userId: string; workspaceId: string; documentId?: string; documentType?: string },
  baseUrl: string
): Promise<AgentDocumentRow[]> {
  const { accessToken } = await ensureAgentOAuthApp({
    ownerUserId: context.userId,
    workspaceId: context.workspaceId,
  });
  const client = new ShipClient({ baseUrl, token: accessToken });

  if (context.documentId) {
    try {
      const doc = await client.documents.getById(context.documentId);
      return [
        {
          id: doc.id,
          title: doc.title,
          document_type: doc.document_type,
          content: doc.content ?? null,
          properties: doc.properties ?? {},
          updated_at: doc.updated_at,
        },
      ];
    } catch {
      const issue = await client.issues.getById(context.documentId);
      return [
        {
          id: issue.id,
          title: issue.title,
          document_type: issue.document_type,
          content: issue.content ?? null,
          properties: issue.properties ?? {},
          updated_at: issue.updated_at,
        },
      ];
    }
  }

  const [docPage, issuePage] = await Promise.all([
    client.documents.list({ limit: 25, type: 'project' }),
    client.issues.list({ limit: 25 }),
  ]);

  const merged = new Map<string, AgentDocumentRow>();
  for (const row of [...docPage.data, ...issuePage.data]) {
    merged.set(row.id, {
      id: row.id,
      title: row.title,
      document_type: row.document_type,
      content: 'content' in row ? (row as { content?: unknown }).content ?? null : null,
      properties: row.properties ?? {},
      updated_at: row.updated_at,
    });
  }

  return [...merged.values()];
}
