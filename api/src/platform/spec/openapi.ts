import { Request } from 'express';
import type { OpenAPIObject } from 'openapi3-ts/oas31';
import { getPublicRouteMetadata } from './route-metadata.js';

export function generatePublicOpenApiSpec(req: Request): OpenAPIObject {
  const routeMetadata = getPublicRouteMetadata();
  const paths: OpenAPIObject['paths'] = {};

  for (const route of routeMetadata) {
    const pathItem = paths[route.path] ?? {};
    const publicOAuthPaths = [
      '/oauth/token',
      '/oauth/authorize',
      '/oauth/device/code',
      '/oauth/device/verify',
    ];
    const security = publicOAuthPaths.includes(route.path)
      ? []
      : route.path === '/oauth/apps'
        ? [{ cookieAuth: [] }]
        : [{ bearerAuth: [] }];

    const operation = {
      operationId: route.operationId,
      summary: route.summary,
      tags: route.tags ?? ['Public API'],
      security,
      parameters: route.path.includes('{id}')
        ? [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string', format: 'uuid' },
          },
        ]
        : undefined,
      requestBody: route.requestBodySchemaName
        ? {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: `#/components/schemas/${route.requestBodySchemaName}` },
            },
          },
        }
        : undefined,
      responses: {
        '200': {
          description: 'Success',
          content: route.responseSchemaName
            ? {
              'application/json': {
                schema: { $ref: `#/components/schemas/${route.responseSchemaName}` },
              },
            }
            : undefined,
        },
        '400': {
          description: 'Bad Request',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ApiError' },
            },
          },
        },
        '401': {
          description: 'Unauthorized',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ApiError' },
            },
          },
        },
        '403': {
          description: 'Forbidden',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ApiError' },
            },
          },
        },
      },
    };

    (pathItem as Record<string, unknown>)[route.method] = operation;
    paths[route.path] = pathItem;
  }

  return {
    openapi: '3.1.0',
    info: {
      title: 'Ship Public API',
      version: '1.0.0',
      description: 'Public OAuth-protected API contract at /api/v1.',
    },
    servers: [
      {
        url: `${req.protocol}://${req.get('host')}/api/v1`,
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'opaque',
        },
        cookieAuth: {
          type: 'apiKey',
          in: 'cookie',
          name: 'session_id',
        },
      },
      schemas: {
        ApiError: {
          type: 'object',
          required: ['code', 'message', 'request_id'],
          properties: {
            code: { type: 'string' },
            message: { type: 'string' },
            details: {
              type: 'object',
              additionalProperties: true,
            },
            request_id: { type: 'string' },
          },
        },
        PublicMeResponse: {
          type: 'object',
          required: ['id', 'email', 'name', 'workspace_id', 'client_id', 'scopes'],
          properties: {
            id: { type: 'string', format: 'uuid' },
            email: { type: 'string' },
            name: { type: 'string' },
            is_super_admin: { type: 'boolean' },
            workspace_id: { type: 'string', format: 'uuid' },
            client_id: { type: 'string' },
            scopes: { type: 'array', items: { type: 'string' } },
            created_at: { type: 'string', format: 'date-time' },
            updated_at: { type: 'string', format: 'date-time' },
          },
        },
        Document: {
          type: 'object',
          required: ['id', 'workspace_id', 'document_type', 'title', 'created_at', 'updated_at'],
          properties: {
            id: { type: 'string', format: 'uuid' },
            workspace_id: { type: 'string', format: 'uuid' },
            document_type: { type: 'string' },
            title: { type: 'string' },
            properties: { type: 'object', additionalProperties: true },
            content: {},
            created_by: { type: 'string', format: 'uuid' },
            created_at: { type: 'string', format: 'date-time' },
            updated_at: { type: 'string', format: 'date-time' },
          },
        },
        DocumentListResponse: {
          type: 'object',
          required: ['data', 'next_cursor'],
          properties: {
            data: {
              type: 'array',
              items: { $ref: '#/components/schemas/Document' },
            },
            next_cursor: {
              type: 'string',
              nullable: true,
            },
          },
        },
        CreateDocumentRequest: {
          type: 'object',
          required: ['title'],
          properties: {
            title: { type: 'string' },
            document_type: { type: 'string' },
            properties: { type: 'object', additionalProperties: true },
            content: {},
          },
        },
        OAuthAppRegistrationRequest: {
          type: 'object',
          required: ['name', 'redirect_uris', 'requested_scopes'],
          properties: {
            name: { type: 'string' },
            redirect_uris: { type: 'array', items: { type: 'string', format: 'uri' } },
            requested_scopes: { type: 'array', items: { type: 'string' } },
          },
        },
        OAuthAppRegistrationResponse: {
          type: 'object',
          required: ['id', 'client_id', 'client_secret'],
          properties: {
            id: { type: 'string', format: 'uuid' },
            client_id: { type: 'string' },
            client_secret: { type: 'string' },
            note: { type: 'string' },
          },
        },
        OAuthAuthorizeResponse: {
          type: 'object',
          properties: {
            consent_required: { type: 'boolean' },
            client_id: { type: 'string' },
            requested_scopes: { type: 'array', items: { type: 'string' } },
            state: { type: ['string', 'null'] },
          },
        },
        OAuthConsentRequest: {
          type: 'object',
          required: ['client_id', 'redirect_uri', 'code_challenge', 'code_challenge_method', 'approve'],
          properties: {
            client_id: { type: 'string' },
            redirect_uri: { type: 'string', format: 'uri' },
            scope: { type: 'string' },
            state: { type: 'string' },
            code_challenge: { type: 'string' },
            code_challenge_method: { type: 'string', enum: ['S256'] },
            approve: { type: 'boolean' },
          },
        },
        OAuthConsentResponse: {
          type: 'object',
          required: ['code', 'redirect_to'],
          properties: {
            code: { type: 'string' },
            redirect_to: { type: 'string', format: 'uri' },
          },
        },
        OAuthTokenRequest: {
          type: 'object',
          required: ['grant_type', 'client_id', 'client_secret', 'code', 'code_verifier', 'redirect_uri'],
          properties: {
            grant_type: { type: 'string', enum: ['authorization_code'] },
            client_id: { type: 'string' },
            client_secret: { type: 'string' },
            code: { type: 'string' },
            code_verifier: { type: 'string' },
            redirect_uri: { type: 'string', format: 'uri' },
          },
        },
        OAuthTokenResponse: {
          type: 'object',
          required: ['access_token', 'token_type', 'expires_in'],
          properties: {
            access_token: { type: 'string' },
            token_type: { type: 'string' },
            expires_in: { type: 'integer' },
            scope: { type: 'string' },
          },
        },
      },
    },
    paths,
  };
}
