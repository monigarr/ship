import { Router } from 'express';
import { openApiV1Router } from './v1/openapi.js';
import { meV1Router } from './v1/me.js';
import { documentsV1Router } from './v1/documents.js';
import { issuesV1Router } from './v1/issues.js';
import { sprintsV1Router } from './v1/sprints.js';
import { webhooksV1Router } from './v1/webhooks.js';
import { auditV1Router } from './v1/audit.js';

export const publicV1Router = Router();

publicV1Router.use('/openapi.json', openApiV1Router);
publicV1Router.use('/me', meV1Router);
publicV1Router.use('/documents', documentsV1Router);
publicV1Router.use('/issues', issuesV1Router);
publicV1Router.use('/sprints', sprintsV1Router);
publicV1Router.use('/webhooks', webhooksV1Router);
publicV1Router.use('/audit', auditV1Router);
