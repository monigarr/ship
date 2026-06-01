import { randomUUID } from 'crypto';
import { NextFunction, Request, Response } from 'express';

export interface PublicApiErrorShape {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  request_id: string;
}

export class PublicApiError extends Error {
  status: number;
  code: string;
  details?: Record<string, unknown>;

  constructor(status: number, code: string, message: string, details?: Record<string, unknown>) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function getRequestId(req: Request): string {
  return req.publicRequestId ?? randomUUID();
}

export function publicRequestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  req.publicRequestId = randomUUID();
  res.setHeader('x-request-id', req.publicRequestId);
  next();
}

export function sendPublicError(
  req: Request,
  res: Response,
  status: number,
  code: string,
  message: string,
  details?: Record<string, unknown>
): void {
  const payload: PublicApiErrorShape = {
    code,
    message,
    request_id: getRequestId(req),
  };

  if (details) {
    payload.details = details;
  }

  res.status(status).json(payload);
}

declare global {
  namespace Express {
    interface Request {
      publicRequestId?: string;
    }
  }
}
