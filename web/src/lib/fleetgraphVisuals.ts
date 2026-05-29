export type FleetGraphRunStatus = 'pending_approval' | 'attention' | 'resolved' | 'no_findings';
export type FleetGraphSeverity = 'high' | 'medium' | 'low' | 'none';

interface ToneDefinition {
  label: string;
  className: string;
  emphasisClassName: string;
}

const statusTones: Record<FleetGraphRunStatus, ToneDefinition> = {
  pending_approval: {
    label: 'Pending Approval',
    className: 'border-orange-500/40 bg-orange-500/12 text-orange-200',
    emphasisClassName: 'text-orange-200',
  },
  attention: {
    label: 'Needs Attention',
    className: 'border-red-500/40 bg-red-500/12 text-red-200',
    emphasisClassName: 'text-red-200',
  },
  resolved: {
    label: 'Resolved',
    className: 'border-emerald-500/40 bg-emerald-500/12 text-emerald-200',
    emphasisClassName: 'text-emerald-200',
  },
  no_findings: {
    label: 'No Findings',
    className: 'border-slate-500/40 bg-slate-500/12 text-slate-200',
    emphasisClassName: 'text-slate-200',
  },
};

const severityTones: Record<FleetGraphSeverity, ToneDefinition> = {
  high: {
    label: 'High',
    className: 'border-red-500/40 bg-red-500/12 text-red-200',
    emphasisClassName: 'text-red-200',
  },
  medium: {
    label: 'Medium',
    className: 'border-amber-500/40 bg-amber-500/12 text-amber-200',
    emphasisClassName: 'text-amber-200',
  },
  low: {
    label: 'Low',
    className: 'border-sky-500/40 bg-sky-500/12 text-sky-200',
    emphasisClassName: 'text-sky-200',
  },
  none: {
    label: 'None',
    className: 'border-slate-500/40 bg-slate-500/12 text-slate-200',
    emphasisClassName: 'text-slate-200',
  },
};

export function normalizeFleetGraphStatus(value: string): FleetGraphRunStatus {
  if (value === 'pending' || value === 'pending_approval') return 'pending_approval';
  if (value === 'open' || value === 'error' || value === 'attention' || value === 'rejected') return 'attention';
  if (value === 'resolved' || value === 'approved' || value === 'ok') return 'resolved';
  return 'no_findings';
}

export function normalizeFleetGraphSeverity(value: string): FleetGraphSeverity {
  if (value === 'high') return 'high';
  if (value === 'medium') return 'medium';
  if (value === 'low') return 'low';
  return 'none';
}

export function getFleetGraphStatusTone(value: string): ToneDefinition {
  return statusTones[normalizeFleetGraphStatus(value)];
}

export function getFleetGraphSeverityTone(value: string): ToneDefinition {
  return severityTones[normalizeFleetGraphSeverity(value)];
}

export function formatFleetGraphDateTime(value: string): string {
  const asDate = new Date(value);
  if (Number.isNaN(asDate.getTime())) {
    return value;
  }
  return asDate.toLocaleString();
}

export function resolveInternalTraceHref(traceUrl?: string | null, traceId?: string): string {
  const normalizedTraceId = traceId?.trim();
  if (normalizedTraceId) {
    return `/fleetgraph/traces/${normalizedTraceId}`;
  }
  if (!traceUrl) {
    return '/fleetgraph/traces';
  }
  if (traceUrl.startsWith('/')) {
    if (traceUrl.startsWith('/api/fleetgraph/traces/')) {
      return traceUrl.replace(/^\/api\/fleetgraph\/traces\//, '/fleetgraph/traces/');
    }
    return traceUrl;
  }
  const legacyPrefix = 'internal://fleetgraph/';
  if (traceUrl.startsWith(legacyPrefix)) {
    return `/fleetgraph/traces/${traceUrl.slice(legacyPrefix.length)}`;
  }
  if (traceUrl.startsWith('http://') || traceUrl.startsWith('https://')) {
    try {
      const parsed = new URL(traceUrl);
      if (parsed.pathname.startsWith('/fleetgraph/traces/')) {
        return `${parsed.pathname}${parsed.search}${parsed.hash}`;
      }
      if (parsed.pathname.startsWith('/api/fleetgraph/traces/')) {
        return `${parsed.pathname.replace(/^\/api\/fleetgraph\/traces\//, '/fleetgraph/traces/')}${parsed.search}${parsed.hash}`;
      }
    } catch {
      return '/fleetgraph/traces';
    }
    return '/fleetgraph/traces';
  }
  return traceUrl;
}

export function resolveExternalTraceHref(externalTraceUrl?: string | null): string | null {
  if (!externalTraceUrl) {
    return null;
  }
  const trimmed = externalTraceUrl.trim();
  if (!trimmed) {
    return null;
  }
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
}
