import { describe, expect, it } from 'vitest';
import http from 'node:http';
import { ShipClient, verifyWebhook } from '@ship/sdk';

function startTestListener(): Promise<{
  url: string;
  waitFor: (
    predicate: (headers: Record<string, string>, body: string) => boolean,
    opts?: { timeoutMs?: number }
  ) => Promise<{ headers: Record<string, string>; body: string; event: { type: string } }>;
  close: () => Promise<void>;
}> {
  return new Promise((resolve) => {
    const deliveries: Array<{ headers: Record<string, string>; body: string }> = [];

    const server = http.createServer((req, res) => {
      const chunks: Buffer[] = [];
      req.on('data', (chunk) => chunks.push(chunk as Buffer));
      req.on('end', () => {
        const body = Buffer.concat(chunks).toString('utf8');
        const headers: Record<string, string> = {};
        for (const [key, value] of Object.entries(req.headers)) {
          if (typeof value === 'string') headers[key] = value;
        }
        deliveries.push({ headers, body });
        res.statusCode = 200;
        res.end('ok');
      });
    });

    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      const port = typeof addr === 'object' && addr ? addr.port : 0;
      const url = `http://127.0.0.1:${port}/hook`;

      resolve({
        url,
        waitFor: async (predicate, opts) => {
          const timeoutMs = opts?.timeoutMs ?? 15_000;
          const deadline = Date.now() + timeoutMs;
          while (Date.now() < deadline) {
            for (const d of deliveries) {
              if (predicate(d.headers, d.body)) {
                const parsed = JSON.parse(d.body) as { type: string };
                return { ...d, event: parsed };
              }
            }
            await new Promise((r) => setTimeout(r, 200));
          }
          throw new Error('Timed out waiting for webhook delivery');
        },
        close: () =>
          new Promise((done, reject) => {
            server.close((err) => (err ? reject(err) : done()));
          }),
      });
    });
  });
}

describe('time to first event', () => {
  it.skipIf(!process.env.TTFE_BASE_URL)('completes TTFE loop against running Ship', async () => {
    const baseUrl = process.env.TTFE_BASE_URL!;
    const clientId = process.env.TTFE_CLIENT_ID!;
    const deviceCode = process.env.TTFE_DEVICE_CODE;

    const t0 = performance.now();
    const listener = await startTestListener();

    const client = deviceCode
      ? new ShipClient({ baseUrl, token: process.env.TTFE_ACCESS_TOKEN! })
      : await ShipClient.deviceLogin({
          baseUrl,
          clientId,
          scopes: ['documents:write', 'webhooks:manage'],
          onUserCode: (code) => {
            process.env.SHIP_DEVICE_CODE = code;
          },
          maxWaitMs: 60_000,
        });

    const sub = await client.webhooks.create({
      event: 'document.created',
      target_url: listener.url,
    });

    const doc = await client.documents.create({ title: 'hello' });

    const delivery = await listener.waitFor(
      (h, body) => verifyWebhook(h, body, sub.signing_secret),
      { timeoutMs: 10_000 }
    );

    expect(delivery.event.type).toBe('document.created');
    expect(doc.id).toBeTruthy();
    expect(performance.now() - t0).toBeLessThan(60_000);

    await listener.close();
  });
});
