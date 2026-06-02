import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { getPublicRouteMetadata } from './spec/route-metadata.js';

describe('public API fitness tests', () => {
  const app = createApp();

  it('ensures every registered route has an OpenAPI path/method entry', async () => {
    const specRes = await request(app).get('/api/v1/openapi.json');
    expect(specRes.status).toBe(200);
    const spec = specRes.body as { paths?: Record<string, Record<string, unknown>> };
    const metadata = getPublicRouteMetadata();

    for (const route of metadata) {
      const operation = spec.paths?.[route.path]?.[route.method];
      expect(operation, `${route.method.toUpperCase()} ${route.path} missing from OpenAPI`).toBeDefined();
    }
  });

  it('requires scope declaration for all bearer-protected /api/v1 resource routes', () => {
    const metadata = getPublicRouteMetadata().filter((route) => route.path.startsWith('/documents') || route.path === '/me');
    expect(metadata.length).toBeGreaterThan(0);
    for (const route of metadata) {
      expect(route.scopes, `${route.method.toUpperCase()} ${route.path} missing scope declaration`).toBeDefined();
    }
  });

  it('returns ApiError shape on protected route failures', async () => {
    const response = await request(app).get('/api/v1/me');
    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({
      code: expect.any(String),
      message: expect.any(String),
      request_id: expect.any(String),
    });
  });
});
