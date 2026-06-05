import { useState } from 'react';
import { useDeveloperPortal, type ApiCallResult } from '@/hooks/useDeveloperPortal';
import {
  createDocument,
  createIssue,
  createSprint,
  fetchMe,
  getDocument,
  getIssue,
  getSprint,
  listDocuments,
  listIssues,
  listSprints,
  startSprint,
  type ShipMeResponse,
} from '@/lib/publicApi';
import { ApiResponsePanel } from '@/components/developer/ApiResponsePanel';
import { useToast } from '@/components/ui/Toast';

const inputClassName =
  'w-full px-3 py-2 bg-background border border-border rounded-md text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent';

function ResourceSection({
  title,
  description,
  disabled,
  children,
}: {
  title: string;
  description: string;
  disabled: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-border p-4 space-y-4">
      <div>
        <h3 className="text-sm font-medium text-foreground">{title}</h3>
        <p className="text-xs text-muted mt-1">{description}</p>
      </div>
      <fieldset disabled={disabled} className="space-y-3 disabled:opacity-50">
        {children}
      </fieldset>
    </section>
  );
}

export function TryApiTab() {
  const { portalConnected, callApi } = useDeveloperPortal();
  const { showToast } = useToast();
  const [result, setResult] = useState<ApiCallResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [grantedScopes, setGrantedScopes] = useState<string[]>([]);

  const [docCursor, setDocCursor] = useState('');
  const [docLimit, setDocLimit] = useState('20');
  const [docType, setDocType] = useState('');
  const [docId, setDocId] = useState('');
  const [docTitle, setDocTitle] = useState('API test document');
  const [docBodyType, setDocBodyType] = useState('wiki');

  const [issueCursor, setIssueCursor] = useState('');
  const [issueLimit, setIssueLimit] = useState('20');
  const [issueId, setIssueId] = useState('');
  const [issueTitle, setIssueTitle] = useState('API test issue');

  const [sprintCursor, setSprintCursor] = useState('');
  const [sprintLimit, setSprintLimit] = useState('20');
  const [sprintId, setSprintId] = useState('');
  const [sprintTitle, setSprintTitle] = useState('API test sprint');

  async function runRequest(request: Promise<ApiCallResult>, updateScopes = false) {
    if (!portalConnected) {
      showToast('Issue a portal bearer token on the Apps tab first', 'error');
      return;
    }

    setLoading(true);
    try {
      const response = await request;
      setResult(response);
      if (updateScopes && response.ok) {
        const body = response.body as ShipMeResponse;
        if (Array.isArray(body.scopes)) {
          setGrantedScopes(body.scopes);
        }
      }
    } finally {
      setLoading(false);
    }
  }

  if (!portalConnected) {
    return (
      <div className="mx-auto max-w-3xl rounded-lg border border-dashed border-border p-6 space-y-2">
        <p className="text-sm text-foreground">Connect to the API first.</p>
        <p className="text-xs text-muted">
          Go to the Apps tab, select an OAuth app, and issue a portal bearer token before trying API requests.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {grantedScopes.length > 0 && (
        <div className="rounded-lg border border-border bg-background/50 px-4 py-3">
          <p className="text-xs text-muted mb-1">Granted scopes (from last /me response)</p>
          <div className="flex flex-wrap gap-2">
            {grantedScopes.map((scope) => (
              <code key={scope} className="rounded bg-border/40 px-2 py-0.5 text-xs">
                {scope}
              </code>
            ))}
          </div>
        </div>
      )}

      <ResourceSection title="Profile" description="Verify your bearer token and granted scopes." disabled={loading}>
        <button
          type="button"
          onClick={() => void runRequest(fetchMe(callApi), true)}
          className="px-4 py-2 bg-accent text-white rounded-md hover:bg-accent/90"
        >
          GET /me
        </button>
      </ResourceSection>

      <ResourceSection title="Documents" description="List, fetch, or create documents." disabled={loading}>
        <div className="grid gap-3 sm:grid-cols-3">
          <input value={docCursor} onChange={(e) => setDocCursor(e.target.value)} placeholder="Cursor" className={inputClassName} />
          <input value={docLimit} onChange={(e) => setDocLimit(e.target.value)} placeholder="Limit" className={inputClassName} />
          <input value={docType} onChange={(e) => setDocType(e.target.value)} placeholder="Type (optional)" className={inputClassName} />
        </div>
        <button
          type="button"
          onClick={() =>
            void runRequest(
              listDocuments(callApi, {
                cursor: docCursor || undefined,
                limit: docLimit ? Number(docLimit) : undefined,
                type: docType || undefined,
              })
            )
          }
          className="px-4 py-2 rounded-md border border-border text-sm hover:bg-border/30"
        >
          List documents
        </button>

        <div className="flex gap-2">
          <input value={docId} onChange={(e) => setDocId(e.target.value)} placeholder="Document ID" className={inputClassName} />
          <button
            type="button"
            onClick={() => docId && void runRequest(getDocument(callApi, docId))}
            className="shrink-0 px-4 py-2 rounded-md border border-border text-sm hover:bg-border/30"
          >
            Get by ID
          </button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <input value={docTitle} onChange={(e) => setDocTitle(e.target.value)} placeholder="Title" className={inputClassName} />
          <select value={docBodyType} onChange={(e) => setDocBodyType(e.target.value)} className={inputClassName}>
            <option value="wiki">wiki</option>
            <option value="issue">issue</option>
            <option value="project">project</option>
            <option value="program">program</option>
            <option value="sprint">sprint</option>
          </select>
        </div>
        <button
          type="button"
          onClick={() =>
            void runRequest(createDocument(callApi, { title: docTitle, document_type: docBodyType }))
          }
          className="px-4 py-2 rounded-md border border-border text-sm hover:bg-border/30"
        >
          Create document
        </button>
      </ResourceSection>

      <ResourceSection title="Issues" description="List, fetch, or create issues." disabled={loading}>
        <div className="grid gap-3 sm:grid-cols-2">
          <input value={issueCursor} onChange={(e) => setIssueCursor(e.target.value)} placeholder="Cursor" className={inputClassName} />
          <input value={issueLimit} onChange={(e) => setIssueLimit(e.target.value)} placeholder="Limit" className={inputClassName} />
        </div>
        <button
          type="button"
          onClick={() =>
            void runRequest(
              listIssues(callApi, {
                cursor: issueCursor || undefined,
                limit: issueLimit ? Number(issueLimit) : undefined,
              })
            )
          }
          className="px-4 py-2 rounded-md border border-border text-sm hover:bg-border/30"
        >
          List issues
        </button>

        <div className="flex gap-2">
          <input value={issueId} onChange={(e) => setIssueId(e.target.value)} placeholder="Issue ID" className={inputClassName} />
          <button
            type="button"
            onClick={() => issueId && void runRequest(getIssue(callApi, issueId))}
            className="shrink-0 px-4 py-2 rounded-md border border-border text-sm hover:bg-border/30"
          >
            Get by ID
          </button>
        </div>

        <div className="flex gap-2">
          <input value={issueTitle} onChange={(e) => setIssueTitle(e.target.value)} placeholder="Title" className={inputClassName} />
          <button
            type="button"
            onClick={() => void runRequest(createIssue(callApi, { title: issueTitle }))}
            className="shrink-0 px-4 py-2 rounded-md border border-border text-sm hover:bg-border/30"
          >
            Create issue
          </button>
        </div>
      </ResourceSection>

      <ResourceSection title="Sprints" description="List, fetch, create, or start sprints." disabled={loading}>
        <div className="grid gap-3 sm:grid-cols-2">
          <input value={sprintCursor} onChange={(e) => setSprintCursor(e.target.value)} placeholder="Cursor" className={inputClassName} />
          <input value={sprintLimit} onChange={(e) => setSprintLimit(e.target.value)} placeholder="Limit" className={inputClassName} />
        </div>
        <button
          type="button"
          onClick={() =>
            void runRequest(
              listSprints(callApi, {
                cursor: sprintCursor || undefined,
                limit: sprintLimit ? Number(sprintLimit) : undefined,
              })
            )
          }
          className="px-4 py-2 rounded-md border border-border text-sm hover:bg-border/30"
        >
          List sprints
        </button>

        <div className="flex gap-2">
          <input value={sprintId} onChange={(e) => setSprintId(e.target.value)} placeholder="Sprint ID" className={inputClassName} />
          <button
            type="button"
            onClick={() => sprintId && void runRequest(getSprint(callApi, sprintId))}
            className="shrink-0 px-4 py-2 rounded-md border border-border text-sm hover:bg-border/30"
          >
            Get by ID
          </button>
          <button
            type="button"
            onClick={() => sprintId && void runRequest(startSprint(callApi, sprintId))}
            className="shrink-0 px-4 py-2 rounded-md border border-border text-sm hover:bg-border/30"
          >
            Start sprint
          </button>
        </div>

        <div className="flex gap-2">
          <input value={sprintTitle} onChange={(e) => setSprintTitle(e.target.value)} placeholder="Title" className={inputClassName} />
          <button
            type="button"
            onClick={() => void runRequest(createSprint(callApi, { title: sprintTitle }))}
            className="shrink-0 px-4 py-2 rounded-md border border-border text-sm hover:bg-border/30"
          >
            Create sprint
          </button>
        </div>
      </ResourceSection>

      <ApiResponsePanel result={result} loading={loading} />
    </div>
  );
}
