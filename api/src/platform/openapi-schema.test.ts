import { describe, expect, it } from 'vitest';
import OpenAPISchemaValidator from 'openapi-schema-validator';
import { Request } from 'express';
import { generatePublicOpenApiSpec } from './spec/openapi.js';

describe('public OpenAPI schema', () => {
  it('validates generated /api/v1/openapi.json against OpenAPI 3 schema', () => {
    const document = generatePublicOpenApiSpec({
      protocol: 'http',
      get(header: string) {
        return header === 'host' ? 'localhost:3001' : undefined;
      },
    } as Request);

    const ValidatorClass = (OpenAPISchemaValidator as unknown as { default?: typeof OpenAPISchemaValidator }).default
      ?? OpenAPISchemaValidator;
    const validator = new (ValidatorClass as any)({ version: 3 });
    const result = validator.validate(document);
    expect(result.errors).toEqual([]);
  });
});
