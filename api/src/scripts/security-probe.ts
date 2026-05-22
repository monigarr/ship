import { exec as execCb } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { promisify } from 'node:util';
import type { IncomingMessage } from 'node:http';
import { WebSocket } from 'ws';

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

function parseSessionCookie(rawCookieHeader: string | null): string | undefined {
  if (!rawCookieHeader) return undefined;
  const cookiePart = rawCookieHeader.split(';')[0]?.trim();
  if (!cookiePart) return undefined;
  if (!cookiePart.startsWith('session_id=')) return undefined;
  return cookiePart;
}

function parseCookie(rawCookieHeader: string | null, cookieName: string): string | undefined {
  if (!rawCookieHeader) return undefined;
  const cookiePart = rawCookieHeader.split(';')[0]?.trim();
  if (!cookiePart) return undefined;
  if (!cookiePart.startsWith(`${cookieName}=`)) return undefined;
  return cookiePart;
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

async function probeAuthSession(ctx: ProbeContext): Promise<ProbeFinding[]> {
  const findings: ProbeFinding[] = [];
  try {
    const me = await fetchJson(`${ctx.baseUrl}/api/auth/me`);
    findings.push({
      id: 'auth-unauthenticated-route-access',
      surface: 'auth-session',
      status: me.status === 401 ? 'pass' : 'fail',
      severity: me.status === 401 ? 'info' : 'high',
      title: 'Unauthenticated auth route rejection',
      details: me.status === 401
        ? 'Route correctly rejects unauthenticated access.'
        : `Expected 401 from /api/auth/me, received ${me.status}.`,
      reproduction: [`curl -i "${ctx.baseUrl}/api/auth/me"`],
      evidence: { status: me.status },
    });
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

  const memberLogin = await login(ctx.baseUrl, ctx.memberEmail, ctx.memberPassword);
  const adminCheck = await fetchJson(`${ctx.baseUrl}/api/admin/workspaces`, {
    headers: memberLogin.sessionCookie ? { cookie: memberLogin.sessionCookie } : {},
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
    evidence: { loginStatus: memberLogin.status, adminStatus: adminCheck.status },
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
  const payload = '<script>alert("ship_probe")</script>';
  const sqliPayload = `' OR 1=1 --`;
  const longPayload = 'A'.repeat(10_000);

  try {
    const search = await fetchJson(`${ctx.baseUrl}/api/search?query=${encodeURIComponent(payload)}`);
    const responseString = JSON.stringify(search.body);
    const reflected = responseString.includes(payload);
    findings.push({
      id: 'input-reflected-xss-check',
      surface: 'input-sanitization',
      status: reflected ? 'warn' : 'pass',
      severity: reflected ? 'medium' : 'info',
      title: 'Reflected input payload check',
      details: reflected
        ? 'Raw script payload appears in response JSON. Confirm output encoding in UI rendering paths.'
        : 'No raw reflected payload detected in API response.',
      reproduction: [
        `curl -G "${ctx.baseUrl}/api/search" --data-urlencode "query=${payload}"`,
      ],
      evidence: { status: search.status, reflected },
    });
  } catch (error) {
    findings.push({
      id: 'input-surface-unreachable',
      surface: 'input-sanitization',
      status: 'error',
      severity: 'medium',
      title: 'Input sanitization probe failed to reach server',
      details: (error as Error).message,
      reproduction: [`curl -G "${ctx.baseUrl}/api/search" --data-urlencode "query=${payload}"`],
    });
  }

  try {
    const search = await fetchJson(`${ctx.baseUrl}/api/search?query=${encodeURIComponent(sqliPayload)}`);
    findings.push({
      id: 'input-sqli-probe-check',
      surface: 'input-sanitization',
      status: search.status >= 500 ? 'fail' : 'pass',
      severity: search.status >= 500 ? 'high' : 'info',
      title: 'SQLi-style payload handling',
      details: search.status >= 500
        ? `SQLi-style probe produced server error status ${search.status}.`
        : `SQLi-style probe did not produce server error (status ${search.status}).`,
      reproduction: [
        `curl -G "${ctx.baseUrl}/api/search" --data-urlencode "query=${sqliPayload}"`,
      ],
      evidence: { status: search.status },
    });
  } catch (error) {
    findings.push({
      id: 'input-sqli-probe-unreachable',
      surface: 'input-sanitization',
      status: 'error',
      severity: 'medium',
      title: 'SQLi-style probe failed to reach server',
      details: (error as Error).message,
      reproduction: [`curl -G "${ctx.baseUrl}/api/search" --data-urlencode "query=${sqliPayload}"`],
    });
  }

  try {
    const search = await fetchJson(`${ctx.baseUrl}/api/search?query=${encodeURIComponent(longPayload)}`);
    findings.push({
      id: 'input-excessive-length-check',
      surface: 'input-sanitization',
      status: search.status >= 500 ? 'fail' : 'pass',
      severity: search.status >= 500 ? 'high' : 'info',
      title: 'Excessive length payload handling',
      details: search.status >= 500
        ? `Long-input probe produced server error status ${search.status}.`
        : `Long-input probe handled without server error (status ${search.status}).`,
      reproduction: [
        `curl -G "${ctx.baseUrl}/api/search" --data-urlencode "query=<10k chars>"`,
      ],
      evidence: { status: search.status, length: longPayload.length },
    });
  } catch (error) {
    findings.push({
      id: 'input-excessive-length-unreachable',
      surface: 'input-sanitization',
      status: 'error',
      severity: 'medium',
      title: 'Excessive length probe failed to reach server',
      details: (error as Error).message,
      reproduction: [`curl -G "${ctx.baseUrl}/api/search" --data-urlencode "query=<10k chars>"`],
    });
  }

  if (ctx.memberEmail && ctx.memberPassword) {
    try {
      const memberLogin = await login(ctx.baseUrl, ctx.memberEmail, ctx.memberPassword);
      if (!memberLogin.sessionCookie || !memberLogin.csrfCookie) {
        findings.push({
          id: 'input-stored-vector-auth-failed',
          surface: 'input-sanitization',
          status: 'warn',
          severity: 'medium',
          title: 'Stored-vector probe unavailable',
          details: `Could not authenticate for stored-input probe (login status ${memberLogin.status}).`,
          reproduction: ['Verify SECURITY_PROBE_MEMBER_EMAIL and SECURITY_PROBE_MEMBER_PASSWORD values.'],
        });
      } else {
        const csrfResponse = await fetch(`${ctx.baseUrl}/api/csrf-token`, {
          headers: { cookie: memberLogin.csrfCookie },
        });
        const csrfData = await csrfResponse.json() as { token?: string };
        const issueTitle = `probe-${Date.now()}-${payload}`;
        const createIssue = await fetchJson(`${ctx.baseUrl}/api/issues`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            cookie: `${memberLogin.csrfCookie}; ${memberLogin.sessionCookie}`,
            ...(csrfData.token ? { 'x-csrf-token': csrfData.token } : {}),
          },
          body: JSON.stringify({
            title: issueTitle.slice(0, 255),
            priority: 'medium',
          }),
        });
        const listIssues = await fetchJson(`${ctx.baseUrl}/api/issues`, {
          headers: { cookie: memberLogin.sessionCookie },
        });
        const reflectedStoredPayload = JSON.stringify(listIssues.body).includes(payload);
        findings.push({
          id: 'input-stored-vector-check',
          surface: 'input-sanitization',
          status: createIssue.status >= 500 ? 'fail' : 'warn',
          severity: createIssue.status >= 500 ? 'high' : reflectedStoredPayload ? 'medium' : 'info',
          title: 'Stored vector payload handling',
          details: createIssue.status >= 500
            ? `Stored-vector write request failed with server error ${createIssue.status}.`
            : reflectedStoredPayload
              ? 'Stored vector appears unescaped in API issue response payload.'
              : `Stored vector probe write/read completed (create status ${createIssue.status}).`,
          reproduction: [
            'Authenticate as member user',
            `POST "${ctx.baseUrl}/api/issues" with script-like title payload`,
            `GET "${ctx.baseUrl}/api/issues" and inspect returned JSON`,
          ],
          evidence: {
            createStatus: createIssue.status,
            listStatus: listIssues.status,
            reflectedStoredPayload,
          },
        });
      }
    } catch (error) {
      findings.push({
        id: 'input-stored-vector-error',
        surface: 'input-sanitization',
        status: 'error',
        severity: 'medium',
        title: 'Stored vector probe execution failed',
        details: (error as Error).message,
        reproduction: [
          'Authenticate and create issue with script-like payload, then read it back via list endpoint.',
        ],
      });
    }
  } else {
    findings.push({
      id: 'input-stored-vector-skipped',
      surface: 'input-sanitization',
      status: 'skip',
      severity: 'low',
      title: 'Stored vector probe skipped',
      details: 'Set SECURITY_PROBE_MEMBER_EMAIL and SECURITY_PROBE_MEMBER_PASSWORD to run stored-input checks.',
      reproduction: ['Set member credentials and rerun security probe.'],
    });
  }

  return findings;
}

function severityFromAudit(level: string | undefined): Severity {
  if (level === 'critical') return 'critical';
  if (level === 'high') return 'high';
  if (level === 'moderate') return 'medium';
  if (level === 'low') return 'low';
  return 'info';
}

async function probeDependencies(): Promise<ProbeFinding[]> {
  const buildFindings = (
    parsed: {
      vulnerabilities?: Record<string, { severity?: string; via?: unknown }>;
      advisories?: Record<string, { module_name?: string; severity?: string; title?: string }>;
    },
  ): ProbeFinding[] => {
    const vulnFindings: ProbeFinding[] = Object.entries(parsed.vulnerabilities ?? {})
      .filter(([, data]) => data.severity === 'high' || data.severity === 'critical')
      .map(([name, data]) => ({
        id: `dep-${name}`,
        surface: 'dependencies',
        status: 'warn',
        severity: severityFromAudit(data.severity),
        title: `Dependency vulnerability: ${name}`,
        details: `Detected ${String(data.severity)} vulnerability for package ${name}.`,
        reproduction: ['pnpm audit --json'],
        evidence: { via: data.via },
      }));

    const advisoryFindings: ProbeFinding[] = Object.entries(parsed.advisories ?? {})
      .filter(([, data]) => data.severity === 'high' || data.severity === 'critical')
      .map(([id, data]) => ({
        id: `dep-advisory-${id}`,
        surface: 'dependencies',
        status: 'warn',
        severity: severityFromAudit(data.severity),
        title: `Dependency advisory: ${data.module_name ?? id}`,
        details: data.title
          ? `${data.title} (${String(data.severity)})`
          : `Detected ${String(data.severity)} severity advisory for ${data.module_name ?? id}.`,
        reproduction: ['pnpm audit --json'],
      }));

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
    return buildFindings(parsed);
  } catch (error) {
    const timedOut = (error as NodeJS.ErrnoException & { signal?: string }).signal === 'SIGTERM';
    const execError = error as NodeJS.ErrnoException & { stdout?: string; stderr?: string };

    const maybeJson = [execError.stdout, execError.stderr]
      .filter((s): s is string => Boolean(s && s.trim().startsWith('{')));
    for (const candidate of maybeJson) {
      try {
        const parsed = JSON.parse(candidate) as { vulnerabilities?: Record<string, { severity?: string; via?: unknown }> };
        return buildFindings(parsed);
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

function summarize(findings: ProbeFinding[]): ProbeReport['summary'] {
  const byStatus: Record<Status, number> = { pass: 0, fail: 0, warn: 0, skip: 0, error: 0 };
  const bySeverity: Record<Severity, number> = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
  for (const finding of findings) {
    byStatus[finding.status] += 1;
    bySeverity[finding.severity] += 1;
  }
  return { total: findings.length, byStatus, bySeverity };
}

function toMarkdown(report: ProbeReport): string {
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

main().catch((error: unknown) => {
  console.error('Security probe failed:', error);
  process.exit(1);
});
