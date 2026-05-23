import { describe, expect, it } from 'vitest';
import { ipKeyGenerator } from 'express-rate-limit';
import { normalizeClientIp } from '../normalize-client-ip.js';

describe('normalizeClientIp', () => {
  it('documents before vs after rate-limit key behavior', () => {
    const beforeA = ipKeyGenerator('::ffff:203.0.113.7');
    const beforeB = ipKeyGenerator('::ffff:198.51.100.22');

    const afterA = ipKeyGenerator(normalizeClientIp('::ffff:203.0.113.7'), false);
    const afterB = ipKeyGenerator(normalizeClientIp('::ffff:198.51.100.22'), false);
    expect(afterA).toBe('203.0.113.7');
    expect(afterB).toBe('198.51.100.22');
    expect(afterA).not.toBe(afterB);
    // If the upstream package collapses mapped IPv6 addresses, document that behavior.
    // If upstream no longer collapses, we still enforce normalized and distinct keys.
    if (beforeA === beforeB) {
      expect(beforeA).not.toBe(afterA);
      expect(beforeB).not.toBe(afterB);
    }
  });

  it('strips IPv4-mapped IPv6 prefix', () => {
    expect(normalizeClientIp('::ffff:203.0.113.7')).toBe('203.0.113.7');
  });

  it('keeps regular IPv4 unchanged', () => {
    expect(normalizeClientIp('203.0.113.7')).toBe('203.0.113.7');
  });

  it('keeps non-mapped IPv6 unchanged', () => {
    expect(normalizeClientIp('2001:db8::7')).toBe('2001:db8::7');
  });

  it('returns unknown for empty inputs', () => {
    expect(normalizeClientIp(undefined)).toBe('unknown');
    expect(normalizeClientIp('  ')).toBe('unknown');
  });
});
