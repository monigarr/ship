import { Request, Response, Router } from 'express';
import { z } from 'zod';
import { pool } from '../../../db/client.js';
import { sendPublicError } from '../../http.js';
import { oauthBearerMiddleware, requireScope } from '../../oauth.js';
import { SCOPES } from '../../scopes.js';
import { registerPublicRoute } from '../../spec/route-metadata.js';

const router = Router();

const createDocumentSchema = z.object({
  title: z.string().min(1).max(255),
  document_type: z.enum(['wiki', 'issue', 'program', 'project', 'sprint', 'person', 'weekly_plan', 'weekly_retro']).default('wiki'),
  properties: z.record(z.string(), z.unknown()).optional(),
  content: z.any().optional(),
});

interface CursorPayload {
  id: string;
  created_at: string;
}

registerPublicRoute({
  method: 'get',
  path: '/documents',
  summary: 'List documents with cursor pagination',
  operationId: 'listDocuments',
  scopes: [SCOPES.DOCUMENTS_READ],
  tags: ['Documents'],
  responseSchemaName: 'DocumentListResponse',
  paginatedList: true,
});

registerPublicRoute({
  method: 'get',
  path: '/documents/{id}',
  summary: 'Get a document by id',
  operationId: 'getDocumentById',
  scopes: [SCOPES.DOCUMENTS_READ],
  tags: ['Documents'],
  responseSchemaName: 'Document',
});

registerPublicRoute({
  method: 'post',
  path: '/documents',
  summary: 'Create a document',
  operationId: 'createDocument',
  scopes: [SCOPES.DOCUMENTS_WRITE],
  tags: ['Documents'],
  requestBodySchemaName: 'CreateDocumentRequest',
  responseSchemaName: 'Document',
});

function encodeCursor(payload: CursorPayload): string {
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
}

function decodeCursor(cursor: string): CursorPayload {
  try {
    const raw = Buffer.from(cursor, 'base64url').toString('utf8');
    const parsed = JSON.parse(raw) as CursorPayload;
    if (!parsed?.id || !parsed?.created_at) {
      throw new Error('Invalid cursor payload');
    }
    return parsed;
  } catch (error) {
    throw new Error('Invalid cursor');
  }
}

router.get(
  '/',
  oauthBearerMiddleware,
  requireScope(SCOPES.DOCUMENTS_READ),
  async (req: Request, res: Response) => {
    if (!req.oauth) {
      sendPublicError(req, res, 401, 'unauthorized', 'Missing OAuth context');
      return;
    }

    const type = typeof req.query.type === 'string' ? req.query.type : undefined;
    const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : undefined;
    const limitRaw = typeof req.query.limit === 'string' ? Number.parseInt(req.query.limit, 10) : 25;
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 100) : 25;

    const params: Array<string | number> = [req.oauth.workspaceId];
    let where = `WHERE workspace_id = $1 AND archived_at IS NULL AND deleted_at IS NULL`;

    if (type) {
      params.push(type);
      where += ` AND document_type = $${params.length}`;
    }

    if (cursor) {
      try {
        const decoded = decodeCursor(cursor);
        params.push(decoded.created_at);
        params.push(decoded.id);
        where += ` AND (created_at, id) < ($${params.length - 1}::timestamptz, $${params.length}::uuid)`;
      } catch (error) {
        sendPublicError(req, res, 400, 'validation_failed', 'Invalid cursor');
        return;
      }
    }

    params.push(limit + 1);
    const query = `
      SELECT id, workspace_id, document_type, title, properties, created_at, updated_at, created_by
      FROM documents
      ${where}
      ORDER BY created_at DESC, id DESC
      LIMIT $${params.length}
    `;

    const { rows } = await pool.query(query, params);
    const hasNext = rows.length > limit;
    const data = hasNext ? rows.slice(0, limit) : rows;
    const last = hasNext ? data[data.length - 1] : null;

    res.json({
      data,
      next_cursor: last
        ? encodeCursor({
          id: last.id as string,
          created_at: last.created_at as string,
        })
        : null,
    });
  }
);

router.get(
  '/:id',
  oauthBearerMiddleware,
  requireScope(SCOPES.DOCUMENTS_READ),
  async (req: Request, res: Response) => {
    if (!req.oauth) {
      sendPublicError(req, res, 401, 'unauthorized', 'Missing OAuth context');
      return;
    }

    const { rows } = await pool.query(
      `SELECT id, workspace_id, document_type, title, content, properties, parent_id, created_by, created_at, updated_at
       FROM documents
       WHERE id = $1 AND workspace_id = $2 AND deleted_at IS NULL`,
      [req.params.id, req.oauth.workspaceId]
    );

    const document = rows[0];
    if (!document) {
      sendPublicError(req, res, 404, 'not_found', 'Document not found');
      return;
    }

    res.json(document);
  }
);

router.post(
  '/',
  oauthBearerMiddleware,
  requireScope(SCOPES.DOCUMENTS_WRITE),
  async (req: Request, res: Response) => {
    if (!req.oauth) {
      sendPublicError(req, res, 401, 'unauthorized', 'Missing OAuth context');
      return;
    }

    const parsed = createDocumentSchema.safeParse(req.body);
    if (!parsed.success) {
      sendPublicError(req, res, 400, 'validation_failed', 'Invalid request body', {
        issues: parsed.error.issues,
      });
      return;
    }

    const { rows } = await pool.query(
      `INSERT INTO documents (workspace_id, document_type, title, properties, content, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, workspace_id, document_type, title, properties, content, created_by, created_at, updated_at`,
      [
        req.oauth.workspaceId,
        parsed.data.document_type,
        parsed.data.title,
        JSON.stringify(parsed.data.properties ?? {}),
        parsed.data.content ? JSON.stringify(parsed.data.content) : null,
        req.oauth.userId,
      ]
    );

    res.status(201).json(rows[0]);
  }
);

export const documentsV1Router = router;
