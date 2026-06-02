import { Request, Response, Router } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../../middleware/auth.js';
import { pool } from '../../db/client.js';
import { PublicApiError, sendPublicError } from '../http.js';
import { createAuthorizationCode, insertOAuthApp, redeemAuthorizationCode } from '../oauth.js';
import { listRegisteredScopes } from '../scopes.js';
import { registerPublicRoute } from '../spec/route-metadata.js';

const router = Router();

const createAppSchema = z.object({
  name: z.string().min(1).max(120),
  redirect_uris: z.array(z.string().url()).min(1),
  requested_scopes: z.array(z.string()).min(1),
});

const authorizeQuerySchema = z.object({
  response_type: z.literal('code'),
  client_id: z.string().min(1),
  redirect_uri: z.string().url(),
  scope: z.string().optional(),
  state: z.string().optional(),
  code_challenge: z.string().min(43).max(128),
  code_challenge_method: z.literal('S256'),
});

const authorizeConsentSchema = z.object({
  client_id: z.string().min(1),
  redirect_uri: z.string().url(),
  scope: z.string().optional(),
  state: z.string().optional(),
  code_challenge: z.string().min(43).max(128),
  code_challenge_method: z.literal('S256'),
  approve: z.boolean(),
});

const tokenSchema = z.object({
  grant_type: z.literal('authorization_code'),
  client_id: z.string().min(1),
  client_secret: z.string().min(1),
  code: z.string().min(1),
  code_verifier: z.string().min(43).max(128),
  redirect_uri: z.string().url(),
});

registerPublicRoute({
  method: 'post',
  path: '/oauth/apps',
  summary: 'Register OAuth app',
  operationId: 'registerOAuthApp',
  tags: ['OAuth'],
  requestBodySchemaName: 'OAuthAppRegistrationRequest',
  responseSchemaName: 'OAuthAppRegistrationResponse',
});

registerPublicRoute({
  method: 'get',
  path: '/oauth/authorize',
  summary: 'Start authorization code flow',
  operationId: 'authorizeOAuthApp',
  tags: ['OAuth'],
  responseSchemaName: 'OAuthAuthorizeResponse',
});

registerPublicRoute({
  method: 'post',
  path: '/oauth/authorize',
  summary: 'Approve authorization request',
  operationId: 'approveOAuthAuthorization',
  tags: ['OAuth'],
  requestBodySchemaName: 'OAuthConsentRequest',
  responseSchemaName: 'OAuthConsentResponse',
});

registerPublicRoute({
  method: 'post',
  path: '/oauth/token',
  summary: 'Exchange authorization code for access token',
  operationId: 'exchangeOAuthToken',
  tags: ['OAuth'],
  requestBodySchemaName: 'OAuthTokenRequest',
  responseSchemaName: 'OAuthTokenResponse',
});

function parseScopeList(scopeText: string | undefined): string[] {
  if (!scopeText) return [];
  return scopeText
    .split(' ')
    .map((scope) => scope.trim())
    .filter(Boolean);
}

async function loadOAuthApp(clientId: string): Promise<{
  id: string;
  client_id: string;
  redirect_uris: string[];
  requested_scopes: string[];
  revoked_at: string | null;
}> {
  const { rows } = await pool.query(
    `SELECT id, client_id, redirect_uris, requested_scopes, revoked_at
     FROM oauth_apps
     WHERE client_id = $1`,
    [clientId]
  );

  const row = rows[0];
  if (!row) {
    throw new PublicApiError(400, 'invalid_client', 'Unknown client_id');
  }

  return {
    id: row.id as string,
    client_id: row.client_id as string,
    redirect_uris: (row.redirect_uris as string[]) ?? [],
    requested_scopes: (row.requested_scopes as string[]) ?? [],
    revoked_at: (row.revoked_at as string | null) ?? null,
  };
}

function ensureScopesAreAllowed(requestedScopes: string[], allowedScopes: string[]): void {
  const unknownScopes = requestedScopes.filter((scope) => !listRegisteredScopes().includes(scope));
  if (unknownScopes.length > 0) {
    throw new PublicApiError(400, 'invalid_scope', 'Unknown scope requested', {
      scopes: unknownScopes,
    });
  }

  const disallowedScopes = requestedScopes.filter((scope) => !allowedScopes.includes(scope));
  if (disallowedScopes.length > 0) {
    throw new PublicApiError(400, 'invalid_scope', 'Scope was not approved for this app', {
      scopes: disallowedScopes,
    });
  }
}

router.post('/apps', authMiddleware, async (req: Request, res: Response) => {
  if (!req.userId || !req.workspaceId || !req.isSuperAdmin) {
    sendPublicError(req, res, 403, 'forbidden', 'Only admins can register OAuth apps');
    return;
  }

  const parsed = createAppSchema.safeParse(req.body);
  if (!parsed.success) {
    sendPublicError(req, res, 400, 'validation_failed', 'Invalid app registration payload', {
      issues: parsed.error.issues,
    });
    return;
  }

  try {
    const app = await insertOAuthApp({
      ownerUserId: req.userId,
      workspaceId: req.workspaceId,
      name: parsed.data.name,
      redirectUris: parsed.data.redirect_uris,
      requestedScopes: parsed.data.requested_scopes,
    });

    res.status(201).json({
      id: app.id,
      client_id: app.clientId,
      client_secret: app.clientSecret,
      note: 'Client secret is shown exactly once. Store it securely now.',
    });
  } catch (error) {
    sendPublicError(req, res, 500, 'server_error', 'Failed to create OAuth app');
  }
});

