export interface ReflectedTarget {
  id: string;
  title: string;
  path: string;
  queryParam: string;
  requiresAuth?: boolean;
}

export interface StoredTarget {
  id: string;
  title: string;
  createPath: string;
  listPath: string;
  fieldName: string;
  basePayload: Record<string, unknown>;
}

// Broad coverage across user-facing read surfaces used in the app UI.
export const REFLECTED_INPUT_TARGETS: ReflectedTarget[] = [
  {
    id: "search-query",
    title: "Search query parameter",
    path: "/api/search",
    queryParam: "query",
  },
  {
    id: "issues-state-filter",
    title: "Issues state filter parameter",
    path: "/api/issues",
    queryParam: "state",
    requiresAuth: true,
  },
  {
    id: "issues-priority-filter",
    title: "Issues priority filter parameter",
    path: "/api/issues",
    queryParam: "priority",
    requiresAuth: true,
  },
  {
    id: "documents-type-filter",
    title: "Documents type filter parameter",
    path: "/api/documents",
    queryParam: "type",
    requiresAuth: true,
  },
  {
    id: "team-grid-range-filter",
    title: "Team grid date-range parameter",
    path: "/api/team/grid",
    queryParam: "start_date",
    requiresAuth: true,
  },
];

// Writable fields that are user-editable in core flows.
export const STORED_INPUT_TARGETS: StoredTarget[] = [
  {
    id: "issue-title",
    title: "Issue title field",
    createPath: "/api/issues",
    listPath: "/api/issues",
    fieldName: "title",
    basePayload: {
      priority: "medium",
      state: "backlog",
    },
  },
  {
    id: "document-title",
    title: "Document title field",
    createPath: "/api/documents",
    listPath: "/api/documents",
    fieldName: "title",
    basePayload: {
      document_type: "wiki",
      content: null,
    },
  },
];
