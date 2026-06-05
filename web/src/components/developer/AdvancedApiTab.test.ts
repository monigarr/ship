import { describe, it, expect } from 'vitest';
import { parseAdvancedRequestBody } from '@/components/developer/AdvancedApiTab';

describe('parseAdvancedRequestBody', () => {
  it('returns undefined for GET requests', () => {
    expect(parseAdvancedRequestBody('{"title":"x"}', 'GET')).toBeUndefined();
  });

  it('returns undefined for empty POST body', () => {
    expect(parseAdvancedRequestBody('   ', 'POST')).toBeUndefined();
  });

  it('parses valid JSON for POST requests', () => {
    expect(parseAdvancedRequestBody('{"title":"Example"}', 'POST')).toEqual({ title: 'Example' });
  });

  it('throws for invalid JSON', () => {
    expect(() => parseAdvancedRequestBody('{bad json', 'POST')).toThrow();
  });
});
