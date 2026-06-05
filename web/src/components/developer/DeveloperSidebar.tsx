import { useLocation, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/cn';
import { useDeveloperPortal } from '@/hooks/useDeveloperPortal';

const NAV_ITEMS = [
  { id: 'apps', label: 'Apps', tab: 'apps' },
  { id: 'try-api', label: 'Try API', tab: 'try-api' },
  { id: 'webhooks', label: 'Webhooks', tab: 'webhooks' },
  { id: 'audit', label: 'Audit', tab: 'audit' },
  { id: 'advanced', label: 'Advanced', tab: 'advanced' },
] as const;

export function DeveloperSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { selectedClientId, portalConnected, apps } = useDeveloperPortal();

  const activeTab = new URLSearchParams(location.search).get('tab') ?? 'apps';
  const selectedApp = apps.find((app) => app.client_id === selectedClientId);

  return (
    <div className="flex h-full flex-col">
      <ul className="space-y-0.5 px-2">
        {NAV_ITEMS.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              onClick={() => navigate(`/developer?tab=${item.tab}`)}
              className={cn(
                'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors',
                activeTab === item.tab
                  ? 'bg-border/50 text-foreground'
                  : 'text-muted hover:bg-border/30 hover:text-foreground'
              )}
            >
              {item.label}
            </button>
          </li>
        ))}
      </ul>

      <div className="mt-auto border-t border-border px-3 py-3 space-y-2">
        <p className="text-xs font-medium text-foreground">API connection</p>
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'h-2 w-2 rounded-full',
              portalConnected ? 'bg-green-500' : 'bg-muted'
            )}
            aria-hidden="true"
          />
          <span className="text-xs text-muted">
            {portalConnected ? 'Bearer token active' : 'Not connected'}
          </span>
        </div>
        <p className="text-xs text-muted truncate" title={selectedClientId || undefined}>
          App: {selectedApp?.name ?? (selectedClientId ? selectedClientId : 'None selected')}
        </p>
      </div>
    </div>
  );
}
