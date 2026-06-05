import { cn } from '@/lib/cn';
import type { ApiCallResult } from '@/hooks/useDeveloperPortal';

interface ApiResponsePanelProps {
  result: ApiCallResult | null;
  loading?: boolean;
  className?: string;
}

export function ApiResponsePanel({ result, loading = false, className }: ApiResponsePanelProps) {
  if (loading) {
    return (
      <div className={cn('rounded-lg border border-border bg-background p-4', className)}>
        <p className="text-sm text-muted">Sending request…</p>
      </div>
    );
  }

  if (!result) {
    return (
      <div className={cn('rounded-lg border border-dashed border-border bg-background/50 p-4', className)}>
        <p className="text-sm text-muted">Response will appear here after you send a request.</p>
      </div>
    );
  }

  const formattedBody =
    typeof result.body === 'string' ? result.body : JSON.stringify(result.body, null, 2);

  return (
    <div className={cn('rounded-lg border border-border bg-background', className)}>
      <div className="flex items-center gap-3 border-b border-border px-4 py-2">
        <span
          className={cn(
            'rounded px-2 py-0.5 text-xs font-medium',
            result.ok ? 'bg-green-500/15 text-green-600' : 'bg-red-500/15 text-red-600'
          )}
        >
          {result.status || 'ERR'}
        </span>
        <span className="text-xs text-muted">{result.latencyMs}ms</span>
      </div>
      <pre className="max-h-96 overflow-auto p-4 text-xs font-mono text-foreground whitespace-pre-wrap break-words">
        {formattedBody}
      </pre>
    </div>
  );
}
