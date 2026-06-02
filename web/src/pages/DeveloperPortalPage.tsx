import { useCallback, useState } from 'react';
import { apiFetch } from '../lib/api';

interface OAuthAppRow {
  id: string;
  client_id: string;
  name: string;
  requested_scopes: string[];
}

interface DeliveryRow {
  id: string;
  status: string;
  event_id: string;
  attempt_number: number;
  response_status: number | null;
  created_at: string;
}

export function DeveloperPortalPage() {
  const [apps, setApps] = useState<OAuthAppRow[]>([]);
  const [deliveries, setDeliveries] = useState<DeliveryRow[]>([]);
  const [newSecret, setNewSecret] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [appName, setAppName] = useState('My Integration');

  const loadApps = useCallback(async () => {
    const res = await apiFetch('/api/v1/oauth/apps', { method: 'GET' });
    if (!res.ok) {
      setApps([]);
      return;
    }
    const body = (await res.json()) as { data?: OAuthAppRow[] };
    setApps(body.data ?? []);
  }, []);

  const loadDeliveries = useCallback(async (accessToken: string) => {
    const res = await fetch('/api/v1/webhooks/deliveries', {
      headers: { Authorization: `Bearer ${accessToken}` },
      credentials: 'include',
    });
    if (!res.ok) return;
    const body = (await res.json()) as { data: DeliveryRow[] };
    setDeliveries(body.data ?? []);
  }, []);

  const registerApp = async () => {
    setError(null);
    setNewSecret(null);
    const res = await apiFetch('/api/v1/oauth/apps', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: appName,
        redirect_uris: ['https://example.local/oauth/callback'],
        requested_scopes: ['documents:read', 'documents:write', 'webhooks:manage'],
      }),
    });
    if (!res.ok) {
      const body = (await res.json()) as { message?: string };
      setError(body.message ?? 'Failed to register app');
      return;
    }
    const body = (await res.json()) as { client_secret?: string; client_id: string };
    if (body.client_secret) setNewSecret(body.client_secret);
    await loadApps();
  };

  const replay = async (deliveryId: string, accessToken: string) => {
    await fetch(`/api/v1/webhooks/deliveries/${deliveryId}/replay`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
      credentials: 'include',
    });
    await loadDeliveries(accessToken);
  };

  return (
    <div style={{ padding: 24, maxWidth: 960 }}>
      <h1>Developer Portal</h1>
      <p>Manage OAuth apps and webhook deliveries (admin session).</p>

      <section style={{ marginTop: 24 }}>
        <h2>Register OAuth app</h2>
        <label>
          App name{' '}
          <input value={appName} onChange={(e) => setAppName(e.target.value)} />
        </label>
        <button type="button" onClick={() => void registerApp()} style={{ marginLeft: 8 }}>
          Register
        </button>
        {error && <p style={{ color: 'crimson' }}>{error}</p>}
        {newSecret && (
          <p>
            <strong>Client secret (shown once):</strong> <code>{newSecret}</code>
          </p>
        )}
      </section>

      <section style={{ marginTop: 24 }}>
        <h2>Your apps</h2>
        <button type="button" onClick={() => void loadApps()}>
          Refresh apps
        </button>
        <ul>
          {apps.map((app) => (
            <li key={app.id}>
              {app.name} — <code>{app.client_id}</code>
            </li>
          ))}
        </ul>
      </section>

      <section style={{ marginTop: 24 }}>
        <h2>Webhook deliveries</h2>
        <p>Paste a bearer token with webhooks:manage to load deliveries:</p>
        <input id="dev-portal-token" placeholder="access_token" style={{ width: '100%' }} />
        <button
          type="button"
          onClick={() => {
            const token = (document.getElementById('dev-portal-token') as HTMLInputElement).value;
            void loadDeliveries(token);
          }}
        >
          Load deliveries
        </button>
        <table style={{ width: '100%', marginTop: 12 }}>
          <thead>
            <tr>
              <th>Status</th>
              <th>Event</th>
              <th>Attempts</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {deliveries.map((d) => (
              <tr key={d.id}>
                <td>{d.status}</td>
                <td>{d.event_id}</td>
                <td>{d.attempt_number}</td>
                <td>
                  <button
                    type="button"
                    onClick={() => {
                      const token = (document.getElementById('dev-portal-token') as HTMLInputElement).value;
                      void replay(d.id, token);
                    }}
                  >
                    Replay
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
