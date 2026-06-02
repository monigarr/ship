export type ShipSdkErrorKind =
  | 'auth'
  | 'rate_limit'
  | 'not_found'
  | 'validation'
  | 'server'
  | 'unknown';

export class ShipSdkError extends Error {
  readonly kind: ShipSdkErrorKind;
  readonly status: number;
  readonly code: string;
  readonly requestId?: string;
  readonly details?: Record<string, unknown>;

  constructor(input: {
    kind: ShipSdkErrorKind;
    status: number;
    code: string;
    message: string;
    requestId?: string;
    details?: Record<string, unknown>;
  }) {
    super(input.message);
    this.name = 'ShipSdkError';
    this.kind = input.kind;
    this.status = input.status;
    this.code = input.code;
    this.requestId = input.requestId;
    this.details = input.details;
  }
}

export function mapStatusToKind(status: number, code?: string): ShipSdkErrorKind {
  if (status === 401 || status === 403 || code === 'token_expired') return 'auth';
  if (status === 429 || code === 'rate_limited') return 'rate_limit';
  if (status === 404) return 'not_found';
  if (status === 400 || code === 'validation_failed') return 'validation';
  if (status >= 500) return 'server';
  return 'unknown';
}
