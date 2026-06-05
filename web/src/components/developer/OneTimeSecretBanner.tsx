import { useState } from 'react';
import { cn } from '@/lib/cn';

interface OneTimeSecretBannerProps {
  label: string;
  secret: string;
  onDismiss?: () => void;
}

export function OneTimeSecretBanner({ label, secret, onDismiss }: OneTimeSecretBannerProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(secret);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-4 space-y-3">
      <div className="flex items-start gap-2">
        <span className="text-yellow-500 text-lg">!</span>
        <div>
          <p className="text-sm font-medium text-foreground">{label}</p>
          <p className="text-xs text-muted mt-1">This value is shown only once. Copy and store it securely.</p>
        </div>
      </div>
      <div className="flex gap-2">
        <code className="flex-1 overflow-x-auto rounded-md border border-border bg-background px-3 py-2 text-sm font-mono text-foreground">
          {secret}
        </code>
        <button
          type="button"
          onClick={() => void handleCopy()}
          className={cn(
            'rounded-md px-3 py-2 text-sm transition-colors',
            copied ? 'bg-green-500/20 text-green-600' : 'bg-accent text-white hover:bg-accent/90'
          )}
        >
          {copied ? 'Copied' : 'Copy'}
        </button>
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            className="rounded-md border border-border px-3 py-2 text-sm text-muted hover:text-foreground"
          >
            Dismiss
          </button>
        )}
      </div>
    </div>
  );
}
