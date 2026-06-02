const scopeSet = new Set<string>();

export function registerScope(scope: string): void {
  scopeSet.add(scope);
}

export function hasRegisteredScope(scope: string): boolean {
  return scopeSet.has(scope);
}

export function listRegisteredScopes(): string[] {
  return Array.from(scopeSet).sort();
}

export const SCOPES = {
  DOCUMENTS_READ: 'documents:read',
  DOCUMENTS_WRITE: 'documents:write',
  ISSUES_READ: 'issues:read',
  ISSUES_WRITE: 'issues:write',
  SPRINTS_READ: 'sprints:read',
  SPRINTS_WRITE: 'sprints:write',
  WEBHOOKS_MANAGE: 'webhooks:manage',
} as const;

registerScope(SCOPES.DOCUMENTS_READ);
registerScope(SCOPES.DOCUMENTS_WRITE);
registerScope(SCOPES.ISSUES_READ);
registerScope(SCOPES.ISSUES_WRITE);
registerScope(SCOPES.SPRINTS_READ);
registerScope(SCOPES.SPRINTS_WRITE);
registerScope(SCOPES.WEBHOOKS_MANAGE);
