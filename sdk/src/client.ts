import {
  CreateShipDocumentInput,
  ShipDocument,
  ShipDocumentListResponse,
  ShipMeResponse,
  ShipSdkOptions,
} from './types.js';

async function parseJsonOrThrow<T>(response: Response): Promise<T> {
  const body = (await response.json()) as T | { code?: string; message?: string; request_id?: string };
  if (!response.ok) {
    const errorPayload = body as { code?: string; message?: string; request_id?: string };
    throw new Error(
      `Ship API error ${response.status}: ${errorPayload.code ?? 'unknown'} - ${errorPayload.message ?? 'No message'} (${errorPayload.request_id ?? 'no-request-id'})`
    );
  }
  return body as T;
}

export class ShipClient {
  private readonly baseUrl: string;
  private readonly token: string;
  private readonly fetchFn: typeof fetch;

  readonly documents: {
    list: (params?: { cursor?: string; limit?: number; type?: string }) => Promise<ShipDocumentListResponse>;
    getById: (id: string) => Promise<ShipDocument>;
    create: (input: CreateShipDocumentInput) => Promise<ShipDocument>;
  };

  readonly issues: Record<string, never>;
  readonly sprints: Record<string, never>;
  readonly webhooks: Record<string, never>;

  constructor(options: ShipSdkOptions) {
    this.baseUrl = options.baseUrl ?? 'http://localhost:3001';
    this.token = options.token;
    this.fetchFn = options.fetchFn ?? fetch;

    this.documents = {
      list: (params) => this.listDocuments(params),
      getById: (id) => this.getDocumentById(id),
      create: (input) => this.createDocument(input),
    };

    // Skeleton clients (must exist for workspace structure / future expansion)
    this.issues = {};
    this.sprints = {};
    this.webhooks = {};
  }

  async me(): Promise<ShipMeResponse> {
    const response = await this.fetchFn(`${this.baseUrl}/api/v1/me`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${this.token}`,
      },
    });

    return parseJsonOrThrow<ShipMeResponse>(response);
  }

  private async listDocuments(params?: {
    cursor?: string;
    limit?: number;
    type?: string;
  }): Promise<ShipDocumentListResponse> {
    const url = new URL(`${this.baseUrl}/api/v1/documents`);
    if (params?.cursor) url.searchParams.set('cursor', params.cursor);
    if (params?.limit) url.searchParams.set('limit', String(params.limit));
    if (params?.type) url.searchParams.set('type', params.type);

    const response = await this.fetchFn(url.toString(), {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${this.token}`,
      },
    });

    return parseJsonOrThrow<ShipDocumentListResponse>(response);
  }

  private async getDocumentById(id: string): Promise<ShipDocument> {
    const response = await this.fetchFn(`${this.baseUrl}/api/v1/documents/${id}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${this.token}`,
      },
    });

    return parseJsonOrThrow<ShipDocument>(response);
  }

  private async createDocument(input: CreateShipDocumentInput): Promise<ShipDocument> {
    const response = await this.fetchFn(`${this.baseUrl}/api/v1/documents`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(input),
    });

    return parseJsonOrThrow<ShipDocument>(response);
  }
}
