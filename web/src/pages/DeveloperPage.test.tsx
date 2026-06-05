import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { DeveloperPage } from '@/pages/DeveloperPage';
import { DeveloperPortalProvider } from '@/hooks/useDeveloperPortal';

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    isSuperAdmin: false,
  }),
}));

vi.mock('@/components/ui/Toast', () => ({
  useToast: () => ({
    showToast: vi.fn(),
  }),
}));

vi.mock('@/lib/api', () => ({
  apiFetch: vi.fn(async () => ({
    ok: true,
    json: async () => ({ data: [] }),
  })),
}));

function renderDeveloperPage(tab = 'apps') {
  return render(
    <DeveloperPortalProvider>
      <MemoryRouter initialEntries={[`/developer?tab=${tab}`]}>
        <DeveloperPage />
      </MemoryRouter>
    </DeveloperPortalProvider>
  );
}

describe('DeveloperPage', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('defaults to apps tab content', () => {
    renderDeveloperPage('apps');
    expect(screen.getByRole('heading', { name: 'Developer' })).toBeInTheDocument();
    expect(screen.getByText('Your apps')).toBeInTheDocument();
  });

  it('renders try-api tab from query param', () => {
    renderDeveloperPage('try-api');
    expect(screen.getByText('Connect to the API first.')).toBeInTheDocument();
  });

  it('renders advanced tab from query param', () => {
    renderDeveloperPage('advanced');
    expect(screen.getByText('Connect to the API first.')).toBeInTheDocument();
  });
});
