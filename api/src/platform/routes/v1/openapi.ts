import { Request, Response, Router } from 'express';
import { generatePublicOpenApiSpec } from '../../spec/openapi.js';
import { registerPublicRoute } from '../../spec/route-metadata.js';

const router = Router();

registerPublicRoute({
  method: 'get',
  path: '/openapi.json',
  summary: 'Get generated OpenAPI 3.1 spec',
  operationId: 'getPublicOpenApiSpec',
  tags: ['OpenAPI'],
});

router.get('/', (req: Request, res: Response) => {
  res.json(generatePublicOpenApiSpec(req));
});

export const openApiV1Router = router;
