/**
 * SSM Parameter Store - Application Configuration
 *
 * This file loads application configuration from AWS SSM Parameter Store.
 *
 * Secrets Storage:
 * ─────────────────
 * SSM Parameter Store (/ship/{env}/):
 *   - DATABASE_URL, SESSION_SECRET, CORS_ORIGIN, S3_UPLOADS_BUCKET
 *   - Application config that changes per environment
 *   - CAIA OAuth credentials (CAIA_ISSUER_URL, CAIA_CLIENT_ID, etc.)
 */
import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm';

// Lazy-initialized client to avoid keeping Node.js alive during import tests
let _client: SSMClient | null = null;

function getClient(): SSMClient {
  if (!_client) {
    _client = new SSMClient({ region: process.env.AWS_REGION || 'us-east-1' });
  }
  return _client;
}

export async function getSSMSecret(name: string): Promise<string> {
  const command = new GetParameterCommand({
    Name: name,
    WithDecryption: true,
  });

  const response = await getClient().send(command);
  if (!response.Parameter?.Value) {
    throw new Error(`SSM parameter ${name} not found`);
  }
  return response.Parameter.Value;
}

async function getSSMSecretOptional(name: string): Promise<string | null> {
  try {
    return await getSSMSecret(name);
  } catch {
    return null;
  }
}

export async function loadProductionSecrets(): Promise<void> {
  if (process.env.NODE_ENV !== 'production') {
    return; // Use .env files for local dev
  }

  // Render (and other non-AWS environments) can provide env vars directly.
  if (process.env.SKIP_SSM_SECRETS === '1') {
    console.log('Skipping SSM secrets load (SKIP_SSM_SECRETS=1)');
    return;
  }

  // If all required values are already provided, do not overwrite them from SSM.
  if (
    process.env.DATABASE_URL &&
    process.env.SESSION_SECRET &&
    process.env.CORS_ORIGIN &&
    process.env.APP_BASE_URL &&
    process.env.S3_UPLOADS_BUCKET
  ) {
    console.log('Skipping SSM secrets load (required env vars already present)');
    return;
  }

  const environment = process.env.ENVIRONMENT || 'prod';
  const basePath = `/ship/${environment}`;

  console.log(`Loading secrets from SSM path: ${basePath}`);

  const [databaseUrl, sessionSecret, corsOrigin, cdnDomain, appBaseUrl, s3UploadsBucket] = await Promise.all([
    getSSMSecret(`${basePath}/DATABASE_URL`),
    getSSMSecret(`${basePath}/SESSION_SECRET`),
    getSSMSecret(`${basePath}/CORS_ORIGIN`),
    getSSMSecret(`${basePath}/CDN_DOMAIN`),
    getSSMSecret(`${basePath}/APP_BASE_URL`),
    getSSMSecretOptional(`${basePath}/S3_UPLOADS_BUCKET`),
  ]);

  process.env.DATABASE_URL = databaseUrl;
  process.env.SESSION_SECRET = sessionSecret;
  process.env.CORS_ORIGIN = corsOrigin;
  process.env.CDN_DOMAIN = cdnDomain;
  process.env.APP_BASE_URL = appBaseUrl;
  if (s3UploadsBucket) {
    process.env.S3_UPLOADS_BUCKET = s3UploadsBucket;
  } else {
    console.warn(`S3_UPLOADS_BUCKET missing in SSM at ${basePath}/S3_UPLOADS_BUCKET`);
  }

  console.log('Secrets loaded from SSM Parameter Store');
  console.log(`CORS_ORIGIN: ${corsOrigin}`);
  console.log(`CDN_DOMAIN: ${cdnDomain}`);
  console.log(`APP_BASE_URL: ${appBaseUrl}`);
  console.log(`S3_UPLOADS_BUCKET: ${process.env.S3_UPLOADS_BUCKET || '(not set)'}`);
}
