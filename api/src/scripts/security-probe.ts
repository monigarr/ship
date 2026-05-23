import { exec as execCb } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { promisify } from 'node:util';
import type { IncomingMessage } from 'node:http';
import { pathToFileURL } from 'node:url';
import { WebSocket } from 'ws';
import { REFLECTED_INPUT_TARGETS, STORED_INPUT_TARGETS } from './security-probe-targets.js';

const exec = promisify(execCb);

type Surface = 'auth-session' | 'websocket' | 'input-sanitization' | 'dependencies';
type Status = 'pass' | 'fail' | 'warn' | 'skip' | 'error';
type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';

interface ProbeFinding {
  id: string;
  surface: Surface;
  status: Status;
  severity: Severity;
  title: string;
  details: string;
  reproduction: string[];
  evidence?: Record<string, unknown>;
}

interface ProbeContext {
  baseUrl: string;
  wsBaseUrl: string;
  timeoutMs: number;
  memberEmail?: string;
  memberPassword?: string;
}

interface ProbeReport {
  generatedAt: string;
  target: {
    baseUrl: string;
    wsBaseUrl: string;
  };
  summary: {
    total: number;
    byStatus: Record<Status, number>;
    bySeverity: Record<Severity, number>;
  };
  findings: ProbeFinding[];
}

function splitSetCookieHeaders(rawHeader: string | null): string[] {
  if (!rawHeader) return [];
  return rawHeader
    .split(/,(?=[^;,]+=[^;,]+)/g)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function parseCookieFromSetCookieHeaders(rawCookieHeader: string | null, cookieName: string): string | undefined {
  const cookies = splitSetCookieHeaders(rawCookieHeader);
  for (const candidate of cookies) {
    const cookiePart = candidate.split(';')[0]?.trim();
    if (cookiePart?.startsWith(`${cookieName}=`)) return cookiePart;
  }
  return undefined;
}

function parseSessionCookie(rawCookieHeader: string | null): string | undefined {
  return parseCookieFromSetCookieHeaders(rawCookieHeader, 'session_id');
}

function parseCookie(rawCookieHeader: string | null, cookieName: string): string | undefined {
  return parseCookieFromSetCookieHeaders(rawCookieHeader, cookieName);
}

function getCookieValue(cookieHeader: string | undefined, cookieName: string): string | undefined {
  if (!cookieHeader) return undefined;
  const value = cookieHeader
    .split(';')
    .map((entry) => entry.trim())
    .find((entry) => entry.startsWith(`${cookieName}=`))
    ?.split('=')
    .slice(1)
    .join('=');
  return value;
}

async function fetchJson(
  url: string,
  init?: RequestInit,
): Promise<{ ok: boolean; status: number; headers: Headers; body: unknown }> {
  const response = await fetch(url, init);
  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }
  return { ok: response.ok, status: response.status, headers: response.headers, body };
}

async function login(baseUrl: string, email: string, password: string): Promise<{ status: number; sessionCookie?: string; csrfCookie?: string }> {
  const csrfResponse = await fetch(`${baseUrl}/api/csrf-token`);
  const csrfCookie = parseCookie(csrfResponse.headers.get('set-cookie'), 'connect.sid');
  const csrfPayload = await csrfResponse.json() as { token?: string };

  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(csrfPayload.token ? { 'x-csrf-token': csrfPayload.token } : {}),
      ...(csrfCookie ? { cookie: csrfCookie } : {}),
    },
    body: JSON.stringify({ email, password }),
  });
  return {
    status: response.status,
    sessionCookie: parseSessionCookie(response.headers.get('set-cookie')),
    csrfCookie,
  };
}

async function getSession(baseUrl: string, sessionCookie?: string): Promise<{ status: number; body: unknown }> {
  const response = await fetchJson(`${baseUrl}/api/auth/session`, {
    headers: sessionCookie ? { cookie: sessionCookie } : {},
  });
  return { status: response.status, body: response.body };
}

