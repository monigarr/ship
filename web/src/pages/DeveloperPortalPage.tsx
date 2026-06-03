import { useCallback, useEffect, useState } from 'react';
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

interface SubscriptionRow {
  id: string;
  event_type: string;
  target_url: string;
  active: boolean;
}

interface AuditRow {
  id: string;
  route: string;
  status_code: number;
  latency_ms: number;
  created_at: string;
}

const PORTAL_TOKEN_KEY = 'ship.devportal.access_token';

export function DeveloperPortalPage() {
  const [apps, setApps] = useState<OAuthAppRow[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [portalToken, setPortalToken] = useState<string>(() => sessionStorage.getItem(PORTAL_TOKEN_KEY) ?? '');
  const [deliveries, setDeliveries] = useState<DeliveryRow[]>([]);
  const [subscriptions, setSubscriptions] = useState<SubscriptionRow[]>([]);
  const [auditRows, setAuditRows] = useState<AuditRow[]>([]);
  const [newSecret, setNewSecret] = useState<string | null>(null);
  const [newSigningSecret, setNewSigningSecret] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [appName, setAppName] = useState('My Integration');
  const [webhookEvent, setWebhookEvent] = useState('document.created');
  const [webhookUrl, setWebhookUrl] = useState('https://example.com/webhooks/ship');

  const bearerFetch = useCallback(
    async (path: string, init?: RequestInit) => {
      if (!portalToken) throw new Error('Issue a portal token first');
      return fetch(path, {
        ...init,
        headers: {
          ...(init?.headers ?? {}),
          Authorization: `Bearer ${portalToken}`,
        },
        credentials: 'include',
      });
    },
    [portalToken]
  );

  const loadApps = useCallback(async () => {
    const res = await apiFetch('/api/v1/oauth/apps', { method: 'GET' });
    if (!res.ok) {
      setApps([]);
      return;
    }
    const body = (await res.json()) as { data?: OAuthAppRow[] };
    const rows = body.data ?? [];
    setApps(rows);
    if (!selectedClientId && rows[0]) setSelectedClientId(rows[0].client_id);
  }, [selectedClientId]);

  useEffect(() => {
    void loadApps();
  }, [loadApps]);

  useEffect(() => {
    if (portalToken) sessionStorage.setItem(PORTAL_TOKEN_KEY, portalToken);
  }, [portalToken]);

  const issuePortalToken = async () => {
    if (!selectedClientId) return;
    setError(null);
    const res = await apiFetch(`/api/v1/oauth/apps/${selectedClientId}/portal-token`, {
      method: 'POST',
    });
    if (!res.ok) {
      const body = (await res.json()) as { message?: string };
      setError(body.message ?? 'Failed to issue portal token');
      return;
    }
    const body = (await res.json()) as { access_token: string };
    setPortalToken(body.access_token);
  };

  const loadDeliveries = useCallback(async () => {
    const res = await bearerFetch('/api/v1/webhooks/deliveries');
    if (!res.ok) return;
    const body = (await res.json()) as { data: DeliveryRow[] };
    setDeliveries(body.data ?? []);
  }, [bearerFetch]);

  const loadSubscriptions = useCallback(async () => {
    const res = await bearerFetch('/api/v1/webhooks');
    if (!res.ok) return;
    const body = (await res.json()) as { data: SubscriptionRow[] };
    setSubscriptions(body.data ?? []);
  }, [bearerFetch]);

  const loadAudit = useCallback(async () => {
    const res = await bearerFetch('/api/v1/audit');
    if (!res.ok) return;
    const body = (await res.json()) as { data: AuditRow[] };
    setAuditRows(body.data ?? []);
  }, [bearerFetch]);

  const registerApp = async () => {
    setError(null);
    setNewSecret(null);
    const res = await apiFetch('/api/v1/oauth/apps', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: appName,
        redirect_uris: ['https://example.local/oauth/callback'],
        requested_scopes: ['documents:read', 'documents:write', 'issues:read', 'webhooks:manage'],
      }),
    });
    if (!res.ok) {
      const body = (await res.json()) as { message?: string };
      setError(body.message ?? 'Failed to register app');
      return;
    }
    const body = (await res.json()) as { client_secret?: string; client_id: string };
    if (body.client_secret) setNewSecret(body.client_secret);
    setSelectedClientId(body.client_id);
    await loadApps();
  };

  const rotateSecret = async (appId: string) => {
    setError(null);
    setNewSecret(null);
    const res = await apiFetch(`/api/v1/oauth/apps/${appId}/rotate-secret`, { method: 'POST' });
    if (!res.ok) {
      const body = (await res.json()) as { message?: string };
      setError(body.message ?? 'Failed to rotate secret');
      return;
    }
    const body = (await res.json()) as { client_secret?: string };
    if (body.client_secret) setNewSecret(body.client_secret);
  };

  const createSubscription = async () => {
    setError(null);
    setNewSigningSecret(null);
    const res = await bearerFetch('/api/v1/webhooks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event: webhookEvent, target_url: webhookUrl }),
    });
    if (!res.ok) {
      const body = (await res.json()) as { message?: string };
      setError(body.message ?? 'Failed to create subscription');
      return;
    }
    const body = (await res.json()) as { signing_secret?: string };
    if (body.signing_secret) setNewSigningSecret(body.signing_secret);
    await loadSubscriptions();
  };

  const replay = async (deliveryId: string) => {
    await bearerFetch(`/api/v1/webhooks/deliveries/${deliveryId}/replay`, { method: 'POST' });
    await loadDeliveries();
  };

  const refreshPortalData = async () => {
    await Promise.all([loadSubscriptions(), loadDeliveries(), loadAudit()]);
  };

  return (
    <div style={{ padding: 24, maxWidth: 960 }}>
      <h1>Developer Portal</h1>
      <p>Manage OAuth apps, webhook subscriptions, deliveries, and audit log via the public API.</p>

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
              {app.name} — <code>{app.client_id}</code>{' '}
              <button type="button" onClick={() => setSelectedClientId(app.client_id)}>
                Select
              </button>{' '}
              <button type="button" onClick={() => void rotateSecret(app.id)}>
                Rotate secret
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section style={{ marginTop: 24 }}>
        <h2>Portal API session</h2>
        <p>Selected app: <code>{selectedClientId || 'none'}</code></p>
        <button type="button" onClick={() => void issuePortalToken()} disabled={!selectedClientId}>
          Issue portal bearer token
        </button>{' '}
        <button type="button" onClick={() => void refreshPortalData()} disabled={!portalToken}>
          Refresh webhooks + audit
        </button>
        {portalToken && <p>Portal token active (sessionStorage).</p>}
      </section>

      <section style={{ marginTop: 24 }}>
        <h2>Webhook subscriptions</h2>
        <label>
          Event{' '}
          <select value={webhookEvent} onChange={(e) => setWebhookEvent(e.target.value)}>
            <option value="document.created">document.created</option>
            <option value="issue.created">issue.created</option>
            <option value="sprint.started">sprint.started</option>
          </select>
        </label>
        <label style={{ marginLeft: 8 }}>
          Target URL{' '}
          <input value={webhookUrl} onChange={(e) => setWebhookUrl(e.target.value)} style={{ width: 320 }} />
        </label>
        <button type="button" onClick={() => void createSubscription()} disabled={!portalToken} style={{ marginLeft: 8 }}>
          Create subscription
        </button>
        {newSigningSecret && (
          <p>
            <strong>Signing secret (shown once):</strong> <code>{newSigningSecret}</code>
          </p>
        )}
        <ul>
          {subscriptions.map((sub) => (
            <li key={sub.id}>
              {sub.event_type} → {sub.target_url} ({sub.active ? 'active' : 'inactive'})
            </li>
          ))}
        </ul>
      </section>

      <section style={{ marginTop: 24 }}>
        <h2>Webhook deliveries</h2>
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
                  <button type="button" onClick={() => void replay(d.id)}>
                    Replay
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section style={{ marginTop: 24 }}>
        <h2>Public API audit log</h2>
        <ul>
          {auditRows.slice(0, 20).map((row) => (
            <li key={row.id}>
              {row.route} — {row.status_code} ({row.latency_ms}ms) @ {row.created_at}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
