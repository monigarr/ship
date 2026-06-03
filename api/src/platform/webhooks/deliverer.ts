import crypto from 'crypto';
import { pool } from '../../db/client.js';
import { buildSignatureHeader } from './signer.js';
import { generateOpaqueToken } from '../oauth.js';
import { getPlatformEventBus } from '../events/bus.js';

export interface Clock {
  nowMs(): number;
  sleep(ms: number): Promise<void>;
}

export const systemClock: Clock = {
  nowMs: () => Date.now(),
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
};

export const RETRY_DELAYS_MS = [1000, 4000, 16000, 60000, 300000, 1800000];
export const MAX_ATTEMPTS = 6;

export interface WebhookDeliveryJob {
  deliveryId: string;
  subscriptionId: string;
  targetUrl: string;
  signingSecret: string;
  eventId: string;
  idempotencyKey: string;
  payload: Record<string, unknown>;
  attemptNumber: number;
}

export type FetchFn = (url: string, init: RequestInit) => Promise<Response>;

export class WebhookDeliverer {
  constructor(
    private readonly clock: Clock = systemClock,
    private readonly fetchFn: FetchFn = fetch
  ) {}

  async enqueueDelivery(input: {
    subscriptionId: string;
    appId: string;
    eventId: string;
    eventType: string;
    payload: Record<string, unknown>;
  }): Promise<string> {
    const idempotencyKey = `evt_${input.eventId}`;
    const { rows } = await pool.query(
      `INSERT INTO webhook_deliveries
        (subscription_id, event_id, idempotency_key, attempt_number, status, payload)
       VALUES ($1, $2, $3, 1, 'pending', $4::jsonb)
       RETURNING id`,
      [input.subscriptionId, input.eventId, idempotencyKey, JSON.stringify(input.payload)]
    );
    const deliveryId = rows[0].id as string;
    void this.processDelivery(deliveryId);
    return deliveryId;
  }

  async processDelivery(deliveryId: string): Promise<void> {
    const job = await this.loadJob(deliveryId);
    if (!job) return;

    const rawBody = JSON.stringify(job.payload);
    const signature = buildSignatureHeader(job.signingSecret, rawBody);
    const started = this.clock.nowMs();

    let responseStatus: number | null = null;
    let responseExcerpt: string | null = null;

    try {
      const response = await this.fetchFn(job.targetUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Ship-Signature': signature,
          'Idempotency-Key': job.idempotencyKey,
        },
        body: rawBody,
      });
      responseStatus = response.status;
      const text = await response.text();
      responseExcerpt = text.slice(0, 500);

      const latencyMs = this.clock.nowMs() - started;

      if (responseStatus >= 200 && responseStatus < 300) {
        await pool.query(
          `UPDATE webhook_deliveries
           SET status = 'success', response_status = $1, response_excerpt = $2, latency_ms = $3, updated_at = NOW()
           WHERE id = $4`,
          [responseStatus, responseExcerpt, latencyMs, deliveryId]
        );
        return;
      }

      if (responseStatus >= 400 && responseStatus < 500) {
        await pool.query(
          `UPDATE webhook_deliveries
           SET status = 'dead_letter', response_status = $1, response_excerpt = $2, latency_ms = $3, updated_at = NOW()
           WHERE id = $4`,
          [responseStatus, responseExcerpt, latencyMs, deliveryId]
        );
        return;
      }

