export interface PublicRouteMetadata {
  method: 'get' | 'post' | 'put' | 'patch' | 'delete';
  path: string;
  summary: string;
  operationId: string;
  scopes?: string[];
  tags?: string[];
  requestBodySchemaName?: string;
  responseSchemaName?: string;
  paginatedList?: boolean;
}

const metadata: PublicRouteMetadata[] = [];

export function registerPublicRoute(meta: PublicRouteMetadata): void {
  metadata.push(meta);
}

export function getPublicRouteMetadata(): PublicRouteMetadata[] {
  return [...metadata];
}
