export interface ShipSdkOptions {
  baseUrl?: string;
  token: string;
  fetchFn?: typeof fetch;
}

export interface ShipMeResponse {
  id: string;
  email: string;
  name: string;
  is_super_admin?: boolean;
  workspace_id: string;
  client_id: string;
  scopes: string[];
  created_at?: string;
  updated_at?: string;
}

export interface ShipDocument {
  id: string;
  workspace_id: string;
  document_type: string;
  title: string;
  properties?: Record<string, unknown>;
  content?: unknown;
  created_at: string;
  updated_at: string;
}

export interface ShipDocumentListResponse {
  data: ShipDocument[];
  next_cursor: string | null;
}

export interface CreateShipDocumentInput {
  title: string;
  document_type?: string;
  properties?: Record<string, unknown>;
  content?: unknown;
}
