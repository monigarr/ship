import crypto from 'crypto';
import { pool } from '../db/client.js';
import { PublicApiError } from './http.js';
import { generateOpaqueToken, hashSecret } from './oauth.js';

export const ACCESS_TOKEN_TTL_SECONDS = 60 * 60;
export const REFRESH_TOKEN_TTL_SECONDS = 60 * 60 * 24 * 30;
const DEVICE_CODE_TTL_SECONDS = 15 * 60;

export interface IssuedTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  scope: string;
  userId: string;
  workspaceId: string;
  appId: string;
}

export async function issueAccessAndRefreshTokens(input: {
  appId: string;
  userId: string;
  workspaceId: string;
  scopes: string[];
  familyId?: string;
}): Promise<IssuedTokens> {
  const accessToken = generateOpaqueToken('atk');
  const refreshToken = generateOpaqueToken('rtk');
  const familyId = input.familyId ?? crypto.randomUUID();
  const scope = input.scopes.join(' ');

  await pool.query('BEGIN');
  try {
    await pool.query(
      `INSERT INTO oauth_access_tokens (app_id, user_id, workspace_id, token_hash, scopes, expires_at)
       VALUES ($1, $2, $3, $4, $5::text[], NOW() + make_interval(secs => $6))`,
      [input.appId, input.userId, input.workspaceId, hashSecret(accessToken), input.scopes, ACCESS_TOKEN_TTL_SECONDS]
    );

    await pool.query(
      `INSERT INTO oauth_refresh_tokens (family_id, app_id, user_id, workspace_id, token_hash, scopes, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6::text[], NOW() + make_interval(secs => $7))`,
      [familyId, input.appId, input.userId, input.workspaceId, hashSecret(refreshToken), input.scopes, REFRESH_TOKEN_TTL_SECONDS]
    );

    await pool.query('COMMIT');
  } catch (error) {
    await pool.query('ROLLBACK');
    throw error;
  }

  return {
    accessToken,
    refreshToken,
    expiresIn: ACCESS_TOKEN_TTL_SECONDS,
    scope,
    userId: input.userId,
    workspaceId: input.workspaceId,
    appId: input.appId,
  };
}

export function generateUserCode(): string {
  const chars = 'BCDFGHJKLMNPQRSTVWXZ23456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    if (i === 4) code += '-';
    code += chars[crypto.randomInt(0, chars.length)];
  }
  return code;
}

export async function createDeviceAuthorization(input: {
  clientId: string;
  scopes: string[];
}): Promise<{
  deviceCode: string;
  userCode: string;
  verificationUri: string;
  expiresIn: number;
  interval: number;
}> {
  const { rows } = await pool.query(
    `SELECT id, requested_scopes, revoked_at FROM oauth_apps WHERE client_id = $1`,
    [input.clientId]
  );
  const app = rows[0];
  if (!app || app.revoked_at) {
    throw new PublicApiError(400, 'invalid_client', 'Unknown or revoked client_id');
  }

  const allowed = (app.requested_scopes as string[]) ?? [];
  const scopes = input.scopes.length > 0 ? input.scopes : allowed;
  const invalid = scopes.filter((s) => !allowed.includes(s));
  if (invalid.length > 0) {
    throw new PublicApiError(400, 'invalid_scope', 'Scope not allowed for app', { scopes: invalid });
  }

  const deviceCode = generateOpaqueToken('dvc');
  const userCode = generateUserCode();

  await pool.query(
    `INSERT INTO oauth_device_codes (app_id, device_code_hash, user_code, scopes, expires_at, interval_seconds)
     VALUES ($1, $2, $3, $4::text[], NOW() + make_interval(secs => $5), 5)`,
    [app.id, hashSecret(deviceCode), userCode, scopes, DEVICE_CODE_TTL_SECONDS]
  );

  return {
    deviceCode,
    userCode,
    verificationUri: '/oauth/device',
    expiresIn: DEVICE_CODE_TTL_SECONDS,
    interval: 5,
  };
}

export async function verifyDeviceUserCode(input: {
  userCode: string;
  userId: string;
  workspaceId: string;
}): Promise<void> {
  const normalized = input.userCode.trim().toUpperCase();
  const { rows } = await pool.query(
    `SELECT id, expires_at, authorized_at FROM oauth_device_codes WHERE user_code = $1`,
    [normalized]
  );
  const row = rows[0];
  if (!row) {
    throw new PublicApiError(400, 'invalid_grant', 'Unknown user code');
  }
  if (new Date(row.expires_at as string).getTime() <= Date.now()) {
    throw new PublicApiError(400, 'expired_token', 'Device code expired');
  }
  if (row.authorized_at) {
    return;
  }

  await pool.query(
    `UPDATE oauth_device_codes
     SET user_id = $1, workspace_id = $2, authorized_at = NOW()
     WHERE id = $3`,
    [input.userId, input.workspaceId, row.id]
  );
}

