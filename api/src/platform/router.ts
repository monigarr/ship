import { NextFunction, Request, Response, Router } from 'express';
import { publicRequestIdMiddleware, PublicApiError, sendPublicError } from './http.js';
import { oauthRouter } from './routes/oauth.js';
import { publicV1Router } from './routes/v1.js';

export function createPlatformRouter(): Router {
  const router = Router();

  router.use(publicRequestIdMiddleware);

  router.use('/oauth', oauthRouter);
  router.use('/', publicV1Router);

  router.use((req: Request, res: Response) => {
    sendPublicError(req, res, 404, 'not_found', `No public API route for ${req.method} ${req.path}`);
  });

  router.use((err: unknown, req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof PublicApiError) {
      sendPublicError(req, res, err.status, err.code, err.message, err.details);
      return;
    }

    sendPublicError(req, res, 500, 'server_error', 'Internal server error');
  });

  return router;
}