router.get('/authorize', authMiddleware, async (req: Request, res: Response) => {
  if (!req.userId || !req.workspaceId) {
    sendPublicError(req, res, 401, 'unauthorized', 'Login required');
    return;
  }

  const parsed = authorizeQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    sendPublicError(req, res, 400, 'invalid_request', 'Invalid authorization request', {
      issues: parsed.error.issues,
    });
    return;
  }

  try {
    const app = await loadOAuthApp(parsed.data.client_id);
    if (app.revoked_at) {
      throw new PublicApiError(400, 'invalid_client', 'OAuth app is revoked');
    }

    if (!app.redirect_uris.includes(parsed.data.redirect_uri)) {
      throw new PublicApiError(400, 'invalid_request', 'Redirect URI is not registered');
    }

    const requestedScopes = parseScopeList(parsed.data.scope);
    ensureScopesAreAllowed(requestedScopes, app.requested_scopes);

    const approveNow = req.query.approve === '1' || req.query.approve === 'true';
    if (!approveNow) {
      res.json({
        consent_required: true,
        client_id: app.client_id,
        requested_scopes: requestedScopes,
        state: parsed.data.state ?? null,
      });
      return;
    }

    const grantedScopes = requestedScopes.length > 0 ? requestedScopes : app.requested_scopes;
    const code = await createAuthorizationCode({
      appId: app.id,
      userId: req.userId,
      workspaceId: req.workspaceId,
      redirectUri: parsed.data.redirect_uri,
      codeChallenge: parsed.data.code_challenge,
      codeChallengeMethod: parsed.data.code_challenge_method,
      scopes: grantedScopes,
    });

    const redirect = new URL(parsed.data.redirect_uri);
    redirect.searchParams.set('code', code);
    if (parsed.data.state) {
      redirect.searchParams.set('state', parsed.data.state);
    }

    res.redirect(302, redirect.toString());
  } catch (error) {
    if (error instanceof PublicApiError) {
      sendPublicError(req, res, error.status, error.code, error.message, error.details);
      return;
    }
    sendPublicError(req, res, 500, 'server_error', 'Failed to start authorization');
  }
});

router.post('/authorize', authMiddleware, async (req: Request, res: Response) => {
  if (!req.userId || !req.workspaceId) {
    sendPublicError(req, res, 401, 'unauthorized', 'Login required');
    return;
  }

  const parsed = authorizeConsentSchema.safeParse(req.body);
  if (!parsed.success) {
    sendPublicError(req, res, 400, 'invalid_request', 'Invalid consent payload', {
      issues: parsed.error.issues,
    });
    return;
  }

  if (!parsed.data.approve) {
    sendPublicError(req, res, 400, 'access_denied', 'User denied consent');
    return;
  }

  try {
    const app = await loadOAuthApp(parsed.data.client_id);
    if (app.revoked_at) {
      throw new PublicApiError(400, 'invalid_client', 'OAuth app is revoked');
    }

    if (!app.redirect_uris.includes(parsed.data.redirect_uri)) {
      throw new PublicApiError(400, 'invalid_request', 'Redirect URI is not registered');
    }

    const requestedScopes = parseScopeList(parsed.data.scope);
    ensureScopesAreAllowed(requestedScopes, app.requested_scopes);
    const grantedScopes = requestedScopes.length > 0 ? requestedScopes : app.requested_scopes;

    const code = await createAuthorizationCode({
      appId: app.id,
      userId: req.userId,
      workspaceId: req.workspaceId,
      redirectUri: parsed.data.redirect_uri,
      codeChallenge: parsed.data.code_challenge,
      codeChallengeMethod: parsed.data.code_challenge_method,
      scopes: grantedScopes,
    });

    const redirect = new URL(parsed.data.redirect_uri);
    redirect.searchParams.set('code', code);
    if (parsed.data.state) {
      redirect.searchParams.set('state', parsed.data.state);
    }

    res.json({
      code,
      redirect_to: redirect.toString(),
    });
  } catch (error) {
    if (error instanceof PublicApiError) {
      sendPublicError(req, res, error.status, error.code, error.message, error.details);
      return;
    }
    sendPublicError(req, res, 500, 'server_error', 'Failed to approve authorization');
  }
});

router.post('/token', async (req: Request, res: Response) => {
  const parsed = tokenSchema.safeParse(req.body);
  if (!parsed.success) {
    sendPublicError(req, res, 400, 'invalid_request', 'Invalid token exchange payload', {
      issues: parsed.error.issues,
    });
    return;
  }

  try {
    const issued = await redeemAuthorizationCode({
      clientId: parsed.data.client_id,
      clientSecret: parsed.data.client_secret,
      code: parsed.data.code,
      codeVerifier: parsed.data.code_verifier,
      redirectUri: parsed.data.redirect_uri,
    });

    res.json({
      access_token: issued.accessToken,
      token_type: 'Bearer',
      expires_in: issued.expiresIn,
      scope: issued.scope,
    });
  } catch (error) {
    if (error instanceof PublicApiError) {
      sendPublicError(req, res, error.status, error.code, error.message, error.details);
      return;
    }
    sendPublicError(req, res, 500, 'server_error', 'Token exchange failed');
  }
});

export const oauthRouter = router;
