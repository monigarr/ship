import { Request, Response, Router } from 'express';
import { z } from 'zod';
import { pool } from '../../../db/client.js';
import { sendPublicError } from '../../http.js';
import { oauthBearerMiddleware, requireScope } from '../../oauth.js';
import { SCOPES } from '../../scopes.js';
import { registerPublicRoute } from '../../spec/route-metadata.js';
import { createWebhookSubscription, getWebhookDeliverer } from '../../webhooks/deliverer.js';
import { EVENT_TYPES } from '../../events/registry.js';

const router = Router();

const createSubscriptionSchema = z.object({
  event: z.enum(EVENT_TYPES as unknown as [string, ...string[]]),
  target_url: z.string().url(),
});

registerPublicRoute({
  method: 'get',
  path: '/webhooks',
  summary: 'List webhook subscriptions',
  operationId: 'listWebhookSubscriptions',
  scopes: [SCOPES.WEBHOOKS_MANAGE],
  tags: ['Webhooks'],
  responseSchemaName: 'WebhookSubscriptionListResponse',
});

registerPublicRoute({
  method: 'post',
  path: '/webhooks',
  summary: 'Create webhook subscription',
  operationId: 'createWebhookSubscription',
  scopes: [SCOPES.WEBHOOKS_MANAGE],
  tags: ['Webhooks'],
  requestBodySchemaName: 'CreateWebhookSubscriptionRequest',
  responseSchemaName: 'WebhookSubscriptionResponse',
});

registerPublicRoute({
  method: 'get',
  path: '/webhooks/deliveries',
  summary: 'List webhook deliveries',
  operationId: 'listWebhookDeliveries',
  scopes: [SCOPES.WEBHOOKS_MANAGE],
  tags: ['Webhooks'],
  responseSchemaName: 'WebhookDeliveryListResponse',
  paginatedList: true,
});

registerPublicRoute({
  method: 'post',
  path: '/webhooks/deliveries/{id}/replay',
  summary: 'Replay a webhook delivery',
  operationId: 'replayWebhookDelivery',
  scopes: [SCOPES.WEBHOOKS_MANAGE],
  tags: ['Webhooks'],
  responseSchemaName: 'WebhookReplayResponse',
});

router.get(
  '/',
  oauthBearerMiddleware,
  requireScope(SCOPES.WEBHOOKS_MANAGE),
  async (req: Request, res: Response) => {
    if (!req.oauth) {
      sendPublicError(req, res, 401, 'unauthorized', 'Missing OAuth context');
      return;
    }

    const { rows } = await pool.query(
      `SELECT id, event_type, target_url, active, created_at
       FROM webhook_subscriptions
       WHERE app_id = $1
       ORDER BY created_at DESC`,
      [req.oauth.appId]
    );

    res.json({ data: rows });
  }
);

router.post(
  '/',
  oauthBearerMiddleware,
  requireScope(SCOPES.WEBHOOKS_MANAGE),
  async (req: Request, res: Response) => {
    if (!req.oauth) {
      sendPublicError(req, res, 401, 'unauthorized', 'Missing OAuth context');
      return;
    }

    const parsed = createSubscriptionSchema.safeParse(req.body);
    if (!parsed.success) {
      sendPublicError(req, res, 400, 'validation_failed', 'Invalid subscription payload', {
        issues: parsed.error.issues,
      });
      return;
    }

    const sub = await createWebhookSubscription({
      appId: req.oauth.appId,
      eventType: parsed.data.event,
      targetUrl: parsed.data.target_url,
    });

    res.status(201).json({
      id: sub.id,
      event: parsed.data.event,
      target_url: parsed.data.target_url,
      signing_secret: sub.signingSecret,
      note: 'Signing secret is shown exactly once.',
    });
  }
);

router.get(
  '/deliveries',
  oauthBearerMiddleware,
  requireScope(SCOPES.WEBHOOKS_MANAGE),
  async (req: Request, res: Response) => {
    if (!req.oauth) {
      sendPublicError(req, res, 401, 'unauthorized', 'Missing OAuth context');
      return;
    }

    const { rows } = await pool.query(
      `SELECT d.id,
              d.subscription_id,
              d.event_id,
              d.idempotency_key,
              d.attempt_number,
              d.status,
              d.response_status,
              d.response_excerpt,
              d.latency_ms,
              d.created_at,
              d.updated_at
       FROM webhook_deliveries d
       JOIN webhook_subscriptions s ON s.id = d.subscription_id
       WHERE s.app_id = $1
       ORDER BY d.created_at DESC
       LIMIT 100`,
      [req.oauth.appId]
    );

    res.json({ data: rows, next_cursor: null });
  }
);

router.post(
  '/deliveries/:id/replay',
  oauthBearerMiddleware,
  requireScope(SCOPES.WEBHOOKS_MANAGE),
  async (req: Request, res: Response) => {
    if (!req.oauth) {
      sendPublicError(req, res, 401, 'unauthorized', 'Missing OAuth context');
      return;
    }

    const { rows } = await pool.query(
      `SELECT d.id
       FROM webhook_deliveries d
       JOIN webhook_subscriptions s ON s.id = d.subscription_id
       WHERE d.id = $1 AND s.app_id = $2`,
      [req.params.id, req.oauth.appId]
    );

    if (!rows[0]) {
      sendPublicError(req, res, 404, 'not_found', 'Delivery not found');
      return;
    }

    const deliveryId = req.params.id as string;
    await getWebhookDeliverer().replayDelivery(deliveryId);
    res.json({ replayed: true, delivery_id: deliveryId });
  }
);

export const webhooksV1Router = router;
