import { useCallback, useEffect, useState } from 'react';
import { useDeveloperPortal, type DeliveryRow, type SubscriptionRow } from '@/hooks/useDeveloperPortal';
import { WEBHOOK_EVENT_TYPES } from '@/lib/publicApi';
import { OneTimeSecretBanner } from '@/components/developer/OneTimeSecretBanner';
import { useToast } from '@/components/ui/Toast';

const inputClassName =
  'w-full px-3 py-2 bg-background border border-border rounded-md text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent';

export function WebhooksTab() {
  const { portalConnected, bearerFetch } = useDeveloperPortal();
  const { showToast } = useToast();
  const [subscriptions, setSubscriptions] = useState<SubscriptionRow[]>([]);
  const [deliveries, setDeliveries] = useState<DeliveryRow[]>([]);
  const [webhookEvent, setWebhookEvent] = useState<string>(WEBHOOK_EVENT_TYPES[0]);
  const [webhookUrl, setWebhookUrl] = useState('https://example.com/webhooks/ship');
  const [newSigningSecret, setNewSigningSecret] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const loadSubscriptions = useCallback(async () => {
    const res = await bearerFetch('/api/v1/webhooks');
    if (!res.ok) return;
    const body = (await res.json()) as { data: SubscriptionRow[] };
    setSubscriptions(body.data ?? []);
  }, [bearerFetch]);

  const loadDeliveries = useCallback(async () => {
    const res = await bearerFetch('/api/v1/webhooks/deliveries');
    if (!res.ok) return;
    const body = (await res.json()) as { data: DeliveryRow[] };
    setDeliveries(body.data ?? []);
  }, [bearerFetch]);

  const refresh = useCallback(async () => {
    if (!portalConnected) return;
    setLoading(true);
    try {
      await Promise.all([loadSubscriptions(), loadDeliveries()]);
    } finally {
      setLoading(false);
    }
  }, [portalConnected, loadSubscriptions, loadDeliveries]);

  useEffect(() => {
    if (portalConnected) {
      void refresh();
    }
  }, [portalConnected, refresh]);

  async function handleCreateSubscription(e: React.FormEvent) {
    e.preventDefault();
    setNewSigningSecret(null);
    try {
      const res = await bearerFetch('/api/v1/webhooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event: webhookEvent, target_url: webhookUrl }),
      });
      if (!res.ok) {
        const body = (await res.json()) as { message?: string };
        throw new Error(body.message ?? 'Failed to create subscription');
      }
      const body = (await res.json()) as { signing_secret?: string };
      if (body.signing_secret) {
        setNewSigningSecret(body.signing_secret);
      }
      showToast('Webhook subscription created', 'success');
      await loadSubscriptions();
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to create subscription', 'error');
    }
  }

  async function handleReplay(deliveryId: string) {
    try {
      await bearerFetch(`/api/v1/webhooks/deliveries/${deliveryId}/replay`, { method: 'POST' });
      showToast('Delivery replay queued', 'success');
      await loadDeliveries();
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to replay delivery', 'error');
    }
  }

  if (!portalConnected) {
    return (
      <div className="mx-auto max-w-3xl rounded-lg border border-dashed border-border p-6 space-y-2">
        <p className="text-sm text-foreground">Connect to the API first.</p>
        <p className="text-xs text-muted">
          Issue a portal bearer token on the Apps tab to manage webhook subscriptions.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-medium text-foreground">Webhook subscriptions</h2>
          <p className="text-xs text-muted mt-1">Subscribe your app to platform events.</p>
        </div>
        <button
          type="button"
          onClick={() => void refresh()}
          disabled={loading}
          className="px-3 py-1.5 text-sm rounded-md border border-border text-muted hover:text-foreground"
        >
          Refresh
        </button>
      </div>

      <form onSubmit={(e) => void handleCreateSubscription(e)} className="grid gap-3 sm:grid-cols-[1fr_2fr_auto] sm:items-end">
        <div>
          <label className="block text-xs text-muted mb-1">Event</label>
          <select value={webhookEvent} onChange={(e) => setWebhookEvent(e.target.value)} className={inputClassName}>
            {WEBHOOK_EVENT_TYPES.map((eventType) => (
              <option key={eventType} value={eventType}>
                {eventType}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-muted mb-1">Target URL</label>
          <input value={webhookUrl} onChange={(e) => setWebhookUrl(e.target.value)} className={inputClassName} required />
        </div>
        <button type="submit" className="px-4 py-2 bg-accent text-white rounded-md hover:bg-accent/90">
          Create subscription
        </button>
      </form>

      {newSigningSecret && (
        <OneTimeSecretBanner
          label="Signing secret (shown once)"
          secret={newSigningSecret}
          onDismiss={() => setNewSigningSecret(null)}
        />
      )}

      <div className="rounded-lg border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-background/80 border-b border-border">
            <tr>
              <th className="px-4 py-2 text-left text-xs font-medium text-muted">Event</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-muted">Target URL</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-muted">Status</th>
            </tr>
          </thead>
          <tbody>
            {subscriptions.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-4 py-6 text-center text-xs text-muted">
                  No subscriptions yet.
                </td>
              </tr>
            ) : (
              subscriptions.map((sub) => (
                <tr key={sub.id} className="border-b border-border last:border-b-0">
                  <td className="px-4 py-2">{sub.event_type}</td>
                  <td className="px-4 py-2 break-all">{sub.target_url}</td>
                  <td className="px-4 py-2">{sub.active ? 'Active' : 'Inactive'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-foreground">Webhook deliveries</h2>
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-background/80 border-b border-border">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-muted">Status</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-muted">Event ID</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-muted">Attempts</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-muted">HTTP</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-muted" />
              </tr>
            </thead>
            <tbody>
              {deliveries.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-xs text-muted">
                    No deliveries yet.
                  </td>
                </tr>
              ) : (
                deliveries.map((delivery) => (
                  <tr key={delivery.id} className="border-b border-border last:border-b-0">
                    <td className="px-4 py-2">{delivery.status}</td>
                    <td className="px-4 py-2 break-all">{delivery.event_id}</td>
                    <td className="px-4 py-2">{delivery.attempt_number}</td>
                    <td className="px-4 py-2">{delivery.response_status ?? '—'}</td>
                    <td className="px-4 py-2">
                      <button
                        type="button"
                        onClick={() => void handleReplay(delivery.id)}
                        className="text-xs text-accent hover:underline"
                      >
                        Replay
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
