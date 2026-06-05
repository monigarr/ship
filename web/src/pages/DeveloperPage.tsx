import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { TabBar } from '@/components/ui/TabBar';
import { AppsTab } from '@/components/developer/AppsTab';
import { TryApiTab } from '@/components/developer/TryApiTab';
import { WebhooksTab } from '@/components/developer/WebhooksTab';
import { AuditTab } from '@/components/developer/AuditTab';
import { AdvancedApiTab } from '@/components/developer/AdvancedApiTab';

const TABS = [
  { id: 'apps', label: 'Apps' },
  { id: 'try-api', label: 'Try API' },
  { id: 'webhooks', label: 'Webhooks' },
  { id: 'audit', label: 'Audit' },
  { id: 'advanced', label: 'Advanced' },
] as const;

type DeveloperTab = (typeof TABS)[number]['id'];

const VALID_TABS: DeveloperTab[] = TABS.map((tab) => tab.id);

export function DeveloperPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab') as DeveloperTab | null;
  const activeTab: DeveloperTab =
    tabParam && VALID_TABS.includes(tabParam) ? tabParam : 'apps';

  const handleTabChange = useCallback(
    (tabId: string) => {
      setSearchParams({ tab: tabId }, { replace: true });
    },
    [setSearchParams]
  );

  return (
    <div className="flex h-full flex-col">
      <header className="flex h-14 items-center justify-between border-b border-border px-6">
        <h1 className="text-lg font-semibold text-foreground">Developer</h1>
        <a
          href="/api/v1/openapi.json"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-accent hover:underline"
        >
          OpenAPI spec
        </a>
      </header>

      <TabBar tabs={[...TABS]} activeTab={activeTab} onTabChange={handleTabChange} />

      <main className="flex-1 overflow-auto p-6 pb-20">
        {activeTab === 'apps' && <AppsTab />}
        {activeTab === 'try-api' && <TryApiTab />}
        {activeTab === 'webhooks' && <WebhooksTab />}
        {activeTab === 'audit' && <AuditTab />}
        {activeTab === 'advanced' && <AdvancedApiTab />}
      </main>
    </div>
  );
}
