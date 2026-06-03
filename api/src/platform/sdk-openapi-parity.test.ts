import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';

const SDK_OPERATION_MAP: Record<string, string> = {
  getAuthenticatedUser: 'client.me()',
  listDocuments: 'client.documents.list()',
  getDocumentById: 'client.documents.getById()',
  createDocument: 'client.documents.create()',
  registerOAuthApp: 'session-only (not SDK)',
  authorizeOAuthApp: 'ShipClient.authorizationCodeFlow()',
  approveOAuthAuthorization: 'browser consent (not SDK)',
  exchangeOAuthToken: 'auth helpers (deviceLogin / authorizationCodeFlow)',
  startDeviceAuthorization: 'ShipClient.deviceLogin()',
  verifyDeviceUserCode: 'browser /oauth/device (not SDK)',
  listWebhookSubscriptions: 'client.webhooks.list()',
  createWebhookSubscription: 'client.webhooks.create()',
  listWebhookDeliveries: 'client.webhooks.listDeliveries()',
  replayWebhookDelivery: 'client.webhooks.replay()',
  listIssues: 'client.issues.list()',
  getIssueById: 'client.issues.getById()',
  createIssue: 'client.issues.create()',
  listSprints: 'client.sprints.list()',
  getSprintById: 'client.sprints.getById()',
  createSprint: 'client.sprints.create()',
  startSprint: 'client.sprints.start()',
  listPlatformAuditLog: 'portal-only (not SDK)',
  getPublicOpenApiSpec: 'GET /api/v1/openapi.json (meta)',
};

describe('SDK OpenAPI parity', () => {
  const app = createApp();

  it('maps every bearer-protected resource operation to an SDK call', async () => {
    const specRes = await request(app).get('/api/v1/openapi.json');
    expect(specRes.status).toBe(200);

    const spec = specRes.body as {
      paths?: Record<string, Record<string, { operationId?: string; security?: unknown[] }>>;
    };

    const missing: string[] = [];

    for (const [path, methods] of Object.entries(spec.paths ?? {})) {
      if (path.startsWith('/oauth/apps') || path.startsWith('/oauth/authorize')) continue;

      for (const [method, operation] of Object.entries(methods)) {
        const operationId = operation.operationId;
        if (!operationId) continue;

        const requiresBearer = (operation.security ?? []).some((s) =>
          typeof s === 'object' && s !== null && 'bearerAuth' in s
        );
        if (!requiresBearer) continue;

        if (path === '/openapi.json') continue;

        const sdkSurface = SDK_OPERATION_MAP[operationId];
        if (!sdkSurface) {
          missing.push(`${method.toUpperCase()} ${path} (${operationId})`);
        }
      }
    }

    expect(missing, `SDK missing surfaces for: ${missing.join(', ')}`).toEqual([]);
  });
});
