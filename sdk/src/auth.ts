import crypto from 'node:crypto';
import { ShipClient } from './client.js';

export interface ITokenStore {
  getAccessToken(): Promise<string | null>;
  setTokens(tokens: { accessToken: string; refreshToken?: string }): Promise<void>;
}

export class MemoryTokenStore implements ITokenStore {
  private accessToken: string | null = null;
  private refreshToken: string | null = null;

  async getAccessToken(): Promise<string | null> {
    return this.accessToken;
  }

  async getRefreshToken(): Promise<string | null> {
    return this.refreshToken;
  }

  async setTokens(tokens: { accessToken: string; refreshToken?: string }): Promise<void> {
    this.accessToken = tokens.accessToken;
    if (tokens.refreshToken) this.refreshToken = tokens.refreshToken;
  }
}

export class FileTokenStore implements ITokenStore {
  constructor(private readonly filePath: string) {}

  private async read(): Promise<{ accessToken?: string; refreshToken?: string }> {
    try {
      const fs = await import('node:fs/promises');
      const raw = await fs.readFile(this.filePath, 'utf8');
      return JSON.parse(raw) as { accessToken?: string; refreshToken?: string };
    } catch {
      return {};
    }
  }

  private async write(data: { accessToken: string; refreshToken?: string }): Promise<void> {
    const fs = await import('node:fs/promises');
    await fs.writeFile(this.filePath, JSON.stringify(data, null, 2), 'utf8');
  }

  async getAccessToken(): Promise<string | null> {
    const data = await this.read();
    return data.accessToken ?? null;
  }

  async setTokens(tokens: { accessToken: string; refreshToken?: string }): Promise<void> {
    await this.write(tokens);
  }
}

export async function deviceLogin(opts: {
  baseUrl: string;
  clientId: string;
  scopes?: string[];
  onUserCode: (code: string, verifyUrl: string) => void;
  tokenStore?: ITokenStore;
  fetchFn?: typeof fetch;
  pollIntervalMs?: number;
  maxWaitMs?: number;
}): Promise<ShipClient> {
  const fetchFn = opts.fetchFn ?? fetch;
  const store = opts.tokenStore ?? new MemoryTokenStore();

  const startRes = await fetchFn(`${opts.baseUrl}/api/v1/oauth/device/code`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: opts.clientId,
      scope: opts.scopes?.join(' '),
    }),
  });

  if (!startRes.ok) {
    throw new Error(`Device code request failed: ${startRes.status}`);
  }

  const startBody = (await startRes.json()) as {
    device_code: string;
    user_code: string;
    verification_uri: string;
    interval: number;
  };

  opts.onUserCode(startBody.user_code, `${opts.baseUrl}${startBody.verification_uri}`);

  const intervalMs = (opts.pollIntervalMs ?? startBody.interval * 1000) || 5000;
  const deadline = Date.now() + (opts.maxWaitMs ?? 120_000);

  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, intervalMs));

    const tokenRes = await fetchFn(`${opts.baseUrl}/api/v1/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
        client_id: opts.clientId,
        device_code: startBody.device_code,
      }),
    });

    if (tokenRes.ok) {
      const body = (await tokenRes.json()) as { access_token: string; refresh_token?: string };
      await store.setTokens({ accessToken: body.access_token, refreshToken: body.refresh_token });
      return new ShipClient({ baseUrl: opts.baseUrl, token: body.access_token, fetchFn });
    }

    const errBody = (await tokenRes.json()) as { error?: string };
    if (errBody.error === 'slow_down') {
      await new Promise((r) => setTimeout(r, intervalMs));
      continue;
    }
    if (errBody.error !== 'authorization_pending') {
      throw new Error(`Device login failed: ${JSON.stringify(errBody)}`);
    }
  }

  throw new Error('Device login timed out');
}

function base64UrlEncode(buffer: Buffer): string {
  return buffer.toString('base64url');
}

export function generatePkcePair(): { codeVerifier: string; codeChallenge: string } {
  const codeVerifier = base64UrlEncode(crypto.randomBytes(32));
  const codeChallenge = base64UrlEncode(crypto.createHash('sha256').update(codeVerifier).digest());
  return { codeVerifier, codeChallenge };
}

export async function authorizationCodeFlow(opts: {
  baseUrl: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes?: string[];
  state?: string;
  onAuthorizeUrl: (url: string) => void | Promise<void>;
  getAuthorizationCode: () => Promise<string>;
  tokenStore?: ITokenStore;
  fetchFn?: typeof fetch;
}): Promise<ShipClient> {
  const fetchFn = opts.fetchFn ?? fetch;
  const store = opts.tokenStore ?? new MemoryTokenStore();
  const { codeVerifier, codeChallenge } = generatePkcePair();
  const scope = opts.scopes?.join(' ') ?? '';
  const state = opts.state ?? base64UrlEncode(crypto.randomBytes(16));

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: opts.clientId,
    redirect_uri: opts.redirectUri,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    state,
  });
  if (scope) params.set('scope', scope);

  const authorizeUrl = `${opts.baseUrl}/api/v1/oauth/authorize?${params.toString()}`;
  await opts.onAuthorizeUrl(authorizeUrl);

  const code = await opts.getAuthorizationCode();

  const tokenRes = await fetchFn(`${opts.baseUrl}/api/v1/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'authorization_code',
      client_id: opts.clientId,
      client_secret: opts.clientSecret,
      code,
      code_verifier: codeVerifier,
      redirect_uri: opts.redirectUri,
    }),
  });

  if (!tokenRes.ok) {
    const errBody = await tokenRes.json().catch(() => ({}));
    throw new Error(`Authorization code exchange failed: ${JSON.stringify(errBody)}`);
  }

  const body = (await tokenRes.json()) as { access_token: string; refresh_token?: string };
  await store.setTokens({ accessToken: body.access_token, refreshToken: body.refresh_token });
  return new ShipClient({ baseUrl: opts.baseUrl, token: body.access_token, fetchFn });
}
