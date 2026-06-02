import { Router } from 'express';
import { openApiV1Router } from './v1/openapi.js';
import { meV1Router } from './v1/me.js';
import { documentsV1Router } from './v1/documents.js';

export const publicV1Router = Router();

publicV1Router.use('/openapi.json', openApiV1Router);
publicV1Router.use('/me', meV1Router);
publicV1Router.use('/documents', documentsV1Router);
