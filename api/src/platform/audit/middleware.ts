import { NextFunction, Request, Response } from 'express';
import { pool } from '../../db/client.js';

export function publicAuditMiddleware(req: Request, res: Response, next: NextFunction): void {
  const started = Date.now();

  res.on('finish', () => {
    if (!req.oauth) return;
    const latencyMs = Date.now() - started;
    const scopeUsed = (req as Request & { requiredScope?: string }).requiredScope ?? null;

    void pool.query(
      `INSERT INTO platform_audit_log
        (app_id, client_id, user_id, method, route, scope_used, status_code, latency_ms, request_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        req.oauth.appId,
        req.oauth.clientId,
        req.oauth.userId,
        req.method,
        req.originalUrl ?? req.path,
        scopeUsed,
        res.statusCode,
        latencyMs,
        req.publicRequestId ?? null,
      ]
    );
  });

  next();
}
