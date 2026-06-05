import { useState } from 'react';
import { useDeveloperPortal, type ApiCallResult } from '@/hooks/useDeveloperPortal';
import { ADVANCED_API_PRESETS } from '@/lib/publicApi';
import { ApiResponsePanel } from '@/components/developer/ApiResponsePanel';
import { useToast } from '@/components/ui/Toast';

const inputClassName =
  'w-full px-3 py-2 bg-background border border-border rounded-md text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent';

export function parseAdvancedRequestBody(bodyText: string, method: 'GET' | 'POST'): unknown | null {
  if (method === 'GET' || !bodyText.trim()) {
    return undefined;
  }
  return JSON.parse(bodyText) as unknown;
}

export function AdvancedApiTab() {
  const { portalConnected, callApi } = useDeveloperPortal();
  const { showToast } = useToast();
  const [method, setMethod] = useState<'GET' | 'POST'>('GET');
  const [path, setPath] = useState('/api/v1/me');
  const [bodyText, setBodyText] = useState('');
  const [preset, setPreset] = useState('');
  const [result, setResult] = useState<ApiCallResult | null>(null);
  const [loading, setLoading] = useState(false);

  function handlePresetChange(value: string) {
    setPreset(value);
    const selected = ADVANCED_API_PRESETS.find((item) => item.label === value);
    if (!selected) return;
    setMethod(selected.method);
    setPath(selected.path);
    setBodyText(selected.body);
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();

    if (!portalConnected) {
      showToast('Issue a portal bearer token on the Apps tab first', 'error');
      return;
    }

    if (!path.startsWith('/api/v1/')) {
      showToast('Path must start with /api/v1/', 'error');
      return;
    }

    let parsedBody: unknown;
    try {
      parsedBody = parseAdvancedRequestBody(bodyText, method);
    } catch {
      showToast('Request body must be valid JSON', 'error');
      return;
    }

    setLoading(true);
    try {
      const response = await callApi(path, {
        method,
        headers: method === 'POST' ? { 'Content-Type': 'application/json' } : undefined,
        body: method === 'POST' && parsedBody !== undefined ? JSON.stringify(parsedBody) : undefined,
      });
      setResult(response);
    } finally {
      setLoading(false);
    }
  }

  if (!portalConnected) {
    return (
      <div className="mx-auto max-w-3xl rounded-lg border border-dashed border-border p-6 space-y-2">
        <p className="text-sm text-foreground">Connect to the API first.</p>
        <p className="text-xs text-muted">
          Issue a portal bearer token on the Apps tab before sending raw API requests.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <form onSubmit={(e) => void handleSend(e)} className="space-y-4 rounded-lg border border-border p-4">
        <div>
          <h2 className="text-sm font-medium text-foreground">Raw API request</h2>
          <p className="text-xs text-muted mt-1">
            Send custom requests to any `/api/v1` endpoint using your portal bearer token.
          </p>
        </div>

        <div>
          <label className="block text-xs text-muted mb-1">Preset</label>
          <select value={preset} onChange={(e) => handlePresetChange(e.target.value)} className={inputClassName}>
            <option value="">Choose a preset…</option>
            {ADVANCED_API_PRESETS.map((item) => (
              <option key={item.label} value={item.label}>
                {item.label}
              </option>
            ))}
          </select>
        </div>

        <div className="grid gap-3 sm:grid-cols-[120px_1fr]">
          <div>
            <label className="block text-xs text-muted mb-1">Method</label>
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value as 'GET' | 'POST')}
              className={inputClassName}
            >
              <option value="GET">GET</option>
              <option value="POST">POST</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-muted mb-1">Path</label>
            <input value={path} onChange={(e) => setPath(e.target.value)} className={inputClassName} required />
          </div>
        </div>

        {method === 'POST' && (
          <div>
            <label className="block text-xs text-muted mb-1">JSON body</label>
            <textarea
              value={bodyText}
              onChange={(e) => setBodyText(e.target.value)}
              rows={8}
              className={`${inputClassName} font-mono text-xs`}
              placeholder='{"title": "Example"}'
            />
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2 bg-accent text-white rounded-md hover:bg-accent/90 disabled:opacity-50"
        >
          {loading ? 'Sending…' : 'Send request'}
        </button>
      </form>

      <ApiResponsePanel result={result} loading={loading} />
    </div>
  );
}
