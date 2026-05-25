/**
 * @version 0.1.0
 * @date 2026-05-24
 * @author Monica Peters <monica.peters@gfachallenger.gauntletai.com>
 *
 * Purpose: Validate and build probe target URLs to prevent SSRF in the security probe CLI.
 *
 * Usage: Imported by api/src/scripts/security-probe.ts; not invoked directly.
 *
 * Example:
 *   const allowed = resolveAllowedProbeHosts(process.env.SECURITY_PROBE_ALLOWED_HOSTS);
 *   const origin = parseProbeHttpOrigin('http://localhost:3000', allowed);
 *   buildProbeHttpUrl(origin, '/api/csrf-token');
 *
 * Dependencies: Node URL API
 *
 * Security/PHI: N/A — no PHI; blocks private/metadata hosts and non-allowlisted domains
 * HIPAA: N/A — no PHI
 * FHIR: N/A — not interoperability
 * Accessibility: N/A — non-UI
 * Performance: O(1) per URL
 * Stability: Throws on invalid/disallowed targets before any network I/O
 * Legal/compliance: N/A
 */

export const DEFAULT_ALLOWED_PROBE_HOSTS = [
  'localhost',
  '127.0.0.1',
  '::1',
  'ship-api-ejok.onrender.com',
  'ship-web-jyqh.onrender.com',
  'ship-docs.onrender.com',
] as const;

export function resolveAllowedProbeHosts(extraHostsEnv?: string): Set<string> {
  const hosts = new Set(DEFAULT_ALLOWED_PROBE_HOSTS.map((host) => host.toLowerCase()));
  if (extraHostsEnv) {
    for (const entry of extraHostsEnv.split(',')) {
      const trimmed = entry.trim().toLowerCase();
      if (trimmed) hosts.add(trimmed);
    }
  }
  return hosts;
}

function parseIpv4(hostname: string): [number, number, number, number] | undefined {
  const match = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!match) return undefined;
  const octets = match.slice(1).map((part) => Number(part));
  if (octets.some((octet) => octet > 255)) return undefined;
  return octets as [number, number, number, number];
}

export function isRestrictedProbeHost(hostname: string): boolean {
  const normalized = hostname.toLowerCase();
  const ipv4 = parseIpv4(normalized);
  if (ipv4) {
    const [a, b] = ipv4;
    if (a === 0) return true;
    if (a === 10) return true;
    if (a === 127) return false;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    return false;
  }
  if (normalized === '::1') return false;
  if (normalized.startsWith('fe80:') || normalized.startsWith('fc') || normalized.startsWith('fd')) {
    return true;
  }
  return false;
}

export function assertAllowedProbeHost(hostname: string, allowedHosts: Set<string>): void {
  const normalized = hostname.toLowerCase();
  if (allowedHosts.has(normalized)) return;
  if (isRestrictedProbeHost(normalized)) {
    throw new Error(`Probe target host "${hostname}" is a restricted/private address`);
  }
  throw new Error(
    `Probe target host "${hostname}" is not in the allowed host list. `
    + 'Set SECURITY_PROBE_ALLOWED_HOSTS to extend the allowlist.',
  );
}

export function parseProbeHttpOrigin(baseUrl: string, allowedHosts: Set<string>): string {
  let parsed: URL;
  try {
    parsed = new URL(baseUrl);
  } catch {
    throw new Error(`Invalid SECURITY_PROBE_BASE_URL: ${baseUrl}`);
  }
  if (parsed.username || parsed.password) {
    throw new Error('Probe target URL must not contain embedded credentials');
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(`Probe target URL must use http or https, got ${parsed.protocol}`);
  }
  assertAllowedProbeHost(parsed.hostname, allowedHosts);
  return parsed.origin;
}

export function parseProbeWsOrigin(wsBaseUrl: string, allowedHosts: Set<string>): string {
  let parsed: URL;
  try {
    parsed = new URL(wsBaseUrl);
  } catch {
    throw new Error(`Invalid SECURITY_PROBE_WS_URL: ${wsBaseUrl}`);
  }
  if (parsed.username || parsed.password) {
    throw new Error('Probe WebSocket URL must not contain embedded credentials');
  }
  if (parsed.protocol !== 'ws:' && parsed.protocol !== 'wss:') {
    throw new Error(`Probe WebSocket URL must use ws or wss, got ${parsed.protocol}`);
  }
  assertAllowedProbeHost(parsed.hostname, allowedHosts);
  return parsed.origin;
}

export function buildProbeHttpUrl(origin: string, pathAndQuery: string): string {
  if (pathAndQuery.startsWith('//') || /^[a-z][a-z0-9+.-]*:\/\//i.test(pathAndQuery)) {
    throw new Error(`Probe path would escape allowed origin: ${pathAndQuery}`);
  }
  if (!pathAndQuery.startsWith('/')) {
    throw new Error(`Probe path must start with /, got: ${pathAndQuery}`);
  }
  const built = new URL(pathAndQuery, origin);
  if (built.origin !== origin) {
    throw new Error(`Probe path would escape allowed origin: ${pathAndQuery}`);
  }
  return built.toString();
}

export function buildProbeWsUrl(origin: string, path: string): string {
  if (!path.startsWith('/')) {
    throw new Error(`Probe WebSocket path must start with /, got: ${path}`);
  }
  const built = new URL(path, origin);
  if (built.origin !== origin) {
    throw new Error(`Probe WebSocket path would escape allowed origin: ${path}`);
  }
  return built.toString();
}

export function resolveProbeTargets(options: {
  baseUrl: string;
  wsBaseUrl?: string;
  allowedHostsEnv?: string;
}): { httpOrigin: string; wsOrigin: string } {
  const allowedHosts = resolveAllowedProbeHosts(options.allowedHostsEnv);
  const normalizedBase = options.baseUrl.replace(/\/$/, '');
  const httpOrigin = parseProbeHttpOrigin(normalizedBase, allowedHosts);
  const wsInput = (options.wsBaseUrl ?? normalizedBase.replace(/^http/i, 'ws')).replace(/\/$/, '');
  const wsOrigin = parseProbeWsOrigin(wsInput, allowedHosts);
  return { httpOrigin, wsOrigin };
}
