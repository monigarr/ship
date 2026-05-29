import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { AppLayout } from './App';

const mockCurrentDocument = {
  currentDocumentId: null as string | null,
  currentDocumentType: null as
    | 'wiki'
    | 'issue'
    | 'project'
    | 'program'
    | 'sprint'
    | 'person'
    | 'weekly_plan'
    | 'weekly_retro'
    | 'standup'
    | null,
  currentDocumentProjectId: null as string | null,
};

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    user: { id: 'user-1', name: 'Test User' },
    logout: vi.fn(),
    isSuperAdmin: false,
    impersonating: null,
    endImpersonation: vi.fn(),
  }),
}));

vi.mock('@/hooks/useFocusOnNavigate', () => ({
  useFocusOnNavigate: vi.fn(),
}));

vi.mock('@/hooks/useRealtimeEvents', () => ({
  useRealtimeEvent: vi.fn(),
}));

vi.mock('@/contexts/WorkspaceContext', () => ({
  useWorkspace: () => ({
    currentWorkspace: { id: 'ws-1', name: 'Workspace One', role: 'owner' },
    workspaces: [{ id: 'ws-1', name: 'Workspace One', role: 'owner' }],
    switchWorkspace: vi.fn(async () => true),
  }),
}));

vi.mock('@/contexts/DocumentsContext', () => ({
  useDocuments: () => ({
    documents: [{ id: 'sprint-1', title: 'Sprint Alpha', visibility: 'workspace', children: [] }],
    createDocument: vi.fn(),
    updateDocument: vi.fn(),
    deleteDocument: vi.fn(),
  }),
}));

vi.mock('@/contexts/ProgramsContext', () => ({
  usePrograms: () => ({
    programs: [],
    updateProgram: vi.fn(),
  }),
}));

vi.mock('@/contexts/IssuesContext', () => ({
  useIssues: () => ({
    issues: [{ id: 'issue-1', title: 'Issue Alpha', state: 'todo' }],
    createIssue: vi.fn(),
    updateIssue: vi.fn(),
  }),
}));

vi.mock('@/contexts/ProjectsContext', () => ({
  useProjects: () => ({
    projects: [{ id: 'project-1', title: 'Project Alpha' }],
    createProject: vi.fn(),
    updateProject: vi.fn(),
  }),
}));

vi.mock('@/contexts/CurrentDocumentContext', () => ({
  useCurrentDocument: () => ({
    ...mockCurrentDocument,
    setCurrentDocument: vi.fn(),
    clearCurrentDocument: vi.fn(),
  }),
}));

vi.mock('@/hooks/useStandupStatusQuery', () => ({
  useStandupStatusQuery: () => ({ data: { due: false } }),
}));

vi.mock('@/hooks/useActionItemsQuery', () => ({
  actionItemsKeys: { all: ['action-items'] },
  useActionItemsQuery: () => ({ data: { items: [], has_overdue: false } }),
}));

vi.mock('@/hooks/useTeamMembersQuery', () => ({
  useTeamMembersQuery: () => ({ data: [] }),
}));

vi.mock('@/hooks/useSessionTimeout', () => ({
  useSessionTimeout: () => ({
    showWarning: false,
    timeRemaining: null,
    warningType: 'soft',
    resetTimer: vi.fn(),
  }),
}));

vi.mock('@/components/CommandPalette', () => ({
  CommandPalette: () => null,
}));

vi.mock('@/components/SessionTimeoutModal', () => ({
  SessionTimeoutModal: () => null,
}));

vi.mock('@/components/UploadNavigationWarning', () => ({
  UploadNavigationWarning: () => null,
}));

vi.mock('@/components/CacheCorruptionAlert', () => ({
  CacheCorruptionAlert: () => null,
}));

vi.mock('@/components/DashboardSidebar', () => ({
  DashboardSidebar: () => <div>Dashboard Sidebar</div>,
}));

vi.mock('@/components/ProjectSetupWizard', () => ({
  ProjectSetupWizard: () => null,
}));

