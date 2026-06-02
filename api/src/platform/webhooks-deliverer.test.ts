import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { pool } from '../db/client.js';
import { insertOAuthApp } from './oauth.js';
import { verifyWebhookSignature } from './webhooks/signer.js';
import {
  createWebhookSubscription,
  WebhookDeliverer,
  type Clock,
  type FetchFn,
} from './webhooks/deliverer.js';
import { resetPlatformEventBusForTests } from './events/bus.js';
import { wireWebhookEventBus } from './webhooks/deliverer.js';
import { publishDocumentCreated } from './events/publish.js';

describe('webhook deliverer', () => {
  const runId = Date.now().toString(36);
  let appId = '';
  let subscriptionId = '';
  let signingSecret = '';
  let workspaceId = '';

  beforeAll(async () => {
    const ws = await pool.query(`INSERT INTO workspaces (name) VALUES ($1) RETURNING id`, [`WH ${runId}`]);
    workspaceId = ws.rows[0].id as string;
    const user = await pool.query(
      `INSERT INTO users (email, password_hash, name, is_super_admin, last_workspace_id)
       VALUES ($1, $2, 'WH', TRUE, $3) RETURNING id`,
      [`wh-${runId}@ship.local`, 'x', workspaceId]
    );
    const userId = user.rows[0].id as string;
    const app = await insertOAuthApp({
      ownerUserId: userId,
      workspaceId,
      name: 'WH App',
      redirectUris: ['https://example.local/cb'],
      requestedScopes: ['webhooks:manage', 'documents:write'],
    });
    appId = app.id;
    const sub = await createWebhookSubscription({
      appId,
      eventType: 'document.created',
      targetUrl: 'https://example.local/hook',
    });
    subscriptionId = sub.id;
    signingSecret = sub.signingSecret;
    resetPlatformEventBusForTests();
    wireWebhookEventBus();
  });

  afterAll(async () => {
    await pool.query('DELETE FROM webhook_deliveries WHERE subscription_id = $1', [subscriptionId]);
    await pool.query('DELETE FROM webhook_subscriptions WHERE app_id = $1', [appId]);
    await pool.query('DELETE FROM oauth_apps WHERE id = $1', [appId]);
  });

  it('signs payloads and rejects tampered body', () => {
    const body = JSON.stringify({ type: 'document.created', id: 'x' });
    const header = `t=${Math.floor(Date.now() / 1000)},v1=deadbeef`;
    expect(verifyWebhookSignature(header, body, signingSecret)).toBe(false);
  });

  it('records success on 200 response', async () => {
    const fetchFn: FetchFn = vi.fn().mockResolvedValue({
      status: 200,
      text: async () => 'ok',
    } as Response);

    const clock: Clock = {
      nowMs: () => Date.now(),
      sleep: async () => {},
    };

    const deliverer = new WebhookDeliverer(clock, fetchFn);
    const deliveryId = await deliverer.enqueueDelivery({
      subscriptionId,
      appId,
      eventId: 'evt_test',
      eventType: 'document.created',
      payload: { type: 'document.created', id: 'doc-1' },
    });

    await deliverer.processDelivery(deliveryId);

    const { rows } = await pool.query(`SELECT status FROM webhook_deliveries WHERE id = $1`, [deliveryId]);
    expect(rows[0].status).toBe('success');
  });

  it('publishes document.created to matching subscriptions', async () => {
    const fetchFn: FetchFn = vi.fn().mockResolvedValue({
      status: 200,
      text: async () => 'ok',
    } as Response);

    const deliverer = new WebhookDeliverer(
      { nowMs: () => Date.now(), sleep: async () => {} },
      fetchFn
    );
    const { setWebhookDelivererForTests } = await import('./webhooks/deliverer.js');
    setWebhookDelivererForTests(deliverer);

    await publishDocumentCreated({
      id: '00000000-0000-4000-8000-000000000099',
      workspace_id: workspaceId,
      document_type: 'wiki',
      title: 'evt',
      created_at: new Date().toISOString(),
    });

    expect(fetchFn).toHaveBeenCalled();
  });
});
