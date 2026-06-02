import { test, expect } from './fixtures/isolated-env';
import crypto from 'crypto';

function pkceChallenge(verifier: string): string {
  return crypto.createHash('sha256').update(verifier).digest('base64url');
}

test.describe('OAuth Authorization Code + PKCE', () => {
  test('completes flow end-to-end with invalid verifier negative case', async ({ page }) => {
    await page.goto('/login');
    await page.locator('#email').fill('dev@ship.local');
    await page.locator('#password').fill('admin123');
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(page).not.toHaveURL('/login', { timeout: 10_000 });

    const redirectUri = 'https://example.local/oauth/callback';

    const appRes = await page.request.post('/api/v1/oauth/apps', {
      data: {
        name: 'Playwright OAuth App',
        redirect_uris: [redirectUri],
        requested_scopes: ['documents:read', 'documents:write'],
      },
    });
    expect(appRes.status()).toBe(201);
    const appJson = await appRes.json();
    const clientId = String(appJson.client_id);
    const clientSecret = String(appJson.client_secret);

    const verifier = 'abcdefghijklmnopqrstuvwxyz1234567890abcdefghijklmnopqrstuvwxyz12345';
    const challenge = pkceChallenge(verifier);
    const state = 'playwright-state';

    const authorizeRes = await page.request.get('/api/v1/oauth/authorize', {
      params: {
        response_type: 'code',
        client_id: clientId,
        redirect_uri: redirectUri,
        scope: 'documents:read documents:write',
        state,
        code_challenge: challenge,
        code_challenge_method: 'S256',
        approve: '1',
      },
      maxRedirects: 0,
    });
    expect(authorizeRes.status()).toBe(302);
    const redirectLocation = authorizeRes.headers()['location'];
    expect(redirectLocation).toBeTruthy();
    const redirect = new URL(String(redirectLocation));
    const code = redirect.searchParams.get('code');
    expect(code).toBeTruthy();

    const tokenRes = await page.request.post('/api/v1/oauth/token', {
      data: {
        grant_type: 'authorization_code',
        client_id: clientId,
        client_secret: clientSecret,
        code,
        code_verifier: verifier,
        redirect_uri: redirectUri,
      },
    });
    expect(tokenRes.status()).toBe(200);
    const tokenJson = await tokenRes.json();
    const accessToken = String(tokenJson.access_token);
    expect(accessToken).toMatch(/^atk_/);

    const meRes = await page.request.get('/api/v1/me', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    expect(meRes.status()).toBe(200);
    const meJson = await meRes.json();
    expect(meJson.email).toBe('dev@ship.local');

    const badVerifierRes = await page.request.post('/api/v1/oauth/token', {
      data: {
        grant_type: 'authorization_code',
        client_id: clientId,
        client_secret: clientSecret,
        code,
        code_verifier: 'badbadbadbadbadbadbadbadbadbadbadbadbadbadbadbadbadbadbadbadbadb',
        redirect_uri: redirectUri,
      },
    });
    expect(badVerifierRes.status()).toBe(400);
    const badJson = await badVerifierRes.json();
    expect(badJson.code).toBe('invalid_grant');
  });
});
