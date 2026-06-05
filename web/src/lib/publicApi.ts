import type { ApiCallResult } from '@/hooks/useDeveloperPortal';

export interface ShipMeResponse {
  id: string;
  email: string;
  name: string;
  scopes?: string[];
  client_id?: string;
  workspace?: { id: string; name: string };
}

function buildQuery(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') {
      search.set(key, String(value));
    }
  }
  const query = search.toString();
  return query ? `?${query}` : '';
}

export async function fetchMe(callApi: (path: string, init?: RequestInit) => Promise<ApiCallResult>) {
  return callApi('/api/v1/me');
}

export async function listDocuments(
  callApi: (path: string, init?: RequestInit) => Promise<ApiCallResult>,
  params?: { cursor?: string; limit?: number; type?: string }
) {
  return callApi(`/api/v1/documents${buildQuery(params ?? {})}`);
}

export async function getDocument(
  callApi: (path: string, init?: RequestInit) => Promise<ApiCallResult>,
  id: string
) {
  return callApi(`/api/v1/documents/${encodeURIComponent(id)}`);
}

export async function createDocument(
  callApi: (path: string, init?: RequestInit) => Promise<ApiCallResult>,
  input: { title: string; document_type?: string; content?: unknown }
) {
  return callApi('/api/v1/documents', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
}

export async function listIssues(
  callApi: (path: string, init?: RequestInit) => Promise<ApiCallResult>,
  params?: { cursor?: string; limit?: number }
) {
  return callApi(`/api/v1/issues${buildQuery(params ?? {})}`);
}

export async function getIssue(
  callApi: (path: string, init?: RequestInit) => Promise<ApiCallResult>,
  id: string
) {
  return callApi(`/api/v1/issues/${encodeURIComponent(id)}`);
}

export async function createIssue(
  callApi: (path: string, init?: RequestInit) => Promise<ApiCallResult>,
  input: { title: string; properties?: Record<string, unknown> }
) {
  return callApi('/api/v1/issues', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
}

export async function listSprints(
  callApi: (path: string, init?: RequestInit) => Promise<ApiCallResult>,
  params?: { cursor?: string; limit?: number }
) {
  return callApi(`/api/v1/sprints${buildQuery(params ?? {})}`);
}

export async function getSprint(
  callApi: (path: string, init?: RequestInit) => Promise<ApiCallResult>,
  id: string
) {
  return callApi(`/api/v1/sprints/${encodeURIComponent(id)}`);
}

export async function createSprint(
  callApi: (path: string, init?: RequestInit) => Promise<ApiCallResult>,
  input: { title: string; properties?: Record<string, unknown> }
) {
  return callApi('/api/v1/sprints', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
}

export async function startSprint(
  callApi: (path: string, init?: RequestInit) => Promise<ApiCallResult>,
  id: string
) {
  return callApi(`/api/v1/sprints/${encodeURIComponent(id)}/start`, { method: 'POST' });
}

export const WEBHOOK_EVENT_TYPES = [
  'document.created',
  'document.updated',
  'document.deleted',
  'issue.created',
  'issue.assigned',
  'issue.status_changed',
  'sprint.started',
  'sprint.completed',
] as const;

export const ADVANCED_API_PRESETS = [
  { label: 'GET /me', method: 'GET' as const, path: '/api/v1/me', body: '' },
  { label: 'GET /documents', method: 'GET' as const, path: '/api/v1/documents', body: '' },
  { label: 'GET /issues', method: 'GET' as const, path: '/api/v1/issues', body: '' },
  { label: 'GET /sprints', method: 'GET' as const, path: '/api/v1/sprints', body: '' },
  { label: 'GET /webhooks', method: 'GET' as const, path: '/api/v1/webhooks', body: '' },
  { label: 'GET /audit', method: 'GET' as const, path: '/api/v1/audit', body: '' },
  {
    label: 'POST /documents',
    method: 'POST' as const,
    path: '/api/v1/documents',
    body: JSON.stringify({ title: 'API test document', document_type: 'wiki' }, null, 2),
  },
  {
    label: 'POST /issues',
    method: 'POST' as const,
    path: '/api/v1/issues',
    body: JSON.stringify({ title: 'API test issue' }, null, 2),
  },
] as const;
