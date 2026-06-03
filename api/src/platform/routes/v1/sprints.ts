import { Request, Response, Router } from 'express';
import { z } from 'zod';
import { pool } from '../../../db/client.js';
import { sendPublicError } from '../../http.js';
import { oauthBearerMiddleware, requireScope } from '../../oauth.js';
import { SCOPES } from '../../scopes.js';
import { registerPublicRoute } from '../../spec/route-metadata.js';
import { publishSprintStarted } from '../../events/publish.js';
import { decodeCursor, encodeCursor } from './cursor.js';

const router = Router();

const createSprintSchema = z.object({
  title: z.string().min(1).max(255),
  properties: z.record(z.string(), z.unknown()).optional(),
});

registerPublicRoute({
  method: 'get',
  path: '/sprints',
  summary: 'List sprints with cursor pagination',
  operationId: 'listSprints',
  scopes: [SCOPES.SPRINTS_READ],
  tags: ['Sprints'],
  responseSchemaName: 'SprintListResponse',
  paginatedList: true,
});

registerPublicRoute({
  method: 'get',
  path: '/sprints/{id}',
  summary: 'Get a sprint by id',
  operationId: 'getSprintById',
  scopes: [SCOPES.SPRINTS_READ],
  tags: ['Sprints'],
  responseSchemaName: 'Sprint',
});

registerPublicRoute({
  method: 'post',
  path: '/sprints',
  summary: 'Create a sprint',
  operationId: 'createSprint',
  scopes: [SCOPES.SPRINTS_WRITE],
  tags: ['Sprints'],
  requestBodySchemaName: 'CreateSprintRequest',
  responseSchemaName: 'Sprint',
});

registerPublicRoute({
  method: 'post',
  path: '/sprints/{id}/start',
  summary: 'Start a sprint',
  operationId: 'startSprint',
  scopes: [SCOPES.SPRINTS_WRITE],
  tags: ['Sprints'],
  responseSchemaName: 'Sprint',
});

router.get(
  '/',
  oauthBearerMiddleware,
  requireScope(SCOPES.SPRINTS_READ),
  async (req: Request, res: Response) => {
    if (!req.oauth) {
      sendPublicError(req, res, 401, 'unauthorized', 'Missing OAuth context');
      return;
    }

    const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : undefined;
    const limitRaw = typeof req.query.limit === 'string' ? Number.parseInt(req.query.limit, 10) : 25;
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 100) : 25;

    const params: Array<string | number> = [req.oauth.workspaceId];
    let where = `WHERE workspace_id = $1 AND document_type = 'sprint' AND archived_at IS NULL AND deleted_at IS NULL`;

    if (cursor) {
      try {
        const decoded = decodeCursor(cursor);
        params.push(decoded.created_at);
        params.push(decoded.id);
        where += ` AND (created_at, id) < ($${params.length - 1}::timestamptz, $${params.length}::uuid)`;
      } catch {
        sendPublicError(req, res, 400, 'validation_failed', 'Invalid cursor');
        return;
      }
    }

    params.push(limit + 1);
    const { rows } = await pool.query(
      `SELECT id, workspace_id, document_type, title, properties, created_at, updated_at, created_by
       FROM documents
       ${where}
       ORDER BY created_at DESC, id DESC
       LIMIT $${params.length}`,
      params
    );

    const hasNext = rows.length > limit;
    const data = hasNext ? rows.slice(0, limit) : rows;
    const last = hasNext ? data[data.length - 1] : null;

    res.json({
      data,
      next_cursor: last
        ? encodeCursor({ id: last.id as string, created_at: last.created_at as string })
        : null,
    });
  }
);

router.get(
  '/:id',
  oauthBearerMiddleware,
  requireScope(SCOPES.SPRINTS_READ),
  async (req: Request, res: Response) => {
    if (!req.oauth) {
      sendPublicError(req, res, 401, 'unauthorized', 'Missing OAuth context');
      return;
    }

    const { rows } = await pool.query(
      `SELECT id, workspace_id, document_type, title, content, properties, created_by, created_at, updated_at
       FROM documents
       WHERE id = $1 AND workspace_id = $2 AND document_type = 'sprint' AND deleted_at IS NULL`,
      [req.params.id, req.oauth.workspaceId]
    );

    if (!rows[0]) {
      sendPublicError(req, res, 404, 'not_found', 'Sprint not found');
      return;
    }

    res.json(rows[0]);
  }
);

router.post(
  '/',
  oauthBearerMiddleware,
  requireScope(SCOPES.SPRINTS_WRITE),
  async (req: Request, res: Response) => {
    if (!req.oauth) {
      sendPublicError(req, res, 401, 'unauthorized', 'Missing OAuth context');
      return;
    }

    const parsed = createSprintSchema.safeParse(req.body);
    if (!parsed.success) {
      sendPublicError(req, res, 400, 'validation_failed', 'Invalid request body', {
        issues: parsed.error.issues,
      });
      return;
    }

    const properties = { state: 'planning', ...(parsed.data.properties ?? {}) };

    const { rows } = await pool.query(
      `INSERT INTO documents (workspace_id, document_type, title, properties, created_by)
       VALUES ($1, 'sprint', $2, $3, $4)
       RETURNING id, workspace_id, document_type, title, properties, created_by, created_at, updated_at`,
      [req.oauth.workspaceId, parsed.data.title, JSON.stringify(properties), req.oauth.userId]
    );

    res.status(201).json(rows[0]);
  }
);

router.post(
  '/:id/start',
  oauthBearerMiddleware,
  requireScope(SCOPES.SPRINTS_WRITE),
  async (req: Request, res: Response) => {
    if (!req.oauth) {
      sendPublicError(req, res, 401, 'unauthorized', 'Missing OAuth context');
      return;
    }

    const { rows } = await pool.query(
      `UPDATE documents
       SET properties = COALESCE(properties, '{}'::jsonb) || '{"state":"active"}'::jsonb,
           updated_at = NOW()
       WHERE id = $1 AND workspace_id = $2 AND document_type = 'sprint' AND deleted_at IS NULL
       RETURNING id, workspace_id, document_type, title, properties, created_by, created_at, updated_at`,
      [req.params.id, req.oauth.workspaceId]
    );

    if (!rows[0]) {
      sendPublicError(req, res, 404, 'not_found', 'Sprint not found');
      return;
    }

    const sprint = rows[0];
    await publishSprintStarted({
      id: sprint.id as string,
      workspace_id: sprint.workspace_id as string,
      title: sprint.title as string,
      started_at: new Date().toISOString(),
    });

    res.json(sprint);
  }
);

export const sprintsV1Router = router;
