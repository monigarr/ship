import { useCallback, useEffect, useState } from 'react';
import { useDeveloperPortal, type AuditRow } from '@/hooks/useDeveloperPortal';

export function AuditTab() {
  const { portalConnected, bearerFetch } = useDeveloperPortal();
  const [auditRows, setAuditRows] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(false);

  const loadAudit = useCallback(async () => {
    setLoading(true);
    try {
      const res = await bearerFetch('/api/v1/audit');
      if (!res.ok) return;
      const body = (await res.json()) as { data: AuditRow[] };
      setAuditRows(body.data ?? []);
    } finally {
      setLoading(false);
    }
  }, [bearerFetch]);

  useEffect(() => {
    if (portalConnected) {
      void loadAudit();
    }
  }, [portalConnected, loadAudit]);

  if (!portalConnected) {
    return (
      <div className="mx-auto max-w-3xl rounded-lg border border-dashed border-border p-6 space-y-2">
        <p className="text-sm text-foreground">Connect to the API first.</p>
        <p className="text-xs text-muted">
          Issue a portal bearer token on the Apps tab to view the public API audit log.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-medium text-foreground">Public API audit log</h2>
          <p className="text-xs text-muted mt-1">Recent requests made by your OAuth app (last 100 entries).</p>
        </div>
        <button
          type="button"
          onClick={() => void loadAudit()}
          disabled={loading}
          className="px-3 py-1.5 text-sm rounded-md border border-border text-muted hover:text-foreground"
        >
          Refresh
        </button>
      </div>

      <div className="rounded-lg border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-background/80 border-b border-border">
            <tr>
              <th className="px-4 py-2 text-left text-xs font-medium text-muted">Route</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-muted">Status</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-muted">Latency</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-muted">Time</th>
            </tr>
          </thead>
          <tbody>
            {auditRows.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-xs text-muted">
                  {loading ? 'Loading audit log…' : 'No audit entries yet.'}
                </td>
              </tr>
            ) : (
              auditRows.slice(0, 100).map((row) => (
                <tr key={row.id} className="border-b border-border last:border-b-0">
                  <td className="px-4 py-2 font-mono text-xs break-all">{row.route}</td>
                  <td className="px-4 py-2">{row.status_code}</td>
                  <td className="px-4 py-2">{row.latency_ms}ms</td>
                  <td className="px-4 py-2 text-xs text-muted">{row.created_at}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
