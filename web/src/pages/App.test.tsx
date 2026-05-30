import { describe, it, expect, beforeEach, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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
            <Route path="my-week" element={<div>My Week Route</div>} />
            <Route path="docs" element={<div>Docs Route</div>} />
            <Route path="issues" element={<div>Issues Route</div>} />
            <Route path="projects" element={<div>Projects Route</div>} />
            <Route path="programs" element={<div>Programs Route</div>} />
            <Route path="team" element={<div>Teams Route</div>} />
            <Route path="settings" element={<div>Settings Route</div>} />
            <Route path="documents/:id" element={<div>Document Route</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('AppLayout left rail navigation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCurrentDocument.currentDocumentId = null;
    mockCurrentDocument.currentDocumentType = null;
    mockCurrentDocument.currentDocumentProjectId = null;
    localStorage.setItem('ship:fleetGraphDrawerOpen', 'false');
  });

  it('navigates with each non-chat left rail icon', async () => {
    renderApp('/dashboard');

    fireEvent.click(screen.getByLabelText('Docs'));
    expect(await screen.findByText('Docs Route')).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Projects'));
    expect(await screen.findByText('Projects Route')).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Programs'));
    expect(await screen.findByText('Programs Route')).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Teams'));
    expect(await screen.findByText('Teams Route')).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Settings'));
    expect(await screen.findByText('Settings Route')).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Dashboard'));
    expect(await screen.findByText('My Week Route')).toBeInTheDocument();
  });

  it('keeps FleetGraph pinned across route changes until chat icon toggles it off', async () => {
    renderApp('/dashboard');

    fireEvent.click(screen.getByLabelText('Open FleetGraph in left sidebar'));
    expect(await screen.findByText('FleetGraph Assistant (context-aware)')).toBeInTheDocument();
    expect(screen.getByTestId('fleetgraph-assistant-mock')).toBeInTheDocument();
    expect(screen.getByText(/FleetGraph is pinned. Current route:/i)).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Docs'));
    expect(await screen.findByText('Docs Route')).toBeInTheDocument();
    expect(screen.getByTestId('fleetgraph-assistant-mock')).toBeInTheDocument();
    expect(screen.getByText(/Current route: Docs/i)).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Close FleetGraph in left sidebar'));
    await waitFor(() => {
      expect(screen.queryByTestId('fleetgraph-assistant-mock')).not.toBeInTheDocument();
    });
  });

  it('opens FleetGraph from a weekly document context where sidebar is normally hidden', async () => {
    mockCurrentDocument.currentDocumentId = 'weekly-1';
    mockCurrentDocument.currentDocumentType = 'weekly_plan';
    renderApp('/documents/weekly-1');

    expect(screen.queryByText('FleetGraph Assistant (context-aware)')).not.toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Open FleetGraph in left sidebar'));

    expect(await screen.findByText('FleetGraph Assistant (context-aware)')).toBeInTheDocument();
    expect(screen.getByTestId('fleetgraph-assistant-mock')).toBeInTheDocument();
  });

  it('renders external LangSmith traces link on the rail', () => {
    renderApp('/dashboard');

    const externalLink = screen.getByLabelText('LangSmith traces (external)');
    expect(externalLink).toBeInTheDocument();
    expect(externalLink).toHaveAttribute('href');
  });

  it('renders internal traces list link on the rail', () => {
    renderApp('/dashboard');

    const internalLink = screen.getByLabelText('Internal traces list');
    expect(internalLink).toBeInTheDocument();
    expect(internalLink).toHaveAttribute('href', 'https://ship-web-jyqh.onrender.com/fleetgraph/traces/');
  });
});
