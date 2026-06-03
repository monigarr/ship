import { deviceLogin, authorizationCodeFlow, type ITokenStore } from './auth.js';
import { mapStatusToKind, ShipSdkError } from './errors.js';
import {
  CreateShipDocumentInput,
  CreateShipIssueInput,
  CreateShipSprintInput,
  ShipDocument,
  ShipDocumentListResponse,
  ShipIssue,
  ShipIssueListResponse,
  ShipMeResponse,
  ShipSdkOptions,
  ShipSprint,
  ShipSprintListResponse,
} from './types.js';

async function parseJsonOrThrow<T>(response: Response): Promise<T> {
  const body = (await response.json()) as T | {
    code?: string;
    message?: string;
    request_id?: string;
    details?: Record<string, unknown>;
  };
  if (!response.ok) {
    const errorPayload = body as {
      code?: string;
      message?: string;
      request_id?: string;
      details?: Record<string, unknown>;
    };
    throw new ShipSdkError({
      kind: mapStatusToKind(response.status, errorPayload.code),
      status: response.status,
      code: errorPayload.code ?? 'unknown',
      message: errorPayload.message ?? 'No message',
      requestId: errorPayload.request_id,
      details: errorPayload.details,
    });
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
    iterate: () => AsyncGenerator<ShipDocument, void, unknown>;
  };

  readonly issues: {
    list: (params?: { cursor?: string; limit?: number }) => Promise<ShipIssueListResponse>;
    getById: (id: string) => Promise<ShipIssue>;
    create: (input: CreateShipIssueInput) => Promise<ShipIssue>;
    iterate: () => AsyncGenerator<ShipIssue, void, unknown>;
  };

  readonly sprints: {
    list: (params?: { cursor?: string; limit?: number }) => Promise<ShipSprintListResponse>;
    getById: (id: string) => Promise<ShipSprint>;
    create: (input: CreateShipSprintInput) => Promise<ShipSprint>;
    start: (id: string) => Promise<ShipSprint>;
    iterate: () => AsyncGenerator<ShipSprint, void, unknown>;
  };

  readonly webhooks: {
    create: (input: { event: string; target_url: string }) => Promise<{
      id: string;
      event: string;
      target_url: string;
      signing_secret: string;
    }>;
    list: () => Promise<{ data: unknown[] }>;
    listDeliveries: () => Promise<{ data: unknown[] }>;
    replay: (deliveryId: string) => Promise<{ replayed: boolean; delivery_id: string }>;
  };

  constructor(options: ShipSdkOptions) {
    this.baseUrl = options.baseUrl ?? 'http://localhost:3001';
    this.token = options.token;
    this.fetchFn = options.fetchFn ?? fetch;

    this.documents = {
      list: (params) => this.listDocuments(params),
      getById: (id) => this.getDocumentById(id),
      create: (input) => this.createDocument(input),
      iterate: () => this.iterateDocuments(),
    };

    this.issues = {
      list: (params) => this.listIssues(params),
      getById: (id) => this.getIssueById(id),
      create: (input) => this.createIssue(input),
      iterate: () => this.iterateIssues(),
    };

    this.sprints = {
      list: (params) => this.listSprints(params),
      getById: (id) => this.getSprintById(id),
      create: (input) => this.createSprint(input),
      start: (id) => this.startSprint(id),
      iterate: () => this.iterateSprints(),
    };

    this.webhooks = {
      create: (input) => this.createWebhook(input),
      list: () => this.listWebhooks(),
      listDeliveries: () => this.listWebhookDeliveries(),
      replay: (id) => this.replayWebhook(id),
    };
  }

  static deviceLogin = deviceLogin;
  static authorizationCodeFlow = authorizationCodeFlow;

  async me(): Promise<ShipMeResponse> {
    const response = await this.fetchFn(`${this.baseUrl}/api/v1/me`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${this.token}` },
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
      headers: { Authorization: `Bearer ${this.token}` },
    });
    return parseJsonOrThrow<ShipDocumentListResponse>(response);
  }

  private async *iterateDocuments(): AsyncGenerator<ShipDocument, void, unknown> {
    let cursor: string | undefined;
    do {
      const page = await this.listDocuments({ cursor, limit: 25 });
      for (const doc of page.data) {
        yield doc;
      }
      cursor = page.next_cursor ?? undefined;
    } while (cursor);
  }

  private async getDocumentById(id: string): Promise<ShipDocument> {
    const response = await this.fetchFn(`${this.baseUrl}/api/v1/documents/${id}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${this.token}` },
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

  private async createWebhook(input: { event: string; target_url: string }) {
    const response = await this.fetchFn(`${this.baseUrl}/api/v1/webhooks`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ event: input.event, target_url: input.target_url }),
    });
    return parseJsonOrThrow<{
      id: string;
      event: string;
      target_url: string;
      signing_secret: string;
    }>(response);
  }

  private async listWebhooks() {
    const response = await this.fetchFn(`${this.baseUrl}/api/v1/webhooks`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${this.token}` },
    });
    return parseJsonOrThrow<{ data: unknown[] }>(response);
  }

  private async listWebhookDeliveries() {
    const response = await this.fetchFn(`${this.baseUrl}/api/v1/webhooks/deliveries`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${this.token}` },
    });
    return parseJsonOrThrow<{ data: unknown[] }>(response);
  }

  private async replayWebhook(deliveryId: string) {
    const response = await this.fetchFn(`${this.baseUrl}/api/v1/webhooks/deliveries/${deliveryId}/replay`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.token}` },
    });
    return parseJsonOrThrow<{ replayed: boolean; delivery_id: string }>(response);
  }

  private async listIssues(params?: { cursor?: string; limit?: number }): Promise<ShipIssueListResponse> {
    const url = new URL(`${this.baseUrl}/api/v1/issues`);
    if (params?.cursor) url.searchParams.set('cursor', params.cursor);
    if (params?.limit) url.searchParams.set('limit', String(params.limit));
    const response = await this.fetchFn(url.toString(), {
      method: 'GET',
      headers: { Authorization: `Bearer ${this.token}` },
    });
    return parseJsonOrThrow<ShipIssueListResponse>(response);
  }

  private async *iterateIssues(): AsyncGenerator<ShipIssue, void, unknown> {
    let cursor: string | undefined;
    do {
      const page = await this.listIssues({ cursor, limit: 25 });
      for (const row of page.data) yield row;
      cursor = page.next_cursor ?? undefined;
    } while (cursor);
  }

  private async getIssueById(id: string): Promise<ShipIssue> {
    const response = await this.fetchFn(`${this.baseUrl}/api/v1/issues/${id}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${this.token}` },
    });
    return parseJsonOrThrow<ShipIssue>(response);
  }

  private async createIssue(input: CreateShipIssueInput): Promise<ShipIssue> {
    const response = await this.fetchFn(`${this.baseUrl}/api/v1/issues`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(input),
    });
    return parseJsonOrThrow<ShipIssue>(response);
  }

  private async listSprints(params?: { cursor?: string; limit?: number }): Promise<ShipSprintListResponse> {
    const url = new URL(`${this.baseUrl}/api/v1/sprints`);
    if (params?.cursor) url.searchParams.set('cursor', params.cursor);
    if (params?.limit) url.searchParams.set('limit', String(params.limit));
    const response = await this.fetchFn(url.toString(), {
      method: 'GET',
      headers: { Authorization: `Bearer ${this.token}` },
    });
    return parseJsonOrThrow<ShipSprintListResponse>(response);
  }

  private async *iterateSprints(): AsyncGenerator<ShipSprint, void, unknown> {
    let cursor: string | undefined;
    do {
      const page = await this.listSprints({ cursor, limit: 25 });
      for (const row of page.data) yield row;
      cursor = page.next_cursor ?? undefined;
    } while (cursor);
  }

  private async getSprintById(id: string): Promise<ShipSprint> {
    const response = await this.fetchFn(`${this.baseUrl}/api/v1/sprints/${id}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${this.token}` },
    });
    return parseJsonOrThrow<ShipSprint>(response);
  }

  private async createSprint(input: CreateShipSprintInput): Promise<ShipSprint> {
    const response = await this.fetchFn(`${this.baseUrl}/api/v1/sprints`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(input),
    });
    return parseJsonOrThrow<ShipSprint>(response);
  }

  private async startSprint(id: string): Promise<ShipSprint> {
    const response = await this.fetchFn(`${this.baseUrl}/api/v1/sprints/${id}/start`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.token}` },
    });
    return parseJsonOrThrow<ShipSprint>(response);
  }
}

export type { ITokenStore };
