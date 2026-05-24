import { describe, expect, it } from 'vitest';
import {
  assertAllowedProbeHost,
  buildProbeHttpUrl,
  buildProbeWsUrl,
  isRestrictedProbeHost,
  parseProbeHttpOrigin,
  parseProbeWsOrigin,
  resolveAllowedProbeHosts,
  resolveProbeTargets,
} from './probe-target-url.js';

describe('probe target URL validation', () => {
  const allowed = resolveAllowedProbeHosts();

  it('allows localhost and Render API hosts', () => {
    expect(parseProbeHttpOrigin('http://localhost:3000', allowed)).toBe('http://localhost:3000');
    expect(parseProbeHttpOrigin('https://ship-api-ejok.onrender.com', allowed)).toBe(
      'https://ship-api-ejok.onrender.com',
    );
  });

  it('rejects private, metadata, and unknown hosts', () => {
    expect(() => parseProbeHttpOrigin('http://169.254.169.254', allowed)).toThrow(/restricted|allowed/i);
    expect(() => parseProbeHttpOrigin('http://10.0.0.1', allowed)).toThrow(/restricted|allowed/i);
    expect(() => parseProbeHttpOrigin('http://evil.com', allowed)).toThrow(/allowed host list/i);
  });

  it('rejects embedded credentials', () => {
    expect(() => parseProbeHttpOrigin('http://user:pass@localhost:3000', allowed)).toThrow(/credentials/i);
  });

  it('merges SECURITY_PROBE_ALLOWED_HOSTS entries', () => {
    const merged = resolveAllowedProbeHosts('staging.example.com, STAGING.EXAMPLE.COM');
    assertAllowedProbeHost('staging.example.com', merged);
    expect(parseProbeHttpOrigin('https://staging.example.com', merged)).toBe('https://staging.example.com');
  });

  it('builds HTTP URLs only from validated origin and relative paths', () => {
    const origin = 'http://localhost:3000';
    expect(buildProbeHttpUrl(origin, '/api/csrf-token')).toBe('http://localhost:3000/api/csrf-token');
    expect(buildProbeHttpUrl(origin, '/api/search?query=test')).toBe(
      'http://localhost:3000/api/search?query=test',
    );
    expect(() => buildProbeHttpUrl(origin, '//evil.com')).toThrow(/escape allowed origin/i);
    expect(() => buildProbeHttpUrl(origin, 'https://evil.com')).toThrow(/escape allowed origin/i);
  });

  it('builds WebSocket URLs from validated ws origin', () => {
    const origin = 'ws://localhost:3000';
    expect(buildProbeWsUrl(origin, '/collaboration/doc')).toBe('ws://localhost:3000/collaboration/doc');
    expect(parseProbeWsOrigin('wss://ship-api-ejok.onrender.com', allowed)).toBe(
      'wss://ship-api-ejok.onrender.com',
    );
  });

  it('flags restricted IP literals', () => {
    expect(isRestrictedProbeHost('10.0.0.1')).toBe(true);
    expect(isRestrictedProbeHost('127.0.0.1')).toBe(false);
    expect(isRestrictedProbeHost('localhost')).toBe(false);
  });

  it('resolves HTTP and WS origins together', () => {
    const targets = resolveProbeTargets({
      baseUrl: 'https://ship-api-ejok.onrender.com/',
      allowedHostsEnv: '',
    });
    expect(targets.httpOrigin).toBe('https://ship-api-ejok.onrender.com');
    expect(targets.wsOrigin).toBe('wss://ship-api-ejok.onrender.com');
  });
});
