import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useDeveloperPortal, PUBLIC_API_SCOPES } from '@/hooks/useDeveloperPortal';
import { useToast } from '@/components/ui/Toast';
import { Skeleton } from '@/components/ui/Skeleton';
import { OneTimeSecretBanner } from '@/components/developer/OneTimeSecretBanner';
import { cn } from '@/lib/cn';

const inputClassName =
  'w-full px-3 py-2 bg-background border border-border rounded-md text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent';

export function AppsTab() {
  const { isSuperAdmin } = useAuth();
  const { showToast } = useToast();
  const {
    apps,
    appsLoading,
    selectedClientId,
    setSelectedClientId,
    portalConnected,
    loadApps,
    issuePortalToken,
    clearPortalToken,
    registerApp,
    rotateSecret,
  } = useDeveloperPortal();

  const [appName, setAppName] = useState('My Integration');
  const [redirectUris, setRedirectUris] = useState('https://example.local/oauth/callback');
  const [selectedScopes, setSelectedScopes] = useState<string[]>([
    'documents:read',
    'documents:write',
    'issues:read',
    'webhooks:manage',
  ]);
  const [newSecret, setNewSecret] = useState<string | null>(null);
  const [registering, setRegistering] = useState(false);
  const [issuingToken, setIssuingToken] = useState(false);

  function toggleScope(scope: string) {
    setSelectedScopes((current) =>
      current.includes(scope) ? current.filter((value) => value !== scope) : [...current, scope]
    );
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    if (!appName.trim() || selectedScopes.length === 0) return;

    setRegistering(true);
    setNewSecret(null);
    try {
      const redirectUriList = redirectUris
        .split('\n')
        .map((uri) => uri.trim())
        .filter(Boolean);
      const result = await registerApp({
        name: appName.trim(),
        redirectUris: redirectUriList,
        requestedScopes: selectedScopes,
      });
      if (result?.clientSecret) {
        setNewSecret(result.clientSecret);
      }
      showToast('OAuth app registered', 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to register app', 'error');
    } finally {
      setRegistering(false);
    }
  }

  async function handleRotateSecret(appId: string) {
    setNewSecret(null);
    try {
      const secret = await rotateSecret(appId);
      if (secret) {
        setNewSecret(secret);
        showToast('Client secret rotated', 'success');
      }
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to rotate secret', 'error');
    }
  }

  async function handleIssueToken() {
    setIssuingToken(true);
    try {
      await issuePortalToken();
      showToast('Portal bearer token issued', 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to issue portal token', 'error');
    } finally {
      setIssuingToken(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      {isSuperAdmin && (
        <section className="space-y-4">
          <div>
            <h2 className="text-sm font-medium text-foreground">Register OAuth app</h2>
            <p className="text-xs text-muted mt-1">
              Create a new OAuth application for integrations with the public API.
            </p>
          </div>

          <form onSubmit={(e) => void handleRegister(e)} className="space-y-4">
            <div>
              <label className="block text-xs text-muted mb-1">App name</label>
              <input
                type="text"
                value={appName}
                onChange={(e) => setAppName(e.target.value)}
                className={inputClassName}
                required
              />
            </div>

            <div>
              <label className="block text-xs text-muted mb-1">Redirect URIs (one per line)</label>
              <textarea
                value={redirectUris}
                onChange={(e) => setRedirectUris(e.target.value)}
                rows={3}
                className={inputClassName}
                required
              />
            </div>

            <fieldset>
              <legend className="block text-xs text-muted mb-2">Requested scopes</legend>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {PUBLIC_API_SCOPES.map((scope) => (
                  <label key={scope} className="flex items-center gap-2 text-sm text-foreground">
                    <input
                      type="checkbox"
                      checked={selectedScopes.includes(scope)}
                      onChange={() => toggleScope(scope)}
                      className="rounded border-border"
                    />
                    <code className="text-xs">{scope}</code>
                  </label>
                ))}
              </div>
            </fieldset>

            <button
              type="submit"
              disabled={registering || selectedScopes.length === 0}
              className="px-4 py-2 bg-accent text-white rounded-md hover:bg-accent/90 disabled:opacity-50"
            >
              {registering ? 'Registering…' : 'Register app'}
            </button>
          </form>
        </section>
      )}

      {newSecret && (
        <OneTimeSecretBanner
          label="Client secret (shown once)"
          secret={newSecret}
          onDismiss={() => setNewSecret(null)}
        />
      )}

      <section className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-medium text-foreground">Your apps</h2>
            <p className="text-xs text-muted mt-1">Select an app to issue a portal bearer token for API testing.</p>
          </div>
          <button
            type="button"
            onClick={() => void loadApps()}
            className="px-3 py-1.5 text-sm rounded-md border border-border text-muted hover:text-foreground"
          >
            Refresh
          </button>
        </div>

        {appsLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : apps.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-6 space-y-2">
            <p className="text-sm text-foreground">No OAuth apps available.</p>
            {!isSuperAdmin && (
              <p className="text-xs text-muted">
                Ask a workspace admin to register an OAuth app, then return here to connect and test the API.
              </p>
            )}
            <a
              href="/api/v1/openapi.json"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block text-xs text-accent hover:underline"
            >
              View OpenAPI specification
            </a>
          </div>
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border">
            {apps.map((app) => (
              <li key={app.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">{app.name}</p>
                  <code className="text-xs text-muted break-all">{app.client_id}</code>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedClientId(app.client_id)}
                    className={cn(
                      'px-3 py-1.5 text-xs rounded-md border transition-colors',
                      selectedClientId === app.client_id
                        ? 'border-accent bg-accent/10 text-accent'
                        : 'border-border text-muted hover:text-foreground'
                    )}
                  >
                    {selectedClientId === app.client_id ? 'Selected' : 'Select'}
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleRotateSecret(app.id)}
                    className="px-3 py-1.5 text-xs rounded-md border border-border text-muted hover:text-foreground"
                  >
                    Rotate secret
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-4 rounded-lg border border-border p-4">
        <div>
          <h2 className="text-sm font-medium text-foreground">Portal API session</h2>
          <p className="text-xs text-muted mt-1">
            Issue a short-lived bearer token to call `/api/v1` endpoints from Try API, Webhooks, and Advanced tabs.
          </p>
        </div>

        <p className="text-sm text-muted">
          Selected app:{' '}
          <code className="text-foreground">{selectedClientId || 'none'}</code>
        </p>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void handleIssueToken()}
            disabled={!selectedClientId || issuingToken}
            className="px-4 py-2 bg-accent text-white rounded-md hover:bg-accent/90 disabled:opacity-50"
          >
            {issuingToken ? 'Issuing…' : 'Issue portal bearer token'}
          </button>
          {portalConnected && (
            <button
              type="button"
              onClick={clearPortalToken}
              className="px-4 py-2 rounded-md border border-border text-muted hover:text-foreground"
            >
              Clear token
            </button>
          )}
        </div>

        {portalConnected && (
          <p className="text-xs text-green-600">Portal bearer token active in this browser session.</p>
        )}
      </section>
    </div>
  );
}
