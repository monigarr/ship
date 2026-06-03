import { Request, Response, Router } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../../middleware/auth.js';
import { pool } from '../../db/client.js';
import { PublicApiError, sendPublicError } from '../http.js';
import { createAuthorizationCode, insertOAuthApp, redeemAuthorizationCode, rotateOAuthAppSecret } from '../oauth.js';
import {
  createDeviceAuthorization,
  issueAccessAndRefreshTokens,
  pollDeviceToken,
  redeemRefreshToken,
  verifyDeviceUserCode,
} from '../oauth-tokens.js';
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

const tokenAuthCodeSchema = z.object({
  grant_type: z.literal('authorization_code'),
  client_id: z.string().min(1),
  client_secret: z.string().min(1),
  code: z.string().min(1),
  code_verifier: z.string().min(43).max(128),
  redirect_uri: z.string().url(),
});

const tokenRefreshSchema = z.object({
  grant_type: z.literal('refresh_token'),
  client_id: z.string().min(1),
  client_secret: z.string().min(1).optional(),
  refresh_token: z.string().min(1),
});

const tokenDeviceSchema = z.object({
  grant_type: z.literal('urn:ietf:params:oauth:grant-type:device_code'),
  client_id: z.string().min(1),
  device_code: z.string().min(1),
});

const deviceCodeSchema = z.object({
  client_id: z.string().min(1),
  scope: z.string().optional(),
});

const deviceVerifySchema = z.object({
  user_code: z.string().min(1),
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
  method: 'post',
  path: '/oauth/apps/{id}/rotate-secret',
  summary: 'Rotate OAuth app client secret',
  operationId: 'rotateOAuthAppSecret',
  tags: ['OAuth'],
  responseSchemaName: 'OAuthAppSecretRotationResponse',
});

registerPublicRoute({
  method: 'post',
  path: '/oauth/apps/{clientId}/portal-token',
  summary: 'Issue portal bearer token for an owned OAuth app',
  operationId: 'issuePortalAccessToken',
  tags: ['OAuth'],
  responseSchemaName: 'OAuthPortalTokenResponse',
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
  summary: 'Exchange authorization code, refresh token, or device code',
  operationId: 'exchangeOAuthToken',
  tags: ['OAuth'],
  requestBodySchemaName: 'OAuthTokenRequest',
  responseSchemaName: 'OAuthTokenResponse',
});

registerPublicRoute({
  method: 'post',
  path: '/oauth/device/code',
  summary: 'Start device authorization flow',
  operationId: 'startDeviceAuthorization',
  tags: ['OAuth'],
  requestBodySchemaName: 'OAuthDeviceCodeRequest',
  responseSchemaName: 'OAuthDeviceCodeResponse',
});

