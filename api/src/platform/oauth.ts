import crypto from 'crypto';
import { NextFunction, Request, Response } from 'express';
import { pool } from '../db/client.js';
import { PublicApiError, sendPublicError } from './http.js';
import { hasRegisteredScope } from './scopes.js';

const ACCESS_TOKEN_TTL_SECONDS = 60 * 60;
const AUTH_CODE_TTL_SECONDS = 10 * 60;

export interface OAuthContext {
  appId: string;
  clientId: string;
  userId: string;
  workspaceId: string;
  scopes: string[];
}

declare global {
  namespace Express {
    interface Request {
      oauth?: OAuthContext;
    }
  }
}

export function hashSecret(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

export function generateOpaqueToken(prefix: string): string {
  return `${prefix}_${crypto.randomBytes(24).toString('hex')}`;
}

export function generateClientId(): string {
  return `ship_${crypto.randomBytes(16).toString('hex')}`;
}

export function createClientSecret(): string {
  return `shipsec_${crypto.randomBytes(32).toString('hex')}`;
}

export async function insertOAuthApp(input: {
  ownerUserId: string;
  workspaceId: string;
  name: string;
  redirectUris: string[];
  requestedScopes: string[];
}): Promise<{ id: string; clientId: string; clientSecret: string }> {
  const clientId = generateClientId();
  const clientSecret = createClientSecret();
  const clientSecretHash = hashSecret(clientSecret);

  const { rows } = await pool.query(
    `INSERT INTO oauth_apps (owner_user_id, workspace_id, name, client_id, client_secret_hash, redirect_uris, requested_scopes)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::text[])
     RETURNING id`,
    [input.ownerUserId, input.workspaceId, input.name, clientId, clientSecretHash, JSON.stringify(input.redirectUris), input.requestedScopes]
  );

  return {
    id: rows[0].id as string,
    clientId,
    clientSecret,
  };
}

export async function rotateOAuthAppSecret(input: {
  appId: string;
  ownerUserId: string;
}): Promise<{ clientSecret: string }> {
  const clientSecret = createClientSecret();
  const clientSecretHash = hashSecret(clientSecret);

  const { rowCount } = await pool.query(
    `UPDATE oauth_apps
     SET client_secret_hash = $1, updated_at = NOW()
     WHERE id = $2 AND owner_user_id = $3 AND revoked_at IS NULL`,
    [clientSecretHash, input.appId, input.ownerUserId]
  );

  if (!rowCount) {
    throw new PublicApiError(404, 'not_found', 'OAuth app not found');
  }

  return { clientSecret };
}

export async function createAuthorizationCode(input: {
  appId: string;
  userId: string;
  workspaceId: string;
  redirectUri: string;
  codeChallenge: string;
  codeChallengeMethod: 'S256';
  scopes: string[];
}): Promise<string> {
  const code = generateOpaqueToken('code');
  const codeHash = hashSecret(code);

  await pool.query(
    `INSERT INTO oauth_authorization_codes
      (app_id, user_id, workspace_id, code_hash, redirect_uri, code_challenge, code_challenge_method, scopes, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8::text[], NOW() + make_interval(secs => $9))`,
    [input.appId, input.userId, input.workspaceId, codeHash, input.redirectUri, input.codeChallenge, input.codeChallengeMethod, input.scopes, AUTH_CODE_TTL_SECONDS]
  );

  return code;
}

export function pkceChallengeFromVerifier(verifier: string): string {
  return crypto.createHash('sha256').update(verifier).digest('base64url');
}

export async function redeemAuthorizationCode(input: {
  clientId: string;
  clientSecret: string;
  code: string;
  codeVerifier: string;
  redirectUri: string;
}): Promise<{
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  scope: string;
  userId: string;
  workspaceId: string;
  appId: string;
}> {
  const codeHash = hashSecret(input.code);
  const secretHash = hashSecret(input.clientSecret);

  const { rows } = await pool.query(
    `SELECT ac.id,
            ac.user_id,
            ac.workspace_id,
            ac.scopes,
            ac.redirect_uri,
            ac.code_challenge,
            ac.code_challenge_method,
            ac.expires_at,
            ac.consumed_at,
            app.id as app_id,
            app.client_id
     FROM oauth_authorization_codes ac
     JOIN oauth_apps app ON app.id = ac.app_id
     WHERE ac.code_hash = $1
       AND app.client_id = $2
       AND app.client_secret_hash = $3
       AND app.revoked_at IS NULL`,
    [codeHash, input.clientId, secretHash]
  );

  const row = rows[0];
  if (!row) {
    throw new PublicApiError(400, 'invalid_grant', 'Invalid authorization code');
  }

  if (row.consumed_at) {
    throw new PublicApiError(400, 'invalid_grant', 'Authorization code already used');
  }

  if (new Date(row.expires_at as string).getTime() <= Date.now()) {
    throw new PublicApiError(400, 'invalid_grant', 'Authorization code expired');
  }

  if (row.redirect_uri !== input.redirectUri) {
    throw new PublicApiError(400, 'invalid_grant', 'Redirect URI mismatch');
  }

  if (row.code_challenge_method !== 'S256') {
    throw new PublicApiError(400, 'invalid_request', 'Unsupported code challenge method');
  }

  const derivedChallenge = pkceChallengeFromVerifier(input.codeVerifier);
  if (derivedChallenge !== row.code_challenge) {
    throw new PublicApiError(400, 'invalid_grant', 'code_verifier does not match code_challenge');
  }

  await pool.query(
    `UPDATE oauth_authorization_codes
     SET consumed_at = NOW()
     WHERE id = $1`,
    [row.id]
  );

  const scopes = (row.scopes as string[]) ?? [];
  const { issueAccessAndRefreshTokens } = await import('./oauth-tokens.js');
  const issued = await issueAccessAndRefreshTokens({
    appId: row.app_id as string,
    userId: row.user_id as string,
    workspaceId: row.workspace_id as string,
    scopes,
  });

  return {
    accessToken: issued.accessToken,
    refreshToken: issued.refreshToken,
    expiresIn: issued.expiresIn,
    scope: issued.scope,
    userId: issued.userId,
    workspaceId: issued.workspaceId,
    appId: issued.appId,
  };
}

export async function oauthBearerMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.header('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    sendPublicError(req, res, 401, 'unauthorized', 'Missing bearer token');
    return;
  }

  const token = authHeader.slice('Bearer '.length).trim();
  if (!token) {
    sendPublicError(req, res, 401, 'unauthorized', 'Missing bearer token');
    return;
  }

  const { rows } = await pool.query(
    `SELECT t.id,
            t.user_id,
            t.workspace_id,
            t.scopes,
            t.expires_at,
            t.revoked_at,
            a.id as app_id,
            a.client_id
     FROM oauth_access_tokens t
     JOIN oauth_apps a ON a.id = t.app_id
     WHERE t.token_hash = $1`,
    [hashSecret(token)]
  );

  const row = rows[0];
  if (!row || row.revoked_at) {
    sendPublicError(req, res, 401, 'unauthorized', 'Invalid bearer token');
    return;
  }

  if (new Date(row.expires_at as string).getTime() <= Date.now()) {
    sendPublicError(req, res, 401, 'token_expired', 'Bearer token expired');
    return;
  }

  req.oauth = {
    appId: row.app_id as string,
    clientId: row.client_id as string,
    userId: row.user_id as string,
    workspaceId: row.workspace_id as string,
    scopes: (row.scopes as string[]) ?? [],
  };

  next();
}

export function requireScope(scope: string) {
  if (!hasRegisteredScope(scope)) {
    throw new Error(`Scope is not registered: ${scope}`);
  }

  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.oauth) {
      sendPublicError(req, res, 401, 'unauthorized', 'Missing OAuth context');
      return;
    }

    if (!req.oauth.scopes.includes(scope)) {
      sendPublicError(req, res, 403, 'forbidden', 'Insufficient scope', {
        missing_scope: scope,
      });
      return;
    }

    (req as Request & { requiredScope?: string }).requiredScope = scope;
    next();
  };
}
