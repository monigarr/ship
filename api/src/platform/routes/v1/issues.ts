import { Request, Response, Router } from 'express';
import { z } from 'zod';
import { pool } from '../../../db/client.js';
import { sendPublicError } from '../../http.js';
import { oauthBearerMiddleware, requireScope } from '../../oauth.js';
import { SCOPES } from '../../scopes.js';
import { registerPublicRoute } from '../../spec/route-metadata.js';
import { publishIssueCreated } from '../../events/publish.js';
import { decodeCursor, encodeCursor } from './cursor.js';

const router = Router();

const createIssueSchema = z.object({
  title: z.string().min(1).max(255),
  properties: z.record(z.string(), z.unknown()).optional(),
});

registerPublicRoute({
  method: 'get',
  path: '/issues',
  summary: 'List issues with cursor pagination',
  operationId: 'listIssues',
  scopes: [SCOPES.ISSUES_READ],
  tags: ['Issues'],
  responseSchemaName: 'IssueListResponse',
  paginatedList: true,
});

registerPublicRoute({
  method: 'get',
  path: '/issues/{id}',
  summary: 'Get an issue by id',
  operationId: 'getIssueById',
  scopes: [SCOPES.ISSUES_READ],
  tags: ['Issues'],
  responseSchemaName: 'Issue',
});

registerPublicRoute({
  method: 'post',
  path: '/issues',
  summary: 'Create an issue',
  operationId: 'createIssue',
  scopes: [SCOPES.ISSUES_WRITE],
  tags: ['Issues'],
  requestBodySchemaName: 'CreateIssueRequest',
  responseSchemaName: 'Issue',
});

router.get(
  '/',
  oauthBearerMiddleware,
  requireScope(SCOPES.ISSUES_READ),
  async (req: Request, res: Response) => {
    if (!req.oauth) {
      sendPublicError(req, res, 401, 'unauthorized', 'Missing OAuth context');
      return;
    }

    const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : undefined;
    const limitRaw = typeof req.query.limit === 'string' ? Number.parseInt(req.query.limit, 10) : 25;
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 100) : 25;

    const params: Array<string | number> = [req.oauth.workspaceId];
    let where = `WHERE workspace_id = $1 AND document_type = 'issue' AND archived_at IS NULL AND deleted_at IS NULL`;

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
  requireScope(SCOPES.ISSUES_READ),
  async (req: Request, res: Response) => {
    if (!req.oauth) {
      sendPublicError(req, res, 401, 'unauthorized', 'Missing OAuth context');
      return;
    }

    const { rows } = await pool.query(
      `SELECT id, workspace_id, document_type, title, content, properties, created_by, created_at, updated_at
       FROM documents
       WHERE id = $1 AND workspace_id = $2 AND document_type = 'issue' AND deleted_at IS NULL`,
      [req.params.id, req.oauth.workspaceId]
    );

    if (!rows[0]) {
      sendPublicError(req, res, 404, 'not_found', 'Issue not found');
      return;
    }

    res.json(rows[0]);
  }
);

router.post(
  '/',
  oauthBearerMiddleware,
  requireScope(SCOPES.ISSUES_WRITE),
  async (req: Request, res: Response) => {
    if (!req.oauth) {
      sendPublicError(req, res, 401, 'unauthorized', 'Missing OAuth context');
      return;
    }

    const parsed = createIssueSchema.safeParse(req.body);
    if (!parsed.success) {
      sendPublicError(req, res, 400, 'validation_failed', 'Invalid request body', {
        issues: parsed.error.issues,
      });
      return;
    }

    const properties = { state: 'open', ...(parsed.data.properties ?? {}) };

    const { rows } = await pool.query(
      `INSERT INTO documents (workspace_id, document_type, title, properties, created_by)
       VALUES ($1, 'issue', $2, $3, $4)
       RETURNING id, workspace_id, document_type, title, properties, created_by, created_at, updated_at`,
      [req.oauth.workspaceId, parsed.data.title, JSON.stringify(properties), req.oauth.userId]
    );

    const issue = rows[0];
    await publishIssueCreated({
      id: issue.id as string,
      workspace_id: issue.workspace_id as string,
      title: issue.title as string,
      created_at: (issue.created_at as Date).toISOString?.() ?? String(issue.created_at),
    });

    res.status(201).json(issue);
  }
);

export const issuesV1Router = router;