registerPublicRoute({
  method: 'post',
  path: '/oauth/device/verify',
  summary: 'Verify device user code',
  operationId: 'verifyDeviceUserCode',
  tags: ['OAuth'],
  requestBodySchemaName: 'OAuthDeviceVerifyRequest',
  responseSchemaName: 'OAuthDeviceVerifyResponse',
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

router.get('/apps', authMiddleware, async (req: Request, res: Response) => {
  if (!req.userId) {
    sendPublicError(req, res, 401, 'unauthorized', 'Login required');
    return;
  }

  const { rows } = await pool.query(
    `SELECT id, name, client_id, requested_scopes, created_at
     FROM oauth_apps
     WHERE owner_user_id = $1 AND revoked_at IS NULL
     ORDER BY created_at DESC`,
    [req.userId]
  );

  res.json({ data: rows });
});

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

router.post('/apps/:id/rotate-secret', authMiddleware, async (req: Request, res: Response) => {
  if (!req.userId) {
    sendPublicError(req, res, 401, 'unauthorized', 'Login required');
    return;
  }

  try {
    const rotated = await rotateOAuthAppSecret({
      appId: req.params.id as string,
      ownerUserId: req.userId,
    });
    res.json({
      client_secret: rotated.clientSecret,
      note: 'Client secret is shown exactly once. Store it securely now.',
    });
  } catch (error) {
    if (error instanceof PublicApiError) {
      sendPublicError(req, res, error.status, error.code, error.message, error.details);
      return;
    }
    sendPublicError(req, res, 500, 'server_error', 'Failed to rotate client secret');
  }
});

router.post('/apps/:clientId/portal-token', authMiddleware, async (req: Request, res: Response) => {
  if (!req.userId || !req.workspaceId) {
    sendPublicError(req, res, 401, 'unauthorized', 'Login required');
    return;
  }

  try {
    const app = await loadOAuthApp(req.params.clientId as string);
    if (app.revoked_at) {
      throw new PublicApiError(400, 'invalid_client', 'OAuth app is revoked');
    }

    const owner = await pool.query(
      `SELECT owner_user_id FROM oauth_apps WHERE id = $1`,
      [app.id]
    );
    if (owner.rows[0]?.owner_user_id !== req.userId && !req.isSuperAdmin) {
      sendPublicError(req, res, 403, 'forbidden', 'Not app owner');
      return;
    }

    const tokens = await issueAccessAndRefreshTokens({
      appId: app.id,
      userId: req.userId,
      workspaceId: req.workspaceId,
      scopes: app.requested_scopes,
    });

    res.json({
      access_token: tokens.accessToken,
      token_type: 'Bearer',
      expires_in: tokens.expiresIn,
      scope: tokens.scope,
    });
  } catch (error) {
    if (error instanceof PublicApiError) {
      sendPublicError(req, res, error.status, error.code, error.message, error.details);
      return;
    }
    sendPublicError(req, res, 500, 'server_error', 'Failed to issue portal token');
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

router.post('/device/code', async (req: Request, res: Response) => {
  const parsed = deviceCodeSchema.safeParse(req.body);
  if (!parsed.success) {
    sendPublicError(req, res, 400, 'invalid_request', 'Invalid device code request', {
      issues: parsed.error.issues,
    });
    return;
  }

  try {
    const scopes = parseScopeList(parsed.data.scope);
    const device = await createDeviceAuthorization({
      clientId: parsed.data.client_id,
      scopes,
    });

    res.json({
      device_code: device.deviceCode,
      user_code: device.userCode,
      verification_uri: device.verificationUri,
      expires_in: device.expiresIn,
      interval: device.interval,
    });
  } catch (error) {
    if (error instanceof PublicApiError) {
      sendPublicError(req, res, error.status, error.code, error.message, error.details);
      return;
    }
    sendPublicError(req, res, 500, 'server_error', 'Device authorization failed');
  }
});

router.post('/device/verify', authMiddleware, async (req: Request, res: Response) => {
  if (!req.userId || !req.workspaceId) {
    sendPublicError(req, res, 401, 'unauthorized', 'Login required');
    return;
  }

  const parsed = deviceVerifySchema.safeParse(req.body);
  if (!parsed.success) {
    sendPublicError(req, res, 400, 'invalid_request', 'Invalid device verify payload', {
      issues: parsed.error.issues,
    });
    return;
  }

  try {
    await verifyDeviceUserCode({
      userCode: parsed.data.user_code,
      userId: req.userId,
      workspaceId: req.workspaceId,
    });
    res.json({ verified: true });
  } catch (error) {
    if (error instanceof PublicApiError) {
      sendPublicError(req, res, error.status, error.code, error.message, error.details);
      return;
    }
    sendPublicError(req, res, 500, 'server_error', 'Device verification failed');
  }
});

router.post('/token', async (req: Request, res: Response) => {
  const grantType = req.body?.grant_type;

  try {
    if (grantType === 'authorization_code') {
      const parsed = tokenAuthCodeSchema.safeParse(req.body);
      if (!parsed.success) {
        sendPublicError(req, res, 400, 'invalid_request', 'Invalid token exchange payload', {
          issues: parsed.error.issues,
        });
        return;
      }

      const issued = await redeemAuthorizationCode({
        clientId: parsed.data.client_id,
        clientSecret: parsed.data.client_secret,
        code: parsed.data.code,
        codeVerifier: parsed.data.code_verifier,
        redirectUri: parsed.data.redirect_uri,
      });

      res.json({
        access_token: issued.accessToken,
        refresh_token: issued.refreshToken,
        token_type: 'Bearer',
        expires_in: issued.expiresIn,
        scope: issued.scope,
      });
      return;
    }

    if (grantType === 'refresh_token') {
      const parsed = tokenRefreshSchema.safeParse(req.body);
      if (!parsed.success) {
        sendPublicError(req, res, 400, 'invalid_request', 'Invalid refresh token payload', {
          issues: parsed.error.issues,
        });
        return;
      }

      const issued = await redeemRefreshToken({
        clientId: parsed.data.client_id,
        clientSecret: parsed.data.client_secret,
        refreshToken: parsed.data.refresh_token,
      });

      res.json({
        access_token: issued.accessToken,
        refresh_token: issued.refreshToken,
        token_type: 'Bearer',
        expires_in: issued.expiresIn,
        scope: issued.scope,
      });
      return;
    }

    if (grantType === 'urn:ietf:params:oauth:grant-type:device_code') {
      const parsed = tokenDeviceSchema.safeParse(req.body);
      if (!parsed.success) {
        sendPublicError(req, res, 400, 'invalid_request', 'Invalid device token payload', {
          issues: parsed.error.issues,
        });
        return;
      }

      const result = await pollDeviceToken({
        clientId: parsed.data.client_id,
        deviceCode: parsed.data.device_code,
      });

      if (result.pending) {
        if (result.slowDown) {
          res.status(400).json({
            error: 'slow_down',
            error_description: 'Polling too frequently',
          });
          return;
        }
        res.status(400).json({
          error: 'authorization_pending',
          error_description: 'Authorization pending',
        });
        return;
      }

      res.json({
        access_token: result.tokens.accessToken,
        refresh_token: result.tokens.refreshToken,
        token_type: 'Bearer',
        expires_in: result.tokens.expiresIn,
        scope: result.tokens.scope,
      });
      return;
    }

    sendPublicError(req, res, 400, 'unsupported_grant_type', 'Unsupported grant_type');
  } catch (error) {
    if (error instanceof PublicApiError) {
      sendPublicError(req, res, error.status, error.code, error.message, error.details);
      return;
    }
    sendPublicError(req, res, 500, 'server_error', 'Token exchange failed');
  }
});

export const oauthRouter = router;
