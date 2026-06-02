import { describe, expect, it, vi } from 'vitest';
import { ShipClient } from './client.js';
import { createServer } from 'http';
import { AddressInfo } from 'net';

describe('ShipClient', () => {
  it('calls /api/v1/me with bearer token', async () => {
    const fetchFn = vi.fn(async () =>
      new Response(
        JSON.stringify({
          id: 'user-1',
          email: 'dev@ship.local',
          name: 'Dev',
          workspace_id: 'ws-1',
          client_id: 'ship_client',
          scopes: ['documents:read'],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    );

    const client = new ShipClient({
      baseUrl: 'https://ship.local',
      token: 'atk_123',
      fetchFn: fetchFn as unknown as typeof fetch,
    });

    const me = await client.me();
    expect(fetchFn).toHaveBeenCalledWith('https://ship.local/api/v1/me', {
      method: 'GET',
      headers: {
        Authorization: 'Bearer atk_123',
      },
    });
    expect(me.email).toBe('dev@ship.local');
  });

  it('works against a running HTTP server', async () => {
    const server = createServer((req, res) => {
      if (req.url === '/api/v1/me' && req.method === 'GET') {
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.end(
          JSON.stringify({
            id: 'server-user',
            email: 'server@ship.local',
            name: 'Server User',
            workspace_id: 'ws-server',
            client_id: 'client-server',
            scopes: ['documents:read'],
          })
        );
        return;
      }
      res.statusCode = 404;
      res.end('not found');
    });

    await new Promise<void>((resolve) => server.listen(0, resolve));
    const { port } = server.address() as AddressInfo;
    const client = new ShipClient({
      baseUrl: `http://127.0.0.1:${port}`,
      token: 'atk_server',
    });

    const me = await client.me();
    expect(me.id).toBe('server-user');
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  });
});