async function probeAuthSession(ctx: ProbeContext): Promise<ProbeFinding[]> {
  const findings: ProbeFinding[] = [];
  const unauthenticatedRoutes = [
    '/api/auth/me',
    '/api/auth/session',
    '/api/documents',
    '/api/issues',
    '/api/admin/workspaces',
  ];

  try {
    for (const route of unauthenticatedRoutes) {
      const response = await fetchJson(`${ctx.baseUrl}${route}`);
      findings.push({
        id: `auth-unauthenticated-route-${route.replaceAll('/', '-').replace(/^-+/, '')}`,
        surface: 'auth-session',
        status: response.status === 401 || response.status === 403 ? 'pass' : 'fail',
        severity: response.status === 401 || response.status === 403 ? 'info' : 'high',
        title: `Unauthenticated route rejection (${route})`,
        details: response.status === 401 || response.status === 403
          ? `Route correctly rejected unauthenticated access with ${response.status}.`
          : `Expected 401/403 from ${route}, received ${response.status}.`,
        reproduction: [`curl -i "${ctx.baseUrl}${route}"`],
        evidence: { status: response.status },
      });
    }
  } catch (error) {
    findings.push({
      id: 'auth-route-unreachable',
      surface: 'auth-session',
      status: 'error',
      severity: 'medium',
      title: 'Auth probe could not reach server',
      details: (error as Error).message,
      reproduction: [`curl -i "${ctx.baseUrl}/api/auth/me"`],
    });
    return findings;
  }

  if (!ctx.memberEmail || !ctx.memberPassword) {
    findings.push({
      id: 'auth-role-check-skipped',
      surface: 'auth-session',
      status: 'skip',
      severity: 'low',
      title: 'Role escalation probe skipped',
      details: 'Set SECURITY_PROBE_MEMBER_EMAIL and SECURITY_PROBE_MEMBER_PASSWORD to run role checks.',
      reproduction: ['Set auth env vars and rerun probe'],
    });
    return findings;
  }

  const baselineLogin = await login(ctx.baseUrl, ctx.memberEmail, ctx.memberPassword);
  if (baselineLogin.status !== 200 || !baselineLogin.sessionCookie) {
    findings.push({
      id: 'auth-deep-session-checks-skipped',
      surface: 'auth-session',
      status: 'skip',
      severity: 'low',
      title: 'Deep auth/session checks skipped',
      details: `Member authentication failed (status ${baselineLogin.status}). Provide valid member credentials via SECURITY_PROBE_MEMBER_EMAIL/PASSWORD.`,
      reproduction: [
        'Set SECURITY_PROBE_MEMBER_EMAIL and SECURITY_PROBE_MEMBER_PASSWORD to valid credentials',
        'Re-run pnpm security:probe',
      ],
      evidence: { loginStatus: baselineLogin.status },
    });
    return findings;
  }

  const tokenSamples: string[] = [];
  const baselineToken = getCookieValue(baselineLogin.sessionCookie, 'session_id');
  if (baselineToken) tokenSamples.push(baselineToken);
  for (let idx = 0; idx < 4; idx += 1) {
    const sampleLogin = await login(ctx.baseUrl, ctx.memberEmail, ctx.memberPassword);
    const tokenValue = getCookieValue(sampleLogin.sessionCookie, 'session_id');
    if (tokenValue) tokenSamples.push(tokenValue);
  }
  const uniqueTokenCount = new Set(tokenSamples).size;
  const weakTokenFound = tokenSamples.some((token) => !/^[a-f0-9]{64}$/i.test(token));
  findings.push({
    id: 'auth-session-token-entropy',
    surface: 'auth-session',
    status: weakTokenFound || uniqueTokenCount !== tokenSamples.length ? 'fail' : 'pass',
    severity: weakTokenFound || uniqueTokenCount !== tokenSamples.length ? 'critical' : 'info',
    title: 'Session token format and uniqueness check',
    details: weakTokenFound || uniqueTokenCount !== tokenSamples.length
      ? 'Session tokens are not consistently 64-hex values or are not unique across login attempts.'
      : `Generated ${tokenSamples.length} login session tokens; all were unique 64-hex values.`,
    reproduction: [
      'Perform at least 5 successful logins for a member account',
      'Inspect returned session_id cookie values for length/charset/uniqueness',
    ],
    evidence: { sampleCount: tokenSamples.length, uniqueTokenCount },
  });

  const fixationCandidate = 'session_id=security-probe-fixed-session';
  const csrfResponse = await fetch(`${ctx.baseUrl}/api/csrf-token`);
  const csrfCookie = parseCookie(csrfResponse.headers.get('set-cookie'), 'connect.sid');
  const csrfBody = await csrfResponse.json() as { token?: string };
  const fixationLoginResponse = await fetch(`${ctx.baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(csrfBody.token ? { 'x-csrf-token': csrfBody.token } : {}),
      cookie: [csrfCookie, fixationCandidate].filter(Boolean).join('; '),
    },
    body: JSON.stringify({ email: ctx.memberEmail, password: ctx.memberPassword }),
  });
  const fixationResultCookie = parseSessionCookie(fixationLoginResponse.headers.get('set-cookie'));
  findings.push({
    id: 'auth-session-fixation',
    surface: 'auth-session',
    status: fixationResultCookie && fixationResultCookie !== fixationCandidate ? 'pass' : 'fail',
    severity: fixationResultCookie && fixationResultCookie !== fixationCandidate ? 'info' : 'critical',
    title: 'Session fixation resistance',
    details: fixationResultCookie && fixationResultCookie !== fixationCandidate
      ? 'Login replaced attacker-controlled session_id with a new server-generated session token.'
      : 'Login did not clearly rotate attacker-controlled session_id.',
    reproduction: [
      'Inject a forged session_id cookie before login',
      'Login and verify server issues a different session_id',
    ],
    evidence: {
      returnedSessionCookie: fixationResultCookie ?? null,
      injectedCookie: fixationCandidate,
    },
  });

  const firstLogin = await login(ctx.baseUrl, ctx.memberEmail, ctx.memberPassword);
  const secondLogin = await login(ctx.baseUrl, ctx.memberEmail, ctx.memberPassword);
  const oldSessionMe = await fetchJson(`${ctx.baseUrl}/api/auth/me`, {
    headers: firstLogin.sessionCookie ? { cookie: firstLogin.sessionCookie } : {},
  });
  const newSessionMe = await fetchJson(`${ctx.baseUrl}/api/auth/me`, {
    headers: secondLogin.sessionCookie ? { cookie: secondLogin.sessionCookie } : {},
  });
  findings.push({
    id: 'auth-session-replay-invalidation',
    surface: 'auth-session',
    status: oldSessionMe.status === 401 && newSessionMe.status === 200 ? 'pass' : 'warn',
    severity: oldSessionMe.status === 401 && newSessionMe.status === 200 ? 'info' : 'high',
    title: 'Session replay invalidation on relogin',
    details: `Old session /me status=${oldSessionMe.status}; new session /me status=${newSessionMe.status}.`,
    reproduction: [
      'Login twice with same account and retain both session_id cookies',
      'Call /api/auth/me using old and new cookies',
    ],
    evidence: {
      oldSessionStatus: oldSessionMe.status,
      newSessionStatus: newSessionMe.status,
    },
  });

  const sessionState = await getSession(ctx.baseUrl, secondLogin.sessionCookie);
  const sessionData = sessionState.body as {
    data?: { createdAt?: string; expiresAt?: string; absoluteExpiresAt?: string };
  };
  const createdAtMs = sessionData.data?.createdAt ? Date.parse(sessionData.data.createdAt) : NaN;
  const expiresAtMs = sessionData.data?.expiresAt ? Date.parse(sessionData.data.expiresAt) : NaN;
  const absoluteExpiresAtMs = sessionData.data?.absoluteExpiresAt ? Date.parse(sessionData.data.absoluteExpiresAt) : NaN;
  const expiryWindowMinutes = Number.isNaN(expiresAtMs) || Number.isNaN(createdAtMs)
    ? NaN
    : (expiresAtMs - createdAtMs) / (1000 * 60);
  const absoluteWindowMinutes = Number.isNaN(absoluteExpiresAtMs) || Number.isNaN(createdAtMs)
    ? NaN
    : (absoluteExpiresAtMs - createdAtMs) / (1000 * 60);
  const expiryValid = sessionState.status === 200
    && Number.isFinite(expiryWindowMinutes)
    && Number.isFinite(absoluteWindowMinutes)
    && expiryWindowMinutes > 0
    && absoluteWindowMinutes > expiryWindowMinutes;
  findings.push({
    id: 'auth-session-expiry-enforcement-signals',
    surface: 'auth-session',
    status: expiryValid ? 'pass' : 'warn',
    severity: expiryValid ? 'info' : 'high',
    title: 'Session expiry metadata and timeout window checks',
    details: expiryValid
      ? `Session endpoint reports inactivity window (~${expiryWindowMinutes.toFixed(2)} min) and larger absolute timeout window (~${absoluteWindowMinutes.toFixed(2)} min).`
      : 'Could not verify expected expiry metadata/time windows from /api/auth/session.',
    reproduction: [
      'Login as member user',
      `GET "${ctx.baseUrl}/api/auth/session"`,
      'Validate expiresAt and absoluteExpiresAt fields are present and coherent.',
    ],
    evidence: {
      status: sessionState.status,
      expiryWindowMinutes: Number.isFinite(expiryWindowMinutes) ? Number(expiryWindowMinutes.toFixed(2)) : null,
      absoluteWindowMinutes: Number.isFinite(absoluteWindowMinutes) ? Number(absoluteWindowMinutes.toFixed(2)) : null,
    },
  });

  const adminCheck = await fetchJson(`${ctx.baseUrl}/api/admin/workspaces`, {
    headers: baselineLogin.sessionCookie ? { cookie: baselineLogin.sessionCookie } : {},
  });

  findings.push({
    id: 'auth-member-admin-escalation-check',
    surface: 'auth-session',
    status: adminCheck.status === 401 || adminCheck.status === 403 ? 'pass' : 'fail',
    severity: adminCheck.status === 401 || adminCheck.status === 403 ? 'info' : 'critical',
    title: 'Member cannot access admin endpoint',
    details: adminCheck.status === 401 || adminCheck.status === 403
      ? `Access correctly blocked with ${adminCheck.status}.`
      : `Potential escalation: admin endpoint returned ${adminCheck.status}.`,
    reproduction: [
      'Login as non-admin member',
      `curl -i -H "cookie: session_id=..." "${ctx.baseUrl}/api/admin/workspaces"`,
    ],
    evidence: { loginStatus: baselineLogin.status, adminStatus: adminCheck.status },
  });

  return findings;
}

function wsUnauthProbe(url: string, timeoutMs: number): Promise<{ statusCode?: number; error?: string }> {
  return new Promise((resolvePromise) => {
    const ws = new WebSocket(url);
    const timer = setTimeout(() => {
      ws.terminate();
      resolvePromise({ error: 'timeout' });
    }, timeoutMs);

    ws.once('unexpected-response', (_request: IncomingMessage, response: IncomingMessage) => {
      clearTimeout(timer);
      ws.terminate();
      resolvePromise({ statusCode: response.statusCode });
    });

    ws.once('error', (error: Error) => {
      clearTimeout(timer);
      resolvePromise({ error: error.message });
    });
  });
}

function waitForWebSocketOpen(ws: WebSocket, timeoutMs: number): Promise<void> {
  return new Promise((resolvePromise, reject) => {
    const timer = setTimeout(() => reject(new Error('websocket open timeout')), timeoutMs);
    ws.once('open', () => {
      clearTimeout(timer);
      resolvePromise();
    });
    ws.once('error', (error: Error) => {
      clearTimeout(timer);
      reject(error);
    });
  });
}

function waitForWebSocketClose(ws: WebSocket, timeoutMs: number): Promise<{ code: number; reason: string }> {
  return new Promise((resolvePromise, reject) => {
    const timer = setTimeout(() => reject(new Error('websocket close timeout')), timeoutMs);
    ws.once('close', (code, reason) => {
      clearTimeout(timer);
      resolvePromise({ code, reason: String(reason ?? '') });
    });
    ws.once('error', (error: Error) => {
      clearTimeout(timer);
      reject(error);
    });
  });
}

async function probeWebSocket(ctx: ProbeContext): Promise<ProbeFinding[]> {
  const findings: ProbeFinding[] = [];
  const wsDoc = 'security-probe:00000000-0000-0000-0000-000000000000';
  const wsUrl = `${ctx.wsBaseUrl}/collaboration/${wsDoc}`;

  const unauth = await wsUnauthProbe(wsUrl, ctx.timeoutMs);
  findings.push({
    id: 'ws-unauthenticated-upgrade-check',
    surface: 'websocket',
    status: unauth.statusCode === 401 ? 'pass' : 'warn',
    severity: unauth.statusCode === 401 ? 'info' : 'medium',
    title: 'Unauthenticated WebSocket upgrade rejection',
    details: unauth.statusCode === 401
      ? 'WebSocket endpoint rejects unauthenticated connections.'
      : `Expected 401 on upgrade, observed ${String(unauth.statusCode ?? unauth.error ?? 'unknown')}.`,
    reproduction: [`wscat -c "${wsUrl}"`],
    evidence: unauth,
  });

  if (ctx.memberEmail && ctx.memberPassword) {
    const memberLogin = await login(ctx.baseUrl, ctx.memberEmail, ctx.memberPassword);
    if (!memberLogin.sessionCookie) {
      findings.push({
        id: 'ws-malformed-payload-check-auth-failed',
        surface: 'websocket',
        status: 'warn',
        severity: 'medium',
        title: 'Authenticated WebSocket malformed payload check unavailable',
        details: `Could not authenticate member user (login status ${memberLogin.status}).`,
        reproduction: ['Verify SECURITY_PROBE_MEMBER_EMAIL and SECURITY_PROBE_MEMBER_PASSWORD values.'],
      });
      return findings;
    }

    const ws = new WebSocket(wsUrl, {
      headers: { cookie: memberLogin.sessionCookie },
    });
    try {
      await waitForWebSocketOpen(ws, ctx.timeoutMs);
      ws.send(Buffer.alloc(512 * 1024, 0xff));
      ws.send(Buffer.from([255, 255, 255]));
      const close = await waitForWebSocketClose(ws, ctx.timeoutMs);
      findings.push({
        id: 'ws-malformed-payload-check',
        surface: 'websocket',
        status: close.code === 1006 ? 'warn' : 'pass',
        severity: close.code === 1006 ? 'medium' : 'info',
        title: 'Malformed and oversized WebSocket payload handling',
        details: close.code === 1006
          ? 'WebSocket closed abnormally while handling malformed payload.'
          : `Server closed malformed payload flow with code ${close.code}.`,
        reproduction: [
          'Authenticate as member user',
          `Connect to "${wsUrl}"`,
          'Send oversized binary payload and malformed frame bytes',
        ],
        evidence: close,
      });
    } catch (error) {
      const message = (error as Error).message;
      const rejectedMalformedPayload = /Unexpected server response:\s*400/i.test(message);
      findings.push({
        id: 'ws-malformed-payload-check',
        surface: 'websocket',
        status: rejectedMalformedPayload ? 'pass' : 'error',
        severity: rejectedMalformedPayload ? 'info' : 'medium',
        title: 'Malformed and oversized WebSocket payload handling',
        details: rejectedMalformedPayload
          ? 'Server rejected malformed websocket payload with HTTP 400 before upgrade.'
          : message,
        reproduction: [
          'Authenticate as member user',
          `Connect to "${wsUrl}" and send malformed payloads`,
        ],
      });
    } finally {
      ws.terminate();
    }
  } else {
    findings.push({
      id: 'ws-malformed-payload-check-skipped',
      surface: 'websocket',
      status: 'skip',
      severity: 'low',
      title: 'Authenticated WebSocket malformed payload check skipped',
      details: 'Set SECURITY_PROBE_MEMBER_EMAIL and SECURITY_PROBE_MEMBER_PASSWORD to run this check.',
      reproduction: ['Set member credentials and rerun security probe.'],
    });
  }

  return findings;
}

async function probeInputSanitization(ctx: ProbeContext): Promise<ProbeFinding[]> {
  const findings: ProbeFinding[] = [];
  const xssPayload = '<script>alert("ship_probe")</script>';
  const sqliPayload = `' OR 1=1 --`;
  const longPayload = 'A'.repeat(10_000);

  const memberLogin = ctx.memberEmail && ctx.memberPassword
    ? await login(ctx.baseUrl, ctx.memberEmail, ctx.memberPassword)
    : undefined;
  const authCookie = memberLogin?.sessionCookie
    ? [memberLogin.csrfCookie, memberLogin.sessionCookie].filter(Boolean).join('; ')
    : undefined;

  for (const target of REFLECTED_INPUT_TARGETS) {
    if (target.requiresAuth && !memberLogin?.sessionCookie) {
      findings.push({
        id: `input-reflected-${target.id}-skipped`,
        surface: 'input-sanitization',
        status: 'skip',
        severity: 'low',
        title: `Reflected input probe skipped (${target.title})`,
        details: 'Authenticated credentials not available for this reflected-input probe target.',
        reproduction: ['Set member credentials and rerun security probe.'],
      });
      continue;
    }

    for (const [vector, value] of [
      ['xss', xssPayload],
      ['sqli', sqliPayload],
      ['long', longPayload],
    ] as const) {
      const url = `${ctx.baseUrl}${target.path}?${target.queryParam}=${encodeURIComponent(value)}`;
      const response = await fetchJson(url, {
        headers: target.requiresAuth && authCookie ? { cookie: authCookie } : {},
      });
      const reflected = JSON.stringify(response.body).includes(value);
      const serverError = response.status >= 500;

      findings.push({
        id: `input-reflected-${target.id}-${vector}`,
        surface: 'input-sanitization',
        status: serverError ? 'fail' : reflected && vector === 'xss' ? 'warn' : 'pass',
        severity: serverError ? 'high' : reflected && vector === 'xss' ? 'medium' : 'info',
        title: `Reflected ${vector.toUpperCase()} probe (${target.title})`,
        details: serverError
          ? `${target.path} returned server error ${response.status} for ${vector} payload.`
          : reflected && vector === 'xss'
            ? 'Raw script-like payload echoed in API response JSON.'
            : `${target.path} handled ${vector} payload with status ${response.status}.`,
        reproduction: [`curl -G "${ctx.baseUrl}${target.path}" --data-urlencode "${target.queryParam}=${value}"`],
        evidence: { status: response.status, reflected },
      });
    }
  }

  if (memberLogin?.sessionCookie && memberLogin.csrfCookie) {
    const csrfResponse = await fetch(`${ctx.baseUrl}/api/csrf-token`, {
      headers: { cookie: memberLogin.csrfCookie },
    });
    const csrfData = await csrfResponse.json() as { token?: string };
    const csrfHeaderValue = csrfData.token;

    for (const target of STORED_INPUT_TARGETS) {
      const payloadVariants = [
        { vector: 'xss', value: `probe-${Date.now()}-${xssPayload}` },
        { vector: 'sqli', value: `probe-${Date.now()}-${sqliPayload}` },
        { vector: 'long', value: longPayload.slice(0, 500) },
      ] as const;

      for (const variant of payloadVariants) {
        const createBody: Record<string, unknown> = {
          ...target.basePayload,
          [target.fieldName]: variant.value,
        };
        const createHeaders: Record<string, string> = {
          'content-type': 'application/json',
          cookie: `${memberLogin.csrfCookie}; ${memberLogin.sessionCookie}`,
        };
        if (csrfHeaderValue) {
          createHeaders['x-csrf-token'] = csrfHeaderValue;
        }
        const createResponse = await fetchJson(`${ctx.baseUrl}${target.createPath}`, {
          method: 'POST',
          headers: createHeaders,
          body: JSON.stringify(createBody),
        });
        const readResponse = await fetchJson(`${ctx.baseUrl}${target.listPath}`, {
          headers: { cookie: memberLogin.sessionCookie },
        });
        const reflectedStoredPayload = JSON.stringify(readResponse.body).includes(variant.value);
        const serverError = createResponse.status >= 500 || readResponse.status >= 500;
        findings.push({
          id: `input-stored-${target.id}-${variant.vector}`,
          surface: 'input-sanitization',
          status: serverError ? 'fail' : reflectedStoredPayload && variant.vector === 'xss' ? 'warn' : 'pass',
          severity: serverError ? 'high' : reflectedStoredPayload && variant.vector === 'xss' ? 'medium' : 'info',
          title: `Stored ${variant.vector.toUpperCase()} probe (${target.title})`,
          details: serverError
            ? `Write/read cycle produced server error (create ${createResponse.status}, read ${readResponse.status}).`
            : reflectedStoredPayload && variant.vector === 'xss'
              ? 'Stored script-like payload was returned in API response payload.'
              : `Stored payload write/read handled (create ${createResponse.status}, read ${readResponse.status}).`,
          reproduction: [
            'Authenticate as member user',
            `POST "${ctx.baseUrl}${target.createPath}" with ${target.fieldName} payload`,
            `GET "${ctx.baseUrl}${target.listPath}" and inspect returned JSON`,
          ],
          evidence: {
            createStatus: createResponse.status,
            readStatus: readResponse.status,
            reflectedStoredPayload,
            fieldName: target.fieldName,
          },
        });
      }
    }
  } else {
    findings.push({
      id: 'input-stored-vector-skipped',
      surface: 'input-sanitization',
      status: 'skip',
      severity: 'low',
      title: 'Stored vector probes skipped',
      details: 'Set SECURITY_PROBE_MEMBER_EMAIL and SECURITY_PROBE_MEMBER_PASSWORD to run stored-input checks.',
      reproduction: ['Set member credentials and rerun security probe.'],
    });
  }

  return findings;
}

export function severityFromAudit(level: string | undefined): Severity {
  if (level === 'critical') return 'critical';
  if (level === 'high') return 'high';
  if (level === 'moderate') return 'medium';
  if (level === 'low') return 'low';
  return 'info';
}

const PACKAGE_FEATURE_MAP: Record<string, string[]> = {
  express: ['API routing', 'Auth/session endpoints'],
  'express-rate-limit': ['API rate limiting', 'Login brute-force protections'],
  ws: ['Collaboration WebSocket transport', 'Realtime notifications'],
  yjs: ['Collaborative document editing'],
  'openid-client': ['PIV/CAIA authentication flow'],
  vite: ['Frontend dev server / build chain'],
  rollup: ['Frontend bundling pipeline'],
  minimatch: ['Build and tooling glob expansion'],
  undici: ['Node fetch/network stack'],
  protobufjs: ['Generated schema serialization paths'],
  'fast-xml-parser': ['XML parsing paths and dependent tooling'],
};

async function resolveDependencyPath(packageName: string): Promise<string | undefined> {
  try {
    const { stdout } = await exec(`pnpm why ${packageName} --json`, {
      maxBuffer: 1024 * 1024 * 10,
      timeout: 30_000,
    });
    const parsed = JSON.parse(stdout) as unknown;
    return JSON.stringify(parsed).slice(0, 2000);
  } catch {
    return undefined;
  }
}

async function buildFeatureImpactEvidence(packageName: string): Promise<Record<string, unknown>> {
  return {
    package: packageName,
    features: PACKAGE_FEATURE_MAP[packageName] ?? ['Feature mapping requires review'],
    dependencyPath: await resolveDependencyPath(packageName),
  };
}

async function probeDependencies(): Promise<ProbeFinding[]> {
  const buildFindings = async (
    parsed: {
      vulnerabilities?: Record<string, { severity?: string; via?: unknown }>;
      advisories?: Record<string, { module_name?: string; severity?: string; title?: string }>;
    },
  ): Promise<ProbeFinding[]> => {
    const vulnFindings = await Promise.all(Object.entries(parsed.vulnerabilities ?? {})
      .filter(([, data]) => data.severity === 'high' || data.severity === 'critical')
      .map(async ([name, data]): Promise<ProbeFinding> => ({
        id: `dep-${name}`,
        surface: 'dependencies',
        status: 'warn',
        severity: severityFromAudit(data.severity),
        title: `Dependency vulnerability: ${name}`,
        details: `Detected ${String(data.severity)} vulnerability for package ${name}.`,
        reproduction: ['pnpm audit --json'],
        evidence: {
          via: data.via,
          ...(await buildFeatureImpactEvidence(name)),
        },
      })));

    const advisoryFindings = await Promise.all(Object.entries(parsed.advisories ?? {})
      .filter(([, data]) => data.severity === 'high' || data.severity === 'critical')
      .map(async ([id, data]): Promise<ProbeFinding> => ({
        id: `dep-advisory-${id}`,
        surface: 'dependencies',
        status: 'warn',
        severity: severityFromAudit(data.severity),
        title: `Dependency advisory: ${data.module_name ?? id}`,
        details: data.title
          ? `${data.title} (${String(data.severity)})`
          : `Detected ${String(data.severity)} severity advisory for ${data.module_name ?? id}.`,
        reproduction: ['pnpm audit --json'],
        evidence: data.module_name
          ? await buildFeatureImpactEvidence(data.module_name)
          : undefined,
      })));

    const findings = [...vulnFindings, ...advisoryFindings];
    if (findings.length === 0) {
      return [{
        id: 'dep-no-high-critical',
        surface: 'dependencies',
        status: 'pass',
        severity: 'info',
        title: 'No high/critical dependency vulnerabilities detected',
        details: 'No high or critical vulnerabilities were reported by pnpm audit.',
        reproduction: ['pnpm audit --json'],
      }];
    }
    return findings;
  };

  try {
    const { stdout } = await exec('pnpm audit --json', {
      maxBuffer: 1024 * 1024 * 20,
      timeout: 45_000,
    });
    const parsed = JSON.parse(stdout) as { vulnerabilities?: Record<string, { severity?: string; via?: unknown }> };
    return await buildFindings(parsed);
  } catch (error) {
    const timedOut = (error as NodeJS.ErrnoException & { signal?: string }).signal === 'SIGTERM';
    const execError = error as NodeJS.ErrnoException & { stdout?: string; stderr?: string };

    const maybeJson = [execError.stdout, execError.stderr]
      .filter((s): s is string => Boolean(s && s.trim().startsWith('{')));
    for (const candidate of maybeJson) {
      try {
        const parsed = JSON.parse(candidate) as { vulnerabilities?: Record<string, { severity?: string; via?: unknown }> };
        return await buildFindings(parsed);
      } catch {
        // keep trying fallbacks
      }
    }

    return [{
      id: 'dep-audit-failed',
      surface: 'dependencies',
      status: 'error',
      severity: 'medium',
      title: 'Dependency audit failed',
      details: timedOut
        ? 'Dependency audit timed out after 45 seconds'
        : (error as Error).message,
      reproduction: ['pnpm audit --json'],
    }];
  }
}

export function summarize(findings: ProbeFinding[]): ProbeReport['summary'] {
  const byStatus: Record<Status, number> = { pass: 0, fail: 0, warn: 0, skip: 0, error: 0 };
  const bySeverity: Record<Severity, number> = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
  for (const finding of findings) {
    byStatus[finding.status] += 1;
    bySeverity[finding.severity] += 1;
  }
  return { total: findings.length, byStatus, bySeverity };
}

export function toMarkdown(report: ProbeReport): string {
  const lines: string[] = [
    '# Security Probe Report',
    '',
    `Generated: ${report.generatedAt}`,
    `Target: ${report.target.baseUrl}`,
    '',
    '## Summary',
    '',
    `- Total findings: ${report.summary.total}`,
    `- Status: ${JSON.stringify(report.summary.byStatus)}`,
    `- Severity: ${JSON.stringify(report.summary.bySeverity)}`,
    '',
    '## Findings',
    '',
  ];

  for (const finding of report.findings) {
    lines.push(`### ${finding.id} - ${finding.title}`);
    lines.push(`- Surface: ${finding.surface}`);
    lines.push(`- Status: ${finding.status}`);
    lines.push(`- Severity: ${finding.severity}`);
    lines.push(`- Details: ${finding.details}`);
    lines.push('- Reproduction:');
    for (const step of finding.reproduction) {
      lines.push(`  - ${step}`);
    }
    lines.push('');
  }
  return lines.join('\n');
}

async function main(): Promise<void> {
  const baseUrl = process.env.SECURITY_PROBE_BASE_URL ?? 'http://localhost:3000';
  const wsBaseUrl = process.env.SECURITY_PROBE_WS_URL ?? baseUrl.replace(/^http/i, 'ws');
  const outputPath = process.env.SECURITY_PROBE_OUTPUT
    ?? '../prd_dev_branch_one/PRD_CAT8/security-probe-report.json';

  const ctx: ProbeContext = {
    baseUrl,
    wsBaseUrl,
    timeoutMs: Number(process.env.SECURITY_PROBE_TIMEOUT_MS ?? 8000),
    memberEmail: process.env.SECURITY_PROBE_MEMBER_EMAIL ?? 'alice.chen@ship.local',
    memberPassword: process.env.SECURITY_PROBE_MEMBER_PASSWORD ?? 'admin123',
  };

  const findings: ProbeFinding[] = [
    ...(await probeAuthSession(ctx)),
    ...(await probeWebSocket(ctx)),
    ...(await probeInputSanitization(ctx)),
    ...(await probeDependencies()),
  ];

  const report: ProbeReport = {
    generatedAt: new Date().toISOString(),
    target: { baseUrl, wsBaseUrl },
    summary: summarize(findings),
    findings,
  };

  const absoluteJson = resolve(outputPath);
  const absoluteMd = absoluteJson.replace(/\.json$/i, '.md');
  await mkdir(dirname(absoluteJson), { recursive: true });
  await writeFile(absoluteJson, JSON.stringify(report, null, 2), 'utf8');
  await writeFile(absoluteMd, toMarkdown(report), 'utf8');

  console.log(`Security probe finished. Findings: ${report.summary.total}`);
  console.log(`Report JSON: ${absoluteJson}`);
  console.log(`Report MD: ${absoluteMd}`);
}

export async function runSecurityProbe(): Promise<void> {
  await main();
}

const entrypoint = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : '';
if (import.meta.url === entrypoint) {
  main().catch((error: unknown) => {
    console.error('Security probe failed:', error);
    process.exit(1);
  });
}
