import { Request, Response, Router } from 'express';
import { pool } from '../../../db/client.js';
import { oauthBearerMiddleware } from '../../oauth.js';
import { sendPublicError } from '../../http.js';
import { registerPublicRoute } from '../../spec/route-metadata.js';

const router = Router();

registerPublicRoute({
  method: 'get',
  path: '/me',
  summary: 'Get authenticated user profile',
  operationId: 'getAuthenticatedUser',
  scopes: [],
  tags: ['Auth'],
  responseSchemaName: 'PublicMeResponse',
});

router.get('/', oauthBearerMiddleware, async (req: Request, res: Response) => {
  if (!req.oauth) {
    sendPublicError(req, res, 401, 'unauthorized', 'Missing OAuth context');
    return;
  }

  const { rows } = await pool.query(
    `SELECT id, email, name, is_super_admin, created_at, updated_at
     FROM users
     WHERE id = $1`,
    [req.oauth.userId]
  );

  const user = rows[0];
  if (!user) {
    sendPublicError(req, res, 404, 'not_found', 'Authenticated user no longer exists');
    return;
  }

  res.json({
    id: user.id,
    email: user.email,
    name: user.name,
    is_super_admin: user.is_super_admin,
    workspace_id: req.oauth.workspaceId,
    client_id: req.oauth.clientId,
    scopes: req.oauth.scopes,
    created_at: user.created_at,
    updated_at: user.updated_at,
  });
});

export const meV1Router = router;
