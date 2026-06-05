import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { ReactNode } from 'react';
import {
  DeveloperPortalProvider,
  PORTAL_TOKEN_KEY,
  useDeveloperPortal,
} from '@/hooks/useDeveloperPortal';

vi.mock('@/lib/api', () => ({
  apiFetch: vi.fn(async () => ({
    ok: true,
    json: async () => ({ data: [] }),
  })),
}));

function wrapper({ children }: { children: ReactNode }) {
  return <DeveloperPortalProvider>{children}</DeveloperPortalProvider>;
}

describe('useDeveloperPortal', () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.clearAllMocks();
  });

  it('restores portal token from sessionStorage', () => {
    sessionStorage.setItem(PORTAL_TOKEN_KEY, 'atk_test_token');

    const { result } = renderHook(() => useDeveloperPortal(), { wrapper });

    expect(result.current.portalToken).toBe('atk_test_token');
    expect(result.current.portalConnected).toBe(true);
  });

  it('clears portal token from sessionStorage', () => {
    sessionStorage.setItem(PORTAL_TOKEN_KEY, 'atk_test_token');

    const { result } = renderHook(() => useDeveloperPortal(), { wrapper });

    act(() => {
      result.current.clearPortalToken();
    });

    expect(result.current.portalToken).toBe('');
    expect(sessionStorage.getItem(PORTAL_TOKEN_KEY)).toBeNull();
  });
});