vi.mock('@/contexts/SelectionPersistenceContext', () => ({
  SelectionPersistenceProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock('@/components/ActionItemsModal', () => ({
  ActionItemsModal: () => null,
}));

vi.mock('@/components/AccountabilityBanner', () => ({
  AccountabilityBanner: () => null,
}));

vi.mock('@/components/sidebars/ProjectContextSidebar', () => ({
  ProjectContextSidebar: () => null,
}));

vi.mock('@/components/ui/Toast', () => ({
  useToast: () => ({
    showToast: vi.fn(),
  }),
}));

vi.mock('@/components/sidebars/FleetGraphAssistant', () => ({
  FleetGraphAssistant: ({
    documentId,
    documentType,
    contextLabel,
  }: {
    documentId?: string | null;
    documentType?: string | null;
    contextLabel?: string;
  }) => (
    <div data-testid="fleetgraph-assistant-mock">
      {documentId && documentType ? (
        <p>{`Scoped to ${documentType}: ${contextLabel ?? documentId}`}</p>
      ) : (
        <p>
          View an Issue, Project, or Sprint for FleetGraph support. Workspace diagnostics and traces remain available.
        </p>
      )}
    </div>
  ),
}));

function renderApp(route: string) {
  const client = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter key={route} initialEntries={[route]}>
        <Routes>
          <Route path="/" element={<AppLayout />}>
            <Route path="dashboard" element={<div>Dashboard Route</div>} />
            <Route path="documents/:id" element={<div>Document Route</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('AppLayout FleetGraph drawer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCurrentDocument.currentDocumentId = null;
    mockCurrentDocument.currentDocumentType = null;
    mockCurrentDocument.currentDocumentProjectId = null;
    localStorage.setItem('ship:fleetGraphDrawerOpen', 'true');
  });

  it('shows no-context fallback on non-entity routes', async () => {
    renderApp('/dashboard');

    expect(
      await screen.findByText(
        'View an Issue, Project, or Sprint for FleetGraph support. Workspace diagnostics and traces remain available.'
      )
    ).toBeInTheDocument();
  });

  it('updates scoped FleetGraph context across issue, project, and sprint routes', async () => {
    mockCurrentDocument.currentDocumentId = 'issue-1';
    mockCurrentDocument.currentDocumentType = 'issue';
    const view = renderApp('/documents/issue-1');

    expect(await screen.findByText(/Scoped to issue:\s*Issue Alpha/i)).toBeInTheDocument();

    mockCurrentDocument.currentDocumentId = 'project-1';
    mockCurrentDocument.currentDocumentType = 'project';
    view.rerender(
      <QueryClientProvider
        client={
          new QueryClient({
            defaultOptions: { queries: { retry: false } },
          })
        }
      >
        <MemoryRouter key="/documents/project-1" initialEntries={['/documents/project-1']}>
          <Routes>
            <Route path="/" element={<AppLayout />}>
              <Route path="dashboard" element={<div>Dashboard Route</div>} />
              <Route path="documents/:id" element={<div>Document Route</div>} />
            </Route>
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );

    expect(await screen.findByText(/Scoped to project:\s*Project Alpha/i)).toBeInTheDocument();

    mockCurrentDocument.currentDocumentId = 'sprint-1';
    mockCurrentDocument.currentDocumentType = 'sprint';
    view.rerender(
      <QueryClientProvider
        client={
          new QueryClient({
            defaultOptions: { queries: { retry: false } },
          })
        }
      >
        <MemoryRouter key="/documents/sprint-1" initialEntries={['/documents/sprint-1']}>
          <Routes>
            <Route path="/" element={<AppLayout />}>
              <Route path="dashboard" element={<div>Dashboard Route</div>} />
              <Route path="documents/:id" element={<div>Document Route</div>} />
            </Route>
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );

    expect(await screen.findByText(/Scoped to sprint:\s*Sprint Alpha/i)).toBeInTheDocument();
  });

  it('uses accent styling for rail trigger and closed-edge opener', () => {
    renderApp('/dashboard');

    const railTrigger = screen.getByLabelText('Close FleetGraph assistant');
    expect(railTrigger.className).toContain('text-accent');
    expect(railTrigger.className).toContain('bg-accent/25');

    localStorage.setItem('ship:fleetGraphDrawerOpen', 'false');
    renderApp('/dashboard');

    const edgeOpener = screen.getByLabelText('Open FleetGraph drawer');
    expect(edgeOpener.className).toContain('text-accent');
    expect(edgeOpener.className).toContain('bg-accent/15');
  });
});
