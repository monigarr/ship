import { Request, Response, Router } from 'express';
import { pool } from '../../../db/client.js';
import { sendPublicError } from '../../http.js';
import { oauthBearerMiddleware, requireScope } from '../../oauth.js';
import { SCOPES } from '../../scopes.js';
import { registerPublicRoute } from '../../spec/route-metadata.js';

const router = Router();

registerPublicRoute({
  method: 'get',
  path: '/audit',
  summary: 'List public API audit log entries for the current app',
  operationId: 'listPlatformAuditLog',
  scopes: [SCOPES.WEBHOOKS_MANAGE],
  tags: ['Audit'],
  responseSchemaName: 'PlatformAuditListResponse',
  paginatedList: true,
});

router.get(
  '/',
  oauthBearerMiddleware,
  requireScope(SCOPES.WEBHOOKS_MANAGE),
  async (req: Request, res: Response) => {
    if (!req.oauth) {
      sendPublicError(req, res, 401, 'unauthorized', 'Missing OAuth context');
      return;
    }

    const { rows } = await pool.query(
      `SELECT id, client_id, user_id, method, route, scope_used, status_code, latency_ms, request_id, created_at
       FROM platform_audit_log
       WHERE app_id = $1
       ORDER BY created_at DESC
       LIMIT 100`,
      [req.oauth.appId]
    );

    res.json({ data: rows, next_cursor: null });
  }
);

export const auditV1Router = router;