export async function pollDeviceToken(input: {
  clientId: string;
  deviceCode: string;
}): Promise<
  | { pending: true; interval: number; slowDown?: boolean }
  | { pending: false; tokens: IssuedTokens }
> {
  const deviceHash = hashSecret(input.deviceCode);
  const { rows } = await pool.query(
    `SELECT dc.id,
            dc.scopes,
            dc.user_id,
            dc.workspace_id,
            dc.authorized_at,
            dc.expires_at,
            dc.interval_seconds,
            dc.last_poll_at,
            app.id as app_id,
            app.client_id
     FROM oauth_device_codes dc
     JOIN oauth_apps app ON app.id = dc.app_id
     WHERE dc.device_code_hash = $1 AND app.client_id = $2`,
    [deviceHash, input.clientId]
  );

  const row = rows[0];
  if (!row) {
    throw new PublicApiError(400, 'invalid_grant', 'Unknown device code');
  }

  if (new Date(row.expires_at as string).getTime() <= Date.now()) {
    throw new PublicApiError(400, 'expired_token', 'Device code expired');
  }

  const interval = (row.interval_seconds as number) ?? 5;
  if (row.last_poll_at) {
    const elapsed = Date.now() - new Date(row.last_poll_at as string).getTime();
    if (elapsed < interval * 1000) {
      await pool.query(`UPDATE oauth_device_codes SET last_poll_at = NOW() WHERE id = $1`, [row.id]);
      return { pending: true, interval, slowDown: true };
    }
  }

  await pool.query(`UPDATE oauth_device_codes SET last_poll_at = NOW() WHERE id = $1`, [row.id]);

  if (!row.authorized_at || !row.user_id) {
    return { pending: true, interval };
  }

  const tokens = await issueAccessAndRefreshTokens({
    appId: row.app_id as string,
    userId: row.user_id as string,
    workspaceId: row.workspace_id as string,
    scopes: (row.scopes as string[]) ?? [],
  });

  return { pending: false, tokens };
}

export async function redeemRefreshToken(input: {
  clientId: string;
  clientSecret?: string;
  refreshToken: string;
}): Promise<IssuedTokens> {
  const tokenHash = hashSecret(input.refreshToken);

  const { rows } = await pool.query(
    `SELECT rt.id,
            rt.family_id,
            rt.app_id,
            rt.user_id,
            rt.workspace_id,
            rt.scopes,
            rt.rotated_at,
            rt.revoked_at,
            rt.expires_at,
            app.client_id,
            app.client_secret_hash
     FROM oauth_refresh_tokens rt
     JOIN oauth_apps app ON app.id = rt.app_id
     WHERE rt.token_hash = $1 AND app.client_id = $2`,
    [tokenHash, input.clientId]
  );

  const row = rows[0];
  if (!row) {
    throw new PublicApiError(400, 'invalid_grant', 'Invalid refresh token');
  }

  if (input.clientSecret) {
    const secretHash = hashSecret(input.clientSecret);
    if (row.client_secret_hash !== secretHash) {
      throw new PublicApiError(401, 'invalid_client', 'Invalid client credentials');
    }
  }

  if (row.revoked_at) {
    throw new PublicApiError(400, 'invalid_grant', 'Refresh token revoked');
  }

  if (row.rotated_at) {
    await pool.query(
      `UPDATE oauth_refresh_tokens SET revoked_at = NOW() WHERE family_id = $1 AND revoked_at IS NULL`,
      [row.family_id]
    );
    throw new PublicApiError(400, 'invalid_grant', 'Refresh token reuse detected; family revoked');
  }

  if (new Date(row.expires_at as string).getTime() <= Date.now()) {
    throw new PublicApiError(400, 'invalid_grant', 'Refresh token expired');
  }

  await pool.query(
    `UPDATE oauth_refresh_tokens SET rotated_at = NOW() WHERE id = $1`,
    [row.id]
  );

  return issueAccessAndRefreshTokens({
    appId: row.app_id as string,
    userId: row.user_id as string,
    workspaceId: row.workspace_id as string,
    scopes: (row.scopes as string[]) ?? [],
    familyId: row.family_id as string,
  });
}