      await this.scheduleRetry(deliveryId, job, responseStatus, responseExcerpt, latencyMs);
    } catch (error) {
      const latencyMs = this.clock.nowMs() - started;
      await this.scheduleRetry(deliveryId, job, responseStatus, responseExcerpt ?? String(error), latencyMs);
    }
  }

  private async scheduleRetry(
    deliveryId: string,
    job: WebhookDeliveryJob,
    responseStatus: number | null,
    responseExcerpt: string | null,
    latencyMs: number
  ): Promise<void> {
    if (job.attemptNumber >= MAX_ATTEMPTS) {
      await pool.query(
        `UPDATE webhook_deliveries
         SET status = 'dead_letter', response_status = $1, response_excerpt = $2, latency_ms = $3, updated_at = NOW()
         WHERE id = $4`,
        [responseStatus, responseExcerpt, latencyMs, deliveryId]
      );
      return;
    }

    const delayMs =
      RETRY_DELAYS_MS[job.attemptNumber - 1] ?? RETRY_DELAYS_MS[RETRY_DELAYS_MS.length - 1] ?? 1000;
    const nextRetryAt = new Date(this.clock.nowMs() + delayMs);

    await pool.query(
      `UPDATE webhook_deliveries
       SET status = 'failed',
           response_status = $1,
           response_excerpt = $2,
           latency_ms = $3,
           next_retry_at = $4,
           attempt_number = $5,
           updated_at = NOW()
       WHERE id = $6`,
      [responseStatus, responseExcerpt, latencyMs, nextRetryAt.toISOString(), job.attemptNumber + 1, deliveryId]
    );

    await this.clock.sleep(delayMs);
    if (this.clock === systemClock) {
      await this.processDelivery(deliveryId);
    }
  }

  async replayDelivery(deliveryId: string): Promise<void> {
    await pool.query(
      `UPDATE webhook_deliveries
       SET status = 'pending', attempt_number = 1, next_retry_at = NULL, updated_at = NOW()
       WHERE id = $1`,
      [deliveryId]
    );
    await this.processDelivery(deliveryId);
  }

  private async loadJob(deliveryId: string): Promise<WebhookDeliveryJob | null> {
    const { rows } = await pool.query(
      `SELECT d.id,
              d.subscription_id,
              d.event_id,
              d.idempotency_key,
              d.attempt_number,
              d.payload,
              d.status,
              s.target_url,
              s.signing_secret
       FROM webhook_deliveries d
       JOIN webhook_subscriptions s ON s.id = d.subscription_id
       WHERE d.id = $1`,
      [deliveryId]
    );
    const row = rows[0];
    if (!row || row.status === 'success') return null;

    return {
      deliveryId: row.id as string,
      subscriptionId: row.subscription_id as string,
      targetUrl: row.target_url as string,
      signingSecret: row.signing_secret as string,
      eventId: row.event_id as string,
      idempotencyKey: row.idempotency_key as string,
      payload: row.payload as Record<string, unknown>,
      attemptNumber: row.attempt_number as number,
    };
  }
}

export function createSigningSecret(): string {
  return `whsec_${crypto.randomBytes(24).toString('hex')}`;
}

export async function createWebhookSubscription(input: {
  appId: string;
  eventType: string;
  targetUrl: string;
}): Promise<{ id: string; signingSecret: string }> {
  const signingSecret = createSigningSecret();
  const { rows } = await pool.query(
    `INSERT INTO webhook_subscriptions (app_id, event_type, target_url, signing_secret)
     VALUES ($1, $2, $3, $4)
     RETURNING id`,
    [input.appId, input.eventType, input.targetUrl, signingSecret]
  );
  return { id: rows[0].id as string, signingSecret };
}

let delivererInstance: WebhookDeliverer | null = null;

export function getWebhookDeliverer(): WebhookDeliverer {
  if (!delivererInstance) {
    delivererInstance = new WebhookDeliverer();
  }
  return delivererInstance;
}

export function setWebhookDelivererForTests(deliverer: WebhookDeliverer): void {
  delivererInstance = deliverer;
}

export function wireWebhookEventBus(): void {
  const bus = getPlatformEventBus();
  bus.subscribe(async (event) => {
    if (event.type !== 'document.created') return;
    const { rows } = await pool.query(
      `SELECT id, app_id, signing_secret, target_url
       FROM webhook_subscriptions
       WHERE event_type = $1 AND active = TRUE`,
      [event.type]
    );
    const deliverer = getWebhookDeliverer();
    const eventId = generateOpaqueToken('evt');
    for (const sub of rows) {
      await deliverer.enqueueDelivery({
        subscriptionId: sub.id as string,
        appId: sub.app_id as string,
        eventId,
        eventType: event.type,
        payload: event as Record<string, unknown>,
      });
    }
  });
}
