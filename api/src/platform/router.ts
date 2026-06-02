import { NextFunction, Request, Response, Router } from 'express';
import { publicAuditMiddleware } from './audit/middleware.js';
import { wireWebhookEventBus } from './webhooks/deliverer.js';
import { publicRequestIdMiddleware, PublicApiError, sendPublicError } from './http.js';
import { oauthRouter } from './routes/oauth.js';
import { publicV1Router } from './routes/v1.js';
import { publicRateLimitMiddleware } from './ratelimit/middleware.js';

let platformWired = false;

function ensurePlatformWiring(): void {
  if (platformWired) return;
  wireWebhookEventBus();
  platformWired = true;
}

export function createPlatformRouter(): Router {
  ensurePlatformWiring();
  const router = Router();

  router.use(publicRequestIdMiddleware);
  router.use(publicRateLimitMiddleware);
  router.use(publicAuditMiddleware);

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
