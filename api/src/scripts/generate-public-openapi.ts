import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Request } from 'express';
import '../platform/routes/oauth.js';
import '../platform/routes/v1.js';
import { generatePublicOpenApiSpec } from '../platform/spec/openapi.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '../../..');
const docsPath = path.join(repoRoot, 'docs', 'openapi.json');

const document = generatePublicOpenApiSpec({
  protocol: 'https',
  get(header: string) {
    return header === 'host' ? 'ship.example.com' : undefined;
  },
} as Request);

fs.writeFileSync(docsPath, JSON.stringify(document, null, 2));
console.log(`Public OpenAPI written: ${docsPath}`);
