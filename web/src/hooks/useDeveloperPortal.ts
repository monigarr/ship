import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { createElement } from 'react';
import { apiFetch } from '@/lib/api';

export const PORTAL_TOKEN_KEY = 'ship.devportal.access_token';

export const PUBLIC_API_SCOPES = [
  'documents:read',
  'documents:write',
  'issues:read',
  'issues:write',
  'sprints:read',
  'sprints:write',
  'webhooks:manage',
] as const;

export interface OAuthAppRow {
  id: string;
  client_id: string;
  name: string;
  requested_scopes: string[];
}

export interface DeliveryRow {
  id: string;
  status: string;
  event_id: string;
  attempt_number: number;
  response_status: number | null;
  created_at: string;
}

export interface SubscriptionRow {
  id: string;
  event_type: string;
  target_url: string;
  active: boolean;
}

export interface AuditRow {
  id: string;
  route: string;
  status_code: number;
  latency_ms: number;
  created_at: string;
}

export interface ApiCallResult {
  ok: boolean;
  status: number;
  latencyMs: number;
  body: unknown;
}

interface DeveloperPortalContextValue {
  apps: OAuthAppRow[];
  appsLoading: boolean;
  selectedClientId: string;
  setSelectedClientId: (clientId: string) => void;
  portalToken: string;
  portalConnected: boolean;
  loadApps: () => Promise<void>;
  issuePortalToken: () => Promise<string | null>;
  clearPortalToken: () => void;
  bearerFetch: (path: string, init?: RequestInit) => Promise<Response>;
  callApi: (path: string, init?: RequestInit) => Promise<ApiCallResult>;
  registerApp: (input: {
    name: string;
    redirectUris: string[];
    requestedScopes: string[];
  }) => Promise<{ clientId: string; clientSecret: string | null } | null>;
  rotateSecret: (appId: string) => Promise<string | null>;
}

const DeveloperPortalContext = createContext<DeveloperPortalContextValue | null>(null);

async function parseResponseBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

export function DeveloperPortalProvider({ children }: { children: ReactNode }) {
  const [apps, setApps] = useState<OAuthAppRow[]>([]);
  const [appsLoading, setAppsLoading] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState('');
  const [portalToken, setPortalToken] = useState(() => sessionStorage.getItem(PORTAL_TOKEN_KEY) ?? '');

  const loadApps = useCallback(async () => {
    setAppsLoading(true);
    try {
      const res = await apiFetch('/api/v1/oauth/apps', { method: 'GET' });
      if (!res.ok) {
        setApps([]);
        return;
      }
      const body = (await res.json()) as { data?: OAuthAppRow[] };
      const rows = body.data ?? [];
      setApps(rows);
      setSelectedClientId((current) => {
        if (current && rows.some((row) => row.client_id === current)) {
          return current;
        }
        return rows[0]?.client_id ?? '';
      });
    } finally {
      setAppsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadApps();
  }, [loadApps]);

  useEffect(() => {
    if (portalToken) {
      sessionStorage.setItem(PORTAL_TOKEN_KEY, portalToken);
    } else {
      sessionStorage.removeItem(PORTAL_TOKEN_KEY);
    }
  }, [portalToken]);

  const bearerFetch = useCallback(
    async (path: string, init?: RequestInit) => {
      if (!portalToken) {
        throw new Error('Issue a portal token first');
      }
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

  const callApi = useCallback(
    async (path: string, init?: RequestInit): Promise<ApiCallResult> => {
      const started = performance.now();
      try {
        const response = await bearerFetch(path, init);
        const body = await parseResponseBody(response);
        return {
          ok: response.ok,
          status: response.status,
          latencyMs: Math.round(performance.now() - started),
          body,
        };
      } catch (error) {
        return {
          ok: false,
          status: 0,
          latencyMs: Math.round(performance.now() - started),
          body: {
            code: 'client_error',
            message: error instanceof Error ? error.message : 'Request failed',
          },
        };
      }
    },
    [bearerFetch]
  );

  const issuePortalToken = useCallback(async () => {
    if (!selectedClientId) return null;
    const res = await apiFetch(`/api/v1/oauth/apps/${selectedClientId}/portal-token`, {
      method: 'POST',
    });
    if (!res.ok) {
      const body = (await res.json()) as { message?: string };
      throw new Error(body.message ?? 'Failed to issue portal token');
    }
    const body = (await res.json()) as { access_token: string };
    setPortalToken(body.access_token);
    return body.access_token;
  }, [selectedClientId]);

  const clearPortalToken = useCallback(() => {
    setPortalToken('');
  }, []);

  const registerApp = useCallback(
    async (input: { name: string; redirectUris: string[]; requestedScopes: string[] }) => {
      const res = await apiFetch('/api/v1/oauth/apps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: input.name,
          redirect_uris: input.redirectUris,
          requested_scopes: input.requestedScopes,
        }),
      });
      if (!res.ok) {
        const body = (await res.json()) as { message?: string };
        throw new Error(body.message ?? 'Failed to register app');
      }
      const body = (await res.json()) as { client_secret?: string; client_id: string };
      setSelectedClientId(body.client_id);
      await loadApps();
      return { clientId: body.client_id, clientSecret: body.client_secret ?? null };
    },
    [loadApps]
  );

  const rotateSecret = useCallback(async (appId: string) => {
    const res = await apiFetch(`/api/v1/oauth/apps/${appId}/rotate-secret`, { method: 'POST' });
    if (!res.ok) {
      const body = (await res.json()) as { message?: string };
      throw new Error(body.message ?? 'Failed to rotate secret');
    }
    const body = (await res.json()) as { client_secret?: string };
    return body.client_secret ?? null;
  }, []);

  const value = useMemo(
    () => ({
      apps,
      appsLoading,
      selectedClientId,
      setSelectedClientId,
      portalToken,
      portalConnected: Boolean(portalToken),
      loadApps,
      issuePortalToken,
      clearPortalToken,
      bearerFetch,
      callApi,
      registerApp,
      rotateSecret,
    }),
    [
      apps,
      appsLoading,
      selectedClientId,
      portalToken,
      loadApps,
      issuePortalToken,
      clearPortalToken,
      bearerFetch,
      callApi,
      registerApp,
      rotateSecret,
    ]
  );

  return createElement(DeveloperPortalContext.Provider, { value }, children);
}

export function useDeveloperPortal(): DeveloperPortalContextValue {
  const context = useContext(DeveloperPortalContext);
  if (!context) {
    throw new Error('useDeveloperPortal must be used within DeveloperPortalProvider');
  }
  return context;
}
