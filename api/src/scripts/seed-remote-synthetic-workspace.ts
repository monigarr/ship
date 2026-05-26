/**
 * @version 0.1.0
 * @date 2026-05-25
 * @author Monica Peters <monica.peters@gfachallenger.gauntletai.com>
 *
 * Purpose: Create an isolated synthetic workspace on a remote Ship instance and
 * seed deterministic use-case and edge-case data for HITL and automated PRD verification.
 *
 * Usage:
 *   SHIP_BASE_URL=https://ship-web-jyqh.onrender.com
 *   SHIP_EMAIL=you@example.com
 *   SHIP_PASSWORD=your-password
 *   pnpm --filter @ship/api seed:remote-synthetic
 *
 * Example:
 *   SHIP_SYNTH_WORKSPACE_NAME="GFA Synthetic FleetGraph v1" SHIP_SYNTH_RESUME=1 \
 *   pnpm --filter @ship/api seed:remote-synthetic
 *
 * Dependencies: Ship REST API routes (admin/workspaces, programs, projects, weeks,
 * issues, weekly-plans, weekly-retros, documents, team, auth), Node 20+ fetch
 *
 * Security/PHI: N/A - no PHI; credentials loaded from environment variables only.
 * HIPAA: N/A - no PHI.
 * FHIR: N/A - not interoperability.
 * Accessibility: N/A - non-UI script.
 * Performance: Uses bounded retries and optional request delay to avoid bursts.
 * Stability: Idempotent by deterministic titles and API-level upsert behavior where available.
 * Legal/compliance: N/A - internal synthetic test data generation.
 */

type JsonObject = Record<string, unknown>;

interface PersonRecord {
  id: string;
  user_id?: string | null;
  name: string;
  email?: string | null;
}

interface ProgramRecord {
  id: string;
  name: string;
  color?: string;
  emoji?: string | null;
}

interface ProjectRecord {
  id: string;
  title: string;
  program_id?: string | null;
}

interface WeekRecord {
  id: string;
  sprint_number: number;
  name: string;
}

interface IssueRecord {
  id: string;
  title: string;
}

interface WorkspaceSummary {
  id: string;
  name: string;
  sprintStartDate?: string | null;
  archivedAt?: string | null;
}

interface Counters {
  created: Record<string, number>;
  skipped: Record<string, number>;
  failed: Record<string, number>;
}

interface SeedManifest {
  people: Array<{
    key: string;
    name: string;
    email: string;
    role: string;
    useCase: 'UC1' | 'UC2' | 'UC3' | 'UC4';
  }>;
  programs: Array<{
    key: string;
    useCase: 'UC1' | 'UC2' | 'UC3' | 'UC4';
    title: string;
    color: string;
    emoji: string;
    projects: Array<{
      key: string;
      title: string;
      impact: 1 | 2 | 3 | 4 | 5;
      confidence: 1 | 2 | 3 | 4 | 5;
      ease: 1 | 2 | 3 | 4 | 5;
      plan: string;
      targetOffsetDays: number;
    }>;
    issues: Array<{
      key: string;
      title: string;
      state: 'triage' | 'backlog' | 'todo' | 'in_progress' | 'in_review' | 'done' | 'cancelled';
      priority: 'urgent' | 'high' | 'medium' | 'low' | 'none';
      sprintOffset: -1 | 0 | 1 | null;
      projectKey: string;
      estimateHours: number;
      edgeCase?: string;
    }>;
  }>;
}

const BASE_URL = (process.env.SHIP_BASE_URL ?? 'https://ship-web-jyqh.onrender.com').replace(/\/$/, '');
const EMAIL = process.env.SHIP_EMAIL;
const PASSWORD = process.env.SHIP_PASSWORD;
const WORKSPACE_NAME = process.env.SHIP_SYNTH_WORKSPACE_NAME ?? 'GFA Synthetic HITL Workspace';
const DRY_RUN = process.env.SHIP_SYNTH_DRY_RUN === '1' || process.env.SHIP_SYNTH_DRY_RUN === 'true';
const RESUME = process.env.SHIP_SYNTH_RESUME === '1' || process.env.SHIP_SYNTH_RESUME === 'true';
const DELAY_MS = Number(process.env.SHIP_SYNTH_DELAY_MS ?? '200');
const MARKER = '[SYNTH-HITL]';

const counters: Counters = {
  created: {},
  skipped: {},
  failed: {},
};

function bump(bucket: Record<string, number>, key: string): void {
  bucket[key] = (bucket[key] ?? 0) + 1;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function toMondayIsoDate(date: Date): string {
  const copy = new Date(date);
  const dow = copy.getUTCDay(); // 0 Sun ... 6 Sat
  const subtract = dow === 0 ? 6 : dow - 1;
  copy.setUTCDate(copy.getUTCDate() - subtract);
  return copy.toISOString().slice(0, 10);
}

function sprintNumberFromStartDate(startDateIso: string): number {
  const start = new Date(`${startDateIso}T00:00:00Z`);
  const now = new Date();
  const nowUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const days = Math.floor((nowUtc.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  return Math.max(1, Math.floor(days / 7) + 1);
}

function tiptapDocFromLines(lines: string[]): JsonObject {
  return {
    type: 'doc',
    content: [
      {
        type: 'bulletList',
        content: lines.map((line) => ({
          type: 'listItem',
          content: [
            {
              type: 'paragraph',
              content: [{ type: 'text', text: line }],
            },
          ],
        })),
      },
    ],
  };
}

class CookieJar {
  private cookies = new Map<string, string>();

  absorb(headers: Headers): void {
    const setCookies =
      typeof headers.getSetCookie === 'function'
        ? headers.getSetCookie()
        : [headers.get('set-cookie')].filter((v): v is string => Boolean(v));
    for (const raw of setCookies) {
      const pair = raw.split(';')[0]?.trim();
      if (!pair || !pair.includes('=')) continue;
      const [name, ...rest] = pair.split('=');
      if (!name) continue;
      this.cookies.set(name, rest.join('='));
    }
  }

  header(): string {
    return [...this.cookies.entries()].map(([k, v]) => `${k}=${v}`).join('; ');
  }
}

interface ShipSession {
  jar: CookieJar;
}

async function fetchJson(
  url: string,
  session: ShipSession,
  init?: RequestInit,
): Promise<{ ok: boolean; status: number; body: unknown; headers: Headers }> {
  const headers = new Headers(init?.headers);
  const cookie = session.jar.header();
  if (cookie) headers.set('cookie', cookie);

  const response = await fetch(url, { ...init, headers });
  session.jar.absorb(response.headers);

  let body: unknown = null;
  const ct = response.headers.get('content-type') ?? '';
  if (ct.includes('application/json')) {
    body = await response.json();
  } else {
    body = await response.text();
  }
  return { ok: response.ok, status: response.status, body, headers: response.headers };
}

async function getCsrfToken(baseUrl: string, session: ShipSession): Promise<string | undefined> {
  const res = await fetchJson(`${baseUrl}/api/csrf-token`, session);
  if (!res.ok || typeof res.body !== 'object' || !res.body) return undefined;
  return (res.body as { token?: string }).token;
}

async function login(baseUrl: string, email: string, password: string): Promise<ShipSession> {
  const session: ShipSession = { jar: new CookieJar() };
  const csrfRes = await fetchJson(`${baseUrl}/api/csrf-token`, session);
  const csrfToken = ((csrfRes.body as { token?: string })?.token) ?? undefined;

  const loginRes = await fetchJson(`${baseUrl}/api/auth/login`, session, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(csrfToken ? { 'x-csrf-token': csrfToken } : {}),
    },
    body: JSON.stringify({ email, password }),
  });

  if (!loginRes.ok) {
    throw new Error(`Login failed (${loginRes.status}): ${JSON.stringify(loginRes.body).slice(0, 400)}`);
  }

  if (!session.jar.header().includes('session_id=')) {
    throw new Error('Login succeeded but no session cookie found');
  }
  return session;
}

async function requestWithCsrf(
  method: 'POST' | 'PATCH' | 'DELETE',
  url: string,
  session: ShipSession,
  body?: unknown,
): Promise<{ ok: boolean; status: number; body: unknown }> {
  if (DRY_RUN && method !== 'DELETE') {
    return { ok: true, status: 200, body: { dryRun: true } };
  }

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const csrf = await getCsrfToken(BASE_URL, session);
    const res = await fetchJson(url, session, {
      method,
      headers: {
        'content-type': 'application/json',
        ...(csrf ? { 'x-csrf-token': csrf } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });

    if (res.ok) return { ok: true, status: res.status, body: res.body };

    const bodyText = typeof res.body === 'string' ? res.body : JSON.stringify(res.body);
    const retryable = res.status === 403 && (bodyText.includes('CSRF') || bodyText.includes('Blocked'));
    if (retryable && attempt < 3) {
      await sleep(DELAY_MS * 2);
      continue;
    }
    return { ok: false, status: res.status, body: res.body };
  }

  return { ok: false, status: 500, body: { error: 'Retry limit reached' } };
}

function buildManifest(): SeedManifest {
  return {
    people: [
      {
        key: 'dir',
        name: `${MARKER} Engineering Director`,
        email: 'synthetic.director@ship.local',
        role: 'director',
        useCase: 'UC1',
      },
      {
        key: 'mgr',
        name: `${MARKER} Engineering Manager`,
        email: 'synthetic.manager@ship.local',
        role: 'manager',
        useCase: 'UC1',
      },
      {
        key: 'mgr2',
        name: `${MARKER} Team Lead`,
        email: 'synthetic.teamlead@ship.local',
        role: 'manager',
        useCase: 'UC1',
      },
      {
        key: 'eng',
        name: `${MARKER} IC Engineer`,
        email: 'synthetic.engineer@ship.local',
        role: 'engineer',
        useCase: 'UC2',
      },
      {
        key: 'eng2',
        name: `${MARKER} Staff Engineer`,
        email: 'synthetic.staff@ship.local',
        role: 'engineer',
        useCase: 'UC2',
      },
      {
        key: 'eng3',
        name: `${MARKER} New Engineer`,
        email: 'synthetic.new-engineer@ship.local',
        role: 'engineer',
        useCase: 'UC2',
      },
      {
        key: 'pm',
        name: `${MARKER} Product Manager`,
        email: 'synthetic.pm@ship.local',
        role: 'pm',
        useCase: 'UC3',
      },
      {
        key: 'pm2',
        name: `${MARKER} Program Manager`,
        email: 'synthetic.program@ship.local',
        role: 'pm',
        useCase: 'UC3',
      },
      {
        key: 'audit',
        name: `${MARKER} Compliance Reviewer`,
        email: 'synthetic.audit@ship.local',
        role: 'auditor',
        useCase: 'UC4',
      },
      {
        key: 'qa',
        name: `${MARKER} QA Lead`,
        email: 'synthetic.qa@ship.local',
        role: 'qa',
        useCase: 'UC4',
      },
      {
        key: 'sec',
        name: `${MARKER} Security Lead`,
        email: 'synthetic.security@ship.local',
        role: 'security',
        useCase: 'UC4',
      },
    ],
    programs: [
      {
        key: 'uc1',
        useCase: 'UC1',
        title: `${MARKER} UC1 Manager Accountability`,
        color: '#3b82f6',
        emoji: '📋',
        projects: [
          {
            key: 'uc1-grid',
            title: `${MARKER} UC1 Accountability Grid Hardening`,
            impact: 5,
            confidence: 4,
            ease: 3,
            plan: 'Ensure managers can quickly identify overdue plans, missing reviews, and high-risk weekly slippage.',
            targetOffsetDays: 21,
          },
          {
            key: 'uc1-reviews',
            title: `${MARKER} UC1 Approval SLA and Review Cadence`,
            impact: 5,
            confidence: 4,
            ease: 4,
            plan: 'Reduce approval latency by enforcing explicit review SLAs and surfacing bottlenecks before sprint midpoint.',
            targetOffsetDays: 28,
          },
          {
            key: 'uc1-coaching',
            title: `${MARKER} UC1 Coaching Signals for 1:1 Preparation`,
            impact: 4,
            confidence: 3,
            ease: 3,
            plan: 'Bundle accountability signals into manager-ready coaching prompts so quality feedback is fast and specific.',
            targetOffsetDays: 35,
          },
        ],
        issues: [
          {
            key: 'uc1-overdue-plan',
            title: `${MARKER} UC1 Overdue weekly plan requires manager intervention`,
            state: 'todo',
            priority: 'high',
            sprintOffset: 0,
            projectKey: 'uc1-grid',
            estimateHours: 6,
            edgeCase: 'overdue_plan',
          },
          {
            key: 'uc1-approval-gap',
            title: `${MARKER} UC1 Week review exists but approval missing`,
            state: 'in_progress',
            priority: 'high',
            sprintOffset: 0,
            projectKey: 'uc1-grid',
            estimateHours: 4,
            edgeCase: 'approval_gap',
          },
          {
            key: 'uc1-carryover-risk',
            title: `${MARKER} UC1 Prior week carryover exceeds confidence threshold`,
            state: 'backlog',
            priority: 'medium',
            sprintOffset: -1,
            projectKey: 'uc1-grid',
            estimateHours: 3,
            edgeCase: 'carryover',
          },
          {
            key: 'uc1-tc8-overdue-approval',
            title: `${MARKER} UC1 TC8 Plan submitted but approval pending 2+ days`,
            state: 'todo',
            priority: 'high',
            sprintOffset: 0,
            projectKey: 'uc1-reviews',
            estimateHours: 5,
            edgeCase: 'overdue_plan_approval',
          },
          {
            key: 'uc1-tc7-standup-gap',
            title: `${MARKER} UC1 TC7 Assignee with open sprint work has no standup for 2 days`,
            state: 'in_progress',
            priority: 'high',
            sprintOffset: 0,
            projectKey: 'uc1-grid',
            estimateHours: 4,
            edgeCase: 'missing_standup',
          },
          {
            key: 'uc1owner',
            title: `${MARKER} UC1 Accountability signal has no clear owner of follow-up`,
            state: 'triage',
            priority: 'medium',
            sprintOffset: 1,
            projectKey: 'uc1-coaching',
            estimateHours: 2,
            edgeCase: 'missing_owner',
          },
          {
            key: 'uc1-review-rejected',
            title: `${MARKER} UC1 Weekly plan rejected with revision requested by manager`,
            state: 'in_review',
            priority: 'medium',
            sprintOffset: 0,
            projectKey: 'uc1-reviews',
            estimateHours: 3,
            edgeCase: 'changes_requested',
          },
          {
            key: 'uc1snooze',
            title: `${MARKER} UC1 Low severity reminder repeatedly snoozed by lead`,
            state: 'backlog',
            priority: 'low',
            sprintOffset: null,
            projectKey: 'uc1-coaching',
            estimateHours: 1,
            edgeCase: 'snoozed_noise',
          },
        ],
      },
      {
        key: 'uc2',
        useCase: 'UC2',
        title: `${MARKER} UC2 Engineer Execution Evidence`,
        color: '#10b981',
        emoji: '🛠️',
        projects: [
          {
            key: 'uc2-proof',
            title: `${MARKER} UC2 Proof-backed Delivery Flow`,
            impact: 5,
            confidence: 5,
            ease: 3,
            plan: 'Validate that weekly execution has standups, issue states, and retro evidence trails reviewers can inspect.',
            targetOffsetDays: 14,
          },
          {
            key: 'uc2-iteration',
            title: `${MARKER} UC2 Blocker and Iteration Freshness`,
            impact: 4,
            confidence: 4,
            ease: 3,
            plan: 'Detect stale execution and blocker age so sprint-end risk is surfaced before commitments fail.',
            targetOffsetDays: 17,
          },
          {
            key: 'uc2-context',
            title: `${MARKER} UC2 Context-aware Assistant Prompting`,
            impact: 4,
            confidence: 5,
            ease: 4,
            plan: 'Ensure issue-level on-demand prompts remain entity scoped and avoid generic chat responses.',
            targetOffsetDays: 20,
          },
        ],
        issues: [
          {
            key: 'uc2-done-evidence',
            title: `${MARKER} UC2 Completed issue with explicit evidence references`,
            state: 'done',
            priority: 'medium',
            sprintOffset: -1,
            projectKey: 'uc2-proof',
            estimateHours: 5,
          },
          {
            key: 'uc2-inprogress-no-proof',
            title: `${MARKER} UC2 In-progress issue with missing evidence attachment`,
            state: 'in_progress',
            priority: 'high',
            sprintOffset: 0,
            projectKey: 'uc2-proof',
            estimateHours: 8,
            edgeCase: 'missing_evidence',
          },
          {
            key: 'uc2-backlog-unassigned',
            title: `${MARKER} UC2 Backlog issue intentionally unassigned`,
            state: 'backlog',
            priority: 'low',
            sprintOffset: null,
            projectKey: 'uc2-proof',
            estimateHours: 2,
            edgeCase: 'unassigned',
          },
          {
            key: 'uc2-tc5-stale-blocker',
            title: `${MARKER} UC2 TC5 High-priority issue blocked for 30+ hours near sprint end`,
            state: 'in_progress',
            priority: 'urgent',
            sprintOffset: 0,
            projectKey: 'uc2-iteration',
            estimateHours: 9,
            edgeCase: 'stale_blocker',
          },
          {
            key: 'uc2-tc6-context-next-step',
            title: `${MARKER} UC2 TC6 Context issue asking "what should happen next?"`,
            state: 'in_progress',
            priority: 'high',
            sprintOffset: 0,
            projectKey: 'uc2-context',
            estimateHours: 5,
            edgeCase: 'context_scoped_on_demand',
          },
          {
            key: 'uc2-retro-too-short',
            title: `${MARKER} UC2 Weekly retro content is "Done." and lacks supporting proof`,
            state: 'todo',
            priority: 'high',
            sprintOffset: -1,
            projectKey: 'uc2-proof',
            estimateHours: 2,
            edgeCase: 'retro_too_short',
          },
          {
            key: 'uc2-reopened-after-done',
            title: `${MARKER} UC2 Issue reopened after done due to failed verification replay`,
            state: 'in_review',
            priority: 'medium',
            sprintOffset: 0,
            projectKey: 'uc2-iteration',
            estimateHours: 6,
            edgeCase: 'reopened_issue',
          },
          {
            key: 'uc2-cross-team-block',
            title: `${MARKER} UC2 External dependency blocks merge despite active coding`,
            state: 'in_progress',
            priority: 'high',
            sprintOffset: 1,
            projectKey: 'uc2-iteration',
            estimateHours: 7,
            edgeCase: 'dependency_blocked',
          },
        ],
      },
      {
        key: 'uc3',
        useCase: 'UC3',
        title: `${MARKER} UC3 PM Hypothesis Validation`,
        color: '#f59e0b',
        emoji: '📈',
        projects: [
          {
            key: 'uc3a',
            title: `${MARKER} UC3 Hypothesis A - Throughput Lift`,
            impact: 5,
            confidence: 3,
            ease: 2,
            plan: 'Test whether improvements in planning quality increase execution throughput by at least 15 percent.',
            targetOffsetDays: 28,
          },
          {
            key: 'uc3b',
            title: `${MARKER} UC3 Hypothesis B - Risk Reduction`,
            impact: 4,
            confidence: 4,
            ease: 4,
            plan: 'Compare a lower-risk implementation path to evaluate confidence-adjusted value outcomes.',
            targetOffsetDays: 35,
          },
          {
            key: 'uc3-portfolio',
            title: `${MARKER} UC3 Portfolio Drift and ICE Governance`,
            impact: 5,
            confidence: 3,
            ease: 2,
            plan: 'Reconcile roadmap promises, ICE scoring, and actual delivery evidence across active programs.',
            targetOffsetDays: 42,
          },
        ],
        issues: [
          {
            key: 'uc3-ice-high',
            title: `${MARKER} UC3 High-impact candidate queued for leadership review`,
            state: 'triage',
            priority: 'high',
            sprintOffset: 1,
            projectKey: 'uc3a',
            estimateHours: 5,
          },
          {
            key: 'uc3-cancelled',
            title: `${MARKER} UC3 Prior experiment cancelled after low confidence signal`,
            state: 'cancelled',
            priority: 'none',
            sprintOffset: -1,
            projectKey: 'uc3b',
            estimateHours: 1,
            edgeCase: 'cancelled_hypothesis',
          },
          {
            key: 'uc3-cross-program',
            title: `${MARKER} UC3 Cross-program dependency blocks expected impact`,
            state: 'todo',
            priority: 'medium',
            sprintOffset: 0,
            projectKey: 'uc3a',
            estimateHours: 6,
            edgeCase: 'cross_program_dependency',
          },
          {
            key: 'uc3hypo',
            title: `${MARKER} UC3 TC3 Hypothesis includes statement but no measurable success criteria`,
            state: 'todo',
            priority: 'high',
            sprintOffset: 0,
            projectKey: 'uc3a',
            estimateHours: 5,
            edgeCase: 'missing_success_criteria',
          },
          {
            key: 'uc3-ice-tie-break',
            title: `${MARKER} UC3 Two initiatives tie on ICE score and require PM tie-break`,
            state: 'triage',
            priority: 'medium',
            sprintOffset: 1,
            projectKey: 'uc3-portfolio',
            estimateHours: 3,
            edgeCase: 'ice_tie',
          },
          {
            key: 'uc3drift',
            title: `${MARKER} UC3 Project deliverables no longer map to declared PM outcome`,
            state: 'in_progress',
            priority: 'high',
            sprintOffset: 0,
            projectKey: 'uc3-portfolio',
            estimateHours: 8,
            edgeCase: 'hypothesis_drift',
          },
          {
            key: 'uc3-duplicate-initiative',
            title: `${MARKER} UC3 Duplicate initiatives across two programs create reporting confusion`,
            state: 'backlog',
            priority: 'low',
            sprintOffset: null,
            projectKey: 'uc3-portfolio',
            estimateHours: 2,
            edgeCase: 'duplicate_work',
          },
          {
            key: 'uc3-scope-creep',
            title: `${MARKER} UC3 Scope increase without confidence update`,
            state: 'in_review',
            priority: 'medium',
            sprintOffset: 0,
            projectKey: 'uc3b',
            estimateHours: 4,
            edgeCase: 'scope_creep',
          },
        ],
      },
      {
        key: 'uc4',
        useCase: 'UC4',
        title: `${MARKER} UC4 Compliance Security Verification`,
        color: '#ef4444',
        emoji: '🛡️',
        projects: [
          {
            key: 'uc4-gates',
            title: `${MARKER} UC4 Security Gate Replay`,
            impact: 5,
            confidence: 4,
            ease: 3,
            plan: 'Provide reproducible remediation proof and gate status visibility for compliance reviewers.',
            targetOffsetDays: 18,
          },
          {
            key: 'uc4-cve',
            title: `${MARKER} UC4 Open Findings Triage and Exception Aging`,
            impact: 5,
            confidence: 4,
            ease: 3,
            plan: 'Track unresolved security findings, exception expiry, and replay quality before closeout.',
            targetOffsetDays: 24,
          },
          {
            key: 'uc4-attestation',
            title: `${MARKER} UC4 Security Attestation and Probe Coverage`,
            impact: 4,
            confidence: 4,
            ease: 2,
            plan: 'Ensure security policies, attestation freshness, and probe artifacts remain complete and reviewable.',
            targetOffsetDays: 31,
          },
        ],
        issues: [
          {
            key: 'uc4-cve-open',
            title: `${MARKER} UC4 Open CVE remediation pending replay evidence`,
            state: 'in_review',
            priority: 'urgent',
            sprintOffset: 0,
            projectKey: 'uc4-gates',
            estimateHours: 10,
            edgeCase: 'open_security_gap',
          },
          {
            key: 'uc4-closeout',
            title: `${MARKER} UC4 Remediation closeout bundle prepared for audit`,
            state: 'done',
            priority: 'high',
            sprintOffset: -1,
            projectKey: 'uc4-gates',
            estimateHours: 7,
          },
          {
            key: 'uc4-missing-check',
            title: `${MARKER} UC4 Missing probe coverage flagged as gate failure`,
            state: 'todo',
            priority: 'high',
            sprintOffset: 1,
            projectKey: 'uc4-gates',
            estimateHours: 4,
            edgeCase: 'missing_probe',
          },
          {
            key: 'uc4-tc4-hitl',
            title: `${MARKER} UC4 TC4 Compliance gate review requested with open risk`,
            state: 'in_review',
            priority: 'urgent',
            sprintOffset: 0,
            projectKey: 'uc4-gates',
            estimateHours: 6,
            edgeCase: 'hitl_required',
          },
          {
            key: 'uc4-expired-exception',
            title: `${MARKER} UC4 Security exception expired but remediation evidence still incomplete`,
            state: 'todo',
            priority: 'high',
            sprintOffset: 0,
            projectKey: 'uc4-cve',
            estimateHours: 5,
            edgeCase: 'expired_exception',
          },
          {
            key: 'uc4-replay-missing',
            title: `${MARKER} UC4 Evidence bundle missing replay instructions for auditor`,
            state: 'todo',
            priority: 'high',
            sprintOffset: -1,
            projectKey: 'uc4-gates',
            estimateHours: 3,
            edgeCase: 'non_replayable_evidence',
          },
          {
            key: 'uc4-secrets-scan',
            title: `${MARKER} UC4 Secrets scan failure blocks release readiness`,
            state: 'in_progress',
            priority: 'urgent',
            sprintOffset: 1,
            projectKey: 'uc4-attestation',
            estimateHours: 8,
            edgeCase: 'secret_scan_failure',
          },
          {
            key: 'uc4-attestation-missing',
            title: `${MARKER} UC4 Security attestation not refreshed at branch HEAD`,
            state: 'todo',
            priority: 'high',
            sprintOffset: 0,
            projectKey: 'uc4-attestation',
            estimateHours: 4,
            edgeCase: 'attestation_stale',
          },
        ],
      },
    ],
  };
}

async function listAdminWorkspaces(session: ShipSession): Promise<WorkspaceSummary[]> {
  const res = await fetchJson(`${BASE_URL}/api/admin/workspaces?includeArchived=true`, session);
  if (!res.ok) throw new Error(`Failed to list workspaces (${res.status})`);
  const body = res.body as { success?: boolean; data?: { workspaces?: WorkspaceSummary[] } };
  return body.data?.workspaces ?? [];
}

async function ensureWorkspace(session: ShipSession): Promise<WorkspaceSummary> {
  const workspaces = await listAdminWorkspaces(session);
  const existing = workspaces.find((w) => w.name === WORKSPACE_NAME);

  if (existing && !RESUME) {
    throw new Error(
      `Workspace "${WORKSPACE_NAME}" already exists. Set SHIP_SYNTH_RESUME=1 to reuse it safely.`,
    );
  }

  if (existing) {
    console.log(`Reusing workspace: ${existing.name} (${existing.id})`);
    bump(counters.skipped, 'workspaces');
    return existing;
  }

  if (DRY_RUN) {
    console.log(`[dry-run] would create workspace: ${WORKSPACE_NAME}`);
    bump(counters.created, 'workspaces');
    return { id: 'dry-workspace', name: WORKSPACE_NAME };
  }

  const createRes = await requestWithCsrf('POST', `${BASE_URL}/api/admin/workspaces`, session, {
    name: WORKSPACE_NAME,
  });
  if (!createRes.ok) {
    throw new Error(`Workspace create failed (${createRes.status}): ${JSON.stringify(createRes.body).slice(0, 400)}`);
  }

  const created = (createRes.body as { data?: { workspace?: WorkspaceSummary } }).data?.workspace;
  if (!created?.id) throw new Error('Workspace create response missing workspace id');
  bump(counters.created, 'workspaces');
  return created;
}

async function setWorkspaceStartDate(session: ShipSession, workspaceId: string): Promise<string> {
  const target = new Date();
  target.setUTCMonth(target.getUTCMonth() - 3);
  const mondayIso = toMondayIsoDate(target);

  if (DRY_RUN) return mondayIso;

  const patchRes = await requestWithCsrf(
    'PATCH',
    `${BASE_URL}/api/admin/workspaces/${workspaceId}`,
    session,
    { sprintStartDate: mondayIso },
  );
  if (!patchRes.ok) {
    throw new Error(
      `Failed to set sprintStartDate (${patchRes.status}): ${JSON.stringify(patchRes.body).slice(0, 300)}`,
    );
  }
  return mondayIso;
}

async function switchWorkspace(session: ShipSession, workspaceId: string): Promise<void> {
  if (DRY_RUN) return;
  const switchRes = await requestWithCsrf(
    'POST',
    `${BASE_URL}/api/workspaces/${workspaceId}/switch`,
    session,
    {},
  );
  if (!switchRes.ok) {
    throw new Error(`Workspace switch failed (${switchRes.status}): ${JSON.stringify(switchRes.body).slice(0, 300)}`);
  }
}

async function listPeople(session: ShipSession): Promise<PersonRecord[]> {
  const res = await fetchJson(`${BASE_URL}/api/team/people?includeArchived=true`, session);
  if (!res.ok) throw new Error(`Failed to list people (${res.status})`);
  return Array.isArray(res.body) ? (res.body as PersonRecord[]) : [];
}

async function ensurePeople(session: ShipSession, manifest: SeedManifest): Promise<Map<string, PersonRecord>> {
  if (DRY_RUN) {
    const dryResult = new Map<string, PersonRecord>();
    for (const person of manifest.people) {
      dryResult.set(person.key, {
        id: `dry-person-${person.key}`,
        name: person.name,
        email: person.email,
      });
      bump(counters.created, 'people');
    }
    return dryResult;
  }

  const existing = await listPeople(session);
  const byName = new Map(existing.map((p) => [p.name, p]));
  const result = new Map<string, PersonRecord>();

  for (const person of manifest.people) {
    const existingPerson = byName.get(person.name);
    if (existingPerson) {
      result.set(person.key, existingPerson);
      bump(counters.skipped, 'people');
      continue;
    }

    const createRes = await requestWithCsrf('POST', `${BASE_URL}/api/documents`, session, {
      document_type: 'person',
      title: person.name,
      visibility: 'workspace',
      properties: {
        email: person.email,
        role: person.role,
        synthetic_dataset: true,
        use_case: person.useCase,
      },
    });

    if (!createRes.ok) {
      bump(counters.failed, 'people');
      continue;
    }

    const doc = createRes.body as { id: string; title: string };
    const createdPerson: PersonRecord = { id: doc.id, name: doc.title, email: person.email };
    result.set(person.key, createdPerson);
    byName.set(person.name, createdPerson);
    bump(counters.created, 'people');
    await sleep(DELAY_MS);
  }
  return result;
}

async function listPrograms(session: ShipSession): Promise<ProgramRecord[]> {
  const res = await fetchJson(`${BASE_URL}/api/programs`, session);
  if (!res.ok) throw new Error(`Failed to list programs (${res.status})`);
  return Array.isArray(res.body) ? (res.body as ProgramRecord[]) : [];
}

async function ensurePrograms(session: ShipSession, manifest: SeedManifest): Promise<Map<string, ProgramRecord>> {
  if (DRY_RUN) {
    const dryResult = new Map<string, ProgramRecord>();
    for (const program of manifest.programs) {
      dryResult.set(program.key, {
        id: `dry-program-${program.key}`,
        name: program.title,
        color: program.color,
        emoji: program.emoji,
      });
      bump(counters.created, 'programs');
    }
    return dryResult;
  }

  const existing = await listPrograms(session);
  const byName = new Map(existing.map((p) => [p.name, p]));
  const result = new Map<string, ProgramRecord>();

  for (const program of manifest.programs) {
    const existingProgram = byName.get(program.title);
    if (existingProgram) {
      result.set(program.key, existingProgram);
      bump(counters.skipped, 'programs');
      continue;
    }

    const createRes = await requestWithCsrf('POST', `${BASE_URL}/api/programs`, session, {
      title: program.title,
      color: program.color,
      emoji: program.emoji,
    });
    if (!createRes.ok) {
      bump(counters.failed, 'programs');
      continue;
    }

    const created = createRes.body as ProgramRecord;
    result.set(program.key, created);
    byName.set(program.title, created);
    bump(counters.created, 'programs');
    await sleep(DELAY_MS);
  }
  return result;
}

async function listProjects(session: ShipSession): Promise<ProjectRecord[]> {
  const res = await fetchJson(`${BASE_URL}/api/projects`, session);
  if (!res.ok) throw new Error(`Failed to list projects (${res.status})`);
  return Array.isArray(res.body) ? (res.body as ProjectRecord[]) : [];
}

async function ensureProjects(
  session: ShipSession,
  manifest: SeedManifest,
  programMap: Map<string, ProgramRecord>,
): Promise<Map<string, ProjectRecord>> {
  if (DRY_RUN) {
    const dryResult = new Map<string, ProjectRecord>();
    for (const program of manifest.programs) {
      const programRow = programMap.get(program.key);
      if (!programRow) continue;
      for (const project of program.projects) {
        const projectKey = `${program.key}:${project.key}`;
        dryResult.set(projectKey, {
          id: `dry-project-${projectKey}`,
          title: project.title,
          program_id: programRow.id,
        });
        bump(counters.created, 'projects');
      }
    }
    return dryResult;
  }

  const existing = await listProjects(session);
  const byTitle = new Map(existing.map((p) => [p.title, p]));
  const result = new Map<string, ProjectRecord>();

  for (const program of manifest.programs) {
    const programRow = programMap.get(program.key);
    if (!programRow) continue;

    for (const project of program.projects) {
      const existingProject = byTitle.get(project.title);
      const projectKey = `${program.key}:${project.key}`;
      if (existingProject) {
        result.set(projectKey, existingProject);
        bump(counters.skipped, 'projects');
        continue;
      }

      const targetDate = new Date();
      targetDate.setUTCDate(targetDate.getUTCDate() + project.targetOffsetDays);

      const createRes = await requestWithCsrf('POST', `${BASE_URL}/api/projects`, session, {
        title: project.title,
        impact: project.impact,
        confidence: project.confidence,
        ease: project.ease,
        color: program.color,
        emoji: program.emoji,
        plan: project.plan,
        program_id: programRow.id,
        target_date: targetDate.toISOString(),
      });
      if (!createRes.ok) {
        bump(counters.failed, 'projects');
        continue;
      }

      const created = createRes.body as ProjectRecord;
      result.set(projectKey, created);
      byTitle.set(project.title, created);
      bump(counters.created, 'projects');
      await sleep(DELAY_MS);
    }
  }
  return result;
}

async function listProgramWeeks(session: ShipSession, programId: string): Promise<WeekRecord[]> {
  const res = await fetchJson(`${BASE_URL}/api/programs/${programId}/sprints`, session);
  if (!res.ok) throw new Error(`Failed to list weeks for program ${programId} (${res.status})`);
  const body = res.body as { weeks?: WeekRecord[] };
  return body.weeks ?? [];
}

async function ensureWeeks(
  session: ShipSession,
  manifest: SeedManifest,
  programMap: Map<string, ProgramRecord>,
  currentSprintNumber: number,
): Promise<Map<string, WeekRecord>> {
  if (DRY_RUN) {
    const dryResult = new Map<string, WeekRecord>();
    for (const program of manifest.programs) {
      if (!programMap.get(program.key)) continue;
      for (const offset of [-1, 0, 1] as const) {
        const sprintNumber = currentSprintNumber + offset;
        if (sprintNumber < 1) continue;
        const mapKey = `${program.key}:${sprintNumber}`;
        dryResult.set(mapKey, {
          id: `dry-week-${mapKey}`,
          sprint_number: sprintNumber,
          name: `${MARKER} Week ${sprintNumber} ${program.useCase}`,
        });
        bump(counters.created, 'weeks');
      }
    }
    return dryResult;
  }

  const result = new Map<string, WeekRecord>();

  for (const program of manifest.programs) {
    const programRow = programMap.get(program.key);
    if (!programRow) continue;
    const existingWeeks = await listProgramWeeks(session, programRow.id);
    const byNumber = new Map(existingWeeks.map((w) => [w.sprint_number, w]));

    for (const offset of [-1, 0, 1] as const) {
      const sprintNumber = currentSprintNumber + offset;
      if (sprintNumber < 1) continue;
      const mapKey = `${program.key}:${sprintNumber}`;
      const found = byNumber.get(sprintNumber);
      if (found) {
        result.set(mapKey, found);
        bump(counters.skipped, 'weeks');
        continue;
      }

      const title = `${MARKER} Week ${sprintNumber} ${program.useCase}`;
      const planText = `${program.useCase} synthetic hypothesis for week ${sprintNumber}`;
      const criteria = [
        'State transitions are visible in week dashboards.',
        'Approvals and review status are testable in HITL runs.',
      ];

      const createRes = await requestWithCsrf('POST', `${BASE_URL}/api/weeks`, session, {
        program_id: programRow.id,
        title,
        sprint_number: sprintNumber,
        plan: planText,
        success_criteria: criteria,
        confidence: offset < 0 ? 90 : offset === 0 ? 72 : 58,
      });

      if (!createRes.ok) {
        bump(counters.failed, 'weeks');
        continue;
      }

      const created = createRes.body as WeekRecord;
      result.set(mapKey, created);
      byNumber.set(sprintNumber, created);
      bump(counters.created, 'weeks');
      await sleep(DELAY_MS);
    }
  }

  return result;
}

async function listIssuesForProgram(session: ShipSession, programId: string): Promise<IssueRecord[]> {
  const res = await fetchJson(`${BASE_URL}/api/programs/${programId}/issues`, session);
  if (!res.ok) throw new Error(`Failed to list issues for program ${programId} (${res.status})`);
  return Array.isArray(res.body) ? (res.body as IssueRecord[]) : [];
}

async function patchIssueEstimate(session: ShipSession, issueId: string, estimateHours: number): Promise<boolean> {
  if (DRY_RUN) return true;
  const patchRes = await requestWithCsrf('PATCH', `${BASE_URL}/api/issues/${issueId}`, session, {
    estimate: estimateHours,
  });
  return patchRes.ok;
}

async function ensureIssues(
  session: ShipSession,
  manifest: SeedManifest,
  programMap: Map<string, ProgramRecord>,
  projectMap: Map<string, ProjectRecord>,
  weekMap: Map<string, WeekRecord>,
): Promise<void> {
  if (DRY_RUN) {
    for (const program of manifest.programs) {
      for (const _issue of program.issues) {
        bump(counters.created, 'issues');
      }
    }
    return;
  }

  for (const program of manifest.programs) {
    const programRow = programMap.get(program.key);
    if (!programRow) continue;

    const existing = await listIssuesForProgram(session, programRow.id);
    const byTitle = new Map(existing.map((i) => [i.title, i]));

    for (const issue of program.issues) {
      if (byTitle.has(issue.title)) {
        bump(counters.skipped, 'issues');
        continue;
      }

      const project = projectMap.get(`${program.key}:${issue.projectKey}`);
      if (!project) {
        bump(counters.failed, 'issues');
        continue;
      }

      const belongsTo: Array<{ id: string; type: 'program' | 'project' | 'sprint' }> = [
        { id: programRow.id, type: 'program' },
        { id: project.id, type: 'project' },
      ];

      if (issue.sprintOffset !== null) {
        const week = weekMap.get(`${program.key}:${sprintNumberFromOffset(session, weekMap, program.key, issue.sprintOffset)}`);
        if (week) {
          belongsTo.push({ id: week.id, type: 'sprint' });
        }
      }

      if (DRY_RUN) {
        bump(counters.created, 'issues');
        continue;
      }

      const createRes = await requestWithCsrf('POST', `${BASE_URL}/api/issues`, session, {
        title: issue.title,
        state: issue.state,
        priority: issue.priority,
        source: 'internal',
        belongs_to: belongsTo,
      });

      if (!createRes.ok) {
        bump(counters.failed, 'issues');
        continue;
      }

      const created = createRes.body as { id: string };
      const estimated = await patchIssueEstimate(session, created.id, issue.estimateHours);
      if (!estimated) {
        bump(counters.failed, 'issue-estimates');
      }
      bump(counters.created, 'issues');
      await sleep(DELAY_MS);
    }
  }
}

function sprintNumberFromOffset(
  _session: ShipSession,
  weekMap: Map<string, WeekRecord>,
  programKey: string,
  offset: -1 | 0 | 1,
): number {
  const match = [...weekMap.entries()]
    .filter(([k]) => k.startsWith(`${programKey}:`))
    .map(([, value]) => value.sprint_number)
    .sort((a, b) => a - b);
  if (match.length === 0) return 1;
  const center = match[Math.floor(match.length / 2)] ?? match[0]!;
  return center + offset;
}

async function upsertWeeklyPlan(
  session: ShipSession,
  personId: string,
  projectId: string,
  weekNumber: number,
  lines: string[] | null,
): Promise<void> {
  const createRes = await requestWithCsrf('POST', `${BASE_URL}/api/weekly-plans`, session, {
    person_id: personId,
    project_id: projectId,
    week_number: weekNumber,
  });
  if (!createRes.ok) {
    bump(counters.failed, 'weekly-plans');
    return;
  }

  const body = createRes.body as { id: string };
  if (!lines) {
    bump(counters.skipped, 'weekly-plans-content');
    return;
  }

  if (DRY_RUN) {
    bump(counters.created, 'weekly-plans');
    return;
  }

  const patchRes = await requestWithCsrf(
    'PATCH',
    `${BASE_URL}/api/documents/${body.id}/content`,
    session,
    { content: tiptapDocFromLines(lines) },
  );
  if (patchRes.ok) bump(counters.created, 'weekly-plans');
  else bump(counters.failed, 'weekly-plans');
}

async function upsertWeeklyRetro(
  session: ShipSession,
  personId: string,
  projectId: string,
  weekNumber: number,
  lines: string[] | null,
): Promise<void> {
  const createRes = await requestWithCsrf('POST', `${BASE_URL}/api/weekly-retros`, session, {
    person_id: personId,
    project_id: projectId,
    week_number: weekNumber,
  });
  if (!createRes.ok) {
    bump(counters.failed, 'weekly-retros');
    return;
  }

  const body = createRes.body as { id: string };
  if (!lines) {
    bump(counters.skipped, 'weekly-retros-content');
    return;
  }

  if (DRY_RUN) {
    bump(counters.created, 'weekly-retros');
    return;
  }

  const patchRes = await requestWithCsrf(
    'PATCH',
    `${BASE_URL}/api/documents/${body.id}/content`,
    session,
    { content: tiptapDocFromLines(lines) },
  );
  if (patchRes.ok) bump(counters.created, 'weekly-retros');
  else bump(counters.failed, 'weekly-retros');
}

async function ensureWeeklyArtifacts(
  session: ShipSession,
  people: Map<string, PersonRecord>,
  projects: Map<string, ProjectRecord>,
  currentSprintNumber: number,
): Promise<void> {
  const director = people.get('dir');
  const manager = people.get('mgr');
  const manager2 = people.get('mgr2');
  const engineer = people.get('eng');
  const engineer2 = people.get('eng2');
  const pm = people.get('pm');
  const pm2 = people.get('pm2');
  const auditor = people.get('audit');
  const qa = people.get('qa');
  const sec = people.get('sec');

  const uc1Project = projects.get('uc1:uc1-grid');
  const uc1ReviewProject = projects.get('uc1:uc1-reviews');
  const uc2Project = projects.get('uc2:uc2-proof');
  const uc2ContextProject = projects.get('uc2:uc2-context');
  const uc3Project = projects.get('uc3:uc3a');
  const uc3PortfolioProject = projects.get('uc3:uc3-portfolio');
  const uc4Project = projects.get('uc4:uc4-gates');
  const uc4AttestationProject = projects.get('uc4:uc4-attestation');

  if (
    !director
    || !manager
    || !manager2
    || !engineer
    || !engineer2
    || !pm
    || !pm2
    || !auditor
    || !qa
    || !sec
    || !uc1Project
    || !uc1ReviewProject
    || !uc2Project
    || !uc2ContextProject
    || !uc3Project
    || !uc3PortfolioProject
    || !uc4Project
    || !uc4AttestationProject
  ) {
    bump(counters.failed, 'weekly-artifacts-prereq');
    return;
  }

  // Current-week plans (two intentionally weak/missing for edge-case coverage).
  await upsertWeeklyPlan(session, director.id, uc1ReviewProject.id, currentSprintNumber, [
    'Review escalation queue for overdue approvals and assign final decision owner.',
    'Validate manager coaching notes include measurable outcome guidance.',
  ]);
  await upsertWeeklyPlan(session, manager.id, uc1Project.id, currentSprintNumber, [
    'Review all overdue accountability items and enforce escalation policy.',
    'Approve or request changes on weekly plans before Tuesday.',
  ]);
  await upsertWeeklyPlan(session, manager2.id, uc1ReviewProject.id, currentSprintNumber, [
    'Triage pending approvals older than two days and route to backup reviewer.',
  ]);
  await upsertWeeklyPlan(session, engineer.id, uc2Project.id, currentSprintNumber, [
    'Close in-progress evidence-linked issue and post standup updates daily.',
    'Attach reproducible artifact references to retro draft.',
  ]);
  await upsertWeeklyPlan(session, engineer2.id, uc2ContextProject.id, currentSprintNumber, [
    'Finish stuff.', // Intentional weak wording to emulate TC1-style ambiguity.
  ]);
  await upsertWeeklyPlan(session, pm.id, uc3Project.id, currentSprintNumber, null); // Edge: due/late plan.
  await upsertWeeklyPlan(session, pm2.id, uc3PortfolioProject.id, currentSprintNumber, [
    'Compare ICE tie-break initiatives and flag outcome drift with evidence references.',
  ]);
  await upsertWeeklyPlan(session, auditor.id, uc4Project.id, currentSprintNumber, [
    'Replay compliance probes and verify remediation closeout evidence.',
  ]);
  await upsertWeeklyPlan(session, qa.id, uc4AttestationProject.id, currentSprintNumber, [
    'Re-run misconfiguration and secret scanners, capture command output in evidence index.',
  ]);
  await upsertWeeklyPlan(session, sec.id, uc4AttestationProject.id, currentSprintNumber, [
    'Confirm attestation freshness and ensure release gate exceptions are documented.',
  ]);

  // Previous-week retros (one intentionally missing, one intentionally too short).
  await upsertWeeklyRetro(session, manager.id, uc1Project.id, currentSprintNumber - 1, [
    'Accountability review cadence improved after enforcing Monday checkpoints.',
  ]);
  await upsertWeeklyRetro(session, manager2.id, uc1ReviewProject.id, currentSprintNumber - 1, [
    'Approval SLA remained uneven; one reviewer queue exceeded threshold.',
  ]);
  await upsertWeeklyRetro(session, engineer.id, uc2Project.id, currentSprintNumber - 1, null); // Edge: missing retro.
  await upsertWeeklyRetro(session, engineer2.id, uc2ContextProject.id, currentSprintNumber - 1, [
    'Done.', // Intentional short retro for evidence quality edge case.
  ]);
  await upsertWeeklyRetro(session, pm.id, uc3Project.id, currentSprintNumber - 1, [
    'Hypothesis B was cancelled due to low confidence and poor evidence quality.',
  ]);
  await upsertWeeklyRetro(session, pm2.id, uc3PortfolioProject.id, currentSprintNumber - 1, [
    'ICE tie-break lacked explicit business rationale and delayed decision by one cycle.',
  ]);
  await upsertWeeklyRetro(session, auditor.id, uc4Project.id, currentSprintNumber - 1, [
    'Security closeout package passed reproducibility review.',
  ]);
  await upsertWeeklyRetro(session, qa.id, uc4AttestationProject.id, currentSprintNumber - 1, [
    'One scanner false positive required triage; evidence remained reproducible.',
  ]);
  await upsertWeeklyRetro(session, sec.id, uc4AttestationProject.id, currentSprintNumber - 1, [
    'Attestation file was stale at HEAD and required explicit refresh before sign-off.',
  ]);
}

async function ensureStandupsAndReviews(
  session: ShipSession,
  weekMap: Map<string, WeekRecord>,
  currentSprintNumber: number,
): Promise<void> {
  if (DRY_RUN) {
    const currentWeeks = [...weekMap.values()].filter((w) => w.sprint_number === currentSprintNumber);
    const previousWeeks = [...weekMap.values()].filter((w) => w.sprint_number === currentSprintNumber - 1);
    for (const _w of currentWeeks) {
      bump(counters.created, 'standups');
    }
    for (const _w of previousWeeks) {
      bump(counters.created, 'weekly-reviews');
    }
    return;
  }

  for (const [key, week] of weekMap.entries()) {
    if (week.sprint_number !== currentSprintNumber) continue;

    const standupsRes = await fetchJson(`${BASE_URL}/api/weeks/${week.id}/standups`, session);
    const standups = standupsRes.ok && Array.isArray(standupsRes.body) ? (standupsRes.body as Array<{ title?: string }>) : [];
    const today = new Date().toISOString().slice(0, 10);
    const standupTitle = `${MARKER} Daily Standup ${key}`;
    const already = standups.some((s) => s.title === standupTitle);

    if (already) {
      bump(counters.skipped, 'standups');
    } else {
      const createRes = await requestWithCsrf('POST', `${BASE_URL}/api/weeks/${week.id}/standups`, session, {
        title: standupTitle,
        date: today,
        content: tiptapDocFromLines([
          'Yesterday: validated synthetic approval and evidence traces.',
          'Today: execute manual HITL checks against seeded edge cases.',
          'Blockers: none.',
        ]),
      });
      if (createRes.ok) bump(counters.created, 'standups');
      else bump(counters.failed, 'standups');
    }
  }

  for (const week of weekMap.values()) {
    if (week.sprint_number !== currentSprintNumber - 1) continue;
    const existingReview = await fetchJson(`${BASE_URL}/api/weeks/${week.id}/review`, session);
    const hasReviewId = existingReview.ok && typeof existingReview.body === 'object' && existingReview.body !== null
      && Boolean((existingReview.body as { id?: string | null }).id);
    if (hasReviewId) {
      bump(counters.skipped, 'weekly-reviews');
      continue;
    }

    const postRes = await requestWithCsrf('POST', `${BASE_URL}/api/weeks/${week.id}/review`, session, {
      title: `${MARKER} Week ${week.sprint_number} Review`,
      plan_validated: true,
      content: tiptapDocFromLines([
        'Synthetic review confirms expected PRD acceptance criteria coverage.',
        'Edge-case behavior validated for missing retros and approval gaps.',
      ]),
    });
    if (postRes.ok) bump(counters.created, 'weekly-reviews');
    else bump(counters.failed, 'weekly-reviews');
  }
}

async function ensureEvidenceWiki(session: ShipSession): Promise<void> {
  if (DRY_RUN) {
    bump(counters.created, 'wiki');
    for (let i = 0; i < 5; i += 1) {
      bump(counters.created, 'wiki-children');
    }
    return;
  }

  const listRes = await fetchJson(`${BASE_URL}/api/documents?type=wiki`, session);
  if (!listRes.ok) {
    bump(counters.failed, 'wiki');
    return;
  }
  const docs = Array.isArray(listRes.body) ? (listRes.body as Array<{ id: string; title: string }>) : [];
  const byTitle = new Map(docs.map((d) => [d.title, d]));

  const rootTitle = `${MARKER} HITL Verification Dataset`;
  let rootId = byTitle.get(rootTitle)?.id;

  if (!rootId) {
    const rootRes = await requestWithCsrf('POST', `${BASE_URL}/api/documents`, session, {
      title: rootTitle,
      document_type: 'wiki',
      visibility: 'workspace',
      properties: { synthetic_dataset: true, purpose: 'hitl-verification' },
      content: tiptapDocFromLines([
        'UC1 Manager Accountability coverage included.',
        'UC2 Engineer Execution + Evidence coverage included.',
        'UC3 PM Hypothesis Validation coverage included.',
        'UC4 Compliance/Security Verification coverage included.',
      ]),
    });
    if (!rootRes.ok) {
      bump(counters.failed, 'wiki');
      return;
    }
    rootId = (rootRes.body as { id: string }).id;
    bump(counters.created, 'wiki');
  } else {
    bump(counters.skipped, 'wiki');
  }

  const children = [
    `${MARKER} PRD TC1-TC8 Coverage Map`,
    `${MARKER} USERS Persona Coverage`,
    `${MARKER} Trigger Model (Webhook + Poll) Replay Notes`,
    `${MARKER} Architecture Decisions and Risk Tradeoffs`,
    `${MARKER} UC1 Manager Accountability Evidence`,
    `${MARKER} UC2 Engineer Evidence Trace`,
    `${MARKER} UC3 Hypothesis Comparison Notes`,
    `${MARKER} UC4 Compliance Replay Checklist`,
    `${MARKER} Security and Attestation Checklist`,
    `${MARKER} Detection Latency Reproduction Log`,
    `${MARKER} Edge Case Matrix`,
  ];

  for (const title of children) {
    if (byTitle.has(title)) {
      bump(counters.skipped, 'wiki-children');
      continue;
    }
    const childRes = await requestWithCsrf('POST', `${BASE_URL}/api/documents`, session, {
      title,
      document_type: 'wiki',
      parent_id: rootId,
      visibility: 'workspace',
      properties: { synthetic_dataset: true, seeded_by: 'seed-remote-synthetic-workspace' },
      content: tiptapDocFromLines([
        'Use this page during manual HITL verification runs.',
        'Capture reviewer comments and evidence links here.',
      ]),
    });
    if (childRes.ok) bump(counters.created, 'wiki-children');
    else bump(counters.failed, 'wiki-children');
    await sleep(DELAY_MS);
  }
}

function printCounterGroup(label: string, data: Record<string, number>): void {
  const keys = Object.keys(data).sort();
  if (keys.length === 0) return;
  console.log(`\n${label}`);
  for (const key of keys) {
    console.log(`  ${key}: ${data[key]}`);
  }
}

async function main(): Promise<void> {
  if (!EMAIL || !PASSWORD) {
    console.error('Set SHIP_EMAIL and SHIP_PASSWORD environment variables.');
    process.exit(1);
  }

  console.log('Remote synthetic workspace seeding');
  console.log(`  Base URL: ${BASE_URL}`);
  console.log(`  Workspace: ${WORKSPACE_NAME}`);
  console.log(`  Dry run: ${DRY_RUN}`);
  console.log(`  Resume: ${RESUME}`);

  const manifest = buildManifest();
  const session = await login(BASE_URL, EMAIL, PASSWORD);
  console.log('Authenticated.');

  const workspace = await ensureWorkspace(session);
  const sprintStartDate = await setWorkspaceStartDate(session, workspace.id);
  await switchWorkspace(session, workspace.id);
  console.log(`Using workspace ${workspace.id} with sprintStartDate=${sprintStartDate}`);

  const people = await ensurePeople(session, manifest);
  const programs = await ensurePrograms(session, manifest);
  const projects = await ensureProjects(session, manifest, programs);

  const currentSprintNumber = sprintNumberFromStartDate(sprintStartDate);
  const weeks = await ensureWeeks(session, manifest, programs, currentSprintNumber);

  await ensureIssues(session, manifest, programs, projects, weeks);
  await ensureWeeklyArtifacts(session, people, projects, currentSprintNumber);
  await ensureStandupsAndReviews(session, weeks, currentSprintNumber);
  await ensureEvidenceWiki(session);

  console.log('\nSeed complete.');
  printCounterGroup('Created', counters.created);
  printCounterGroup('Skipped', counters.skipped);
  printCounterGroup('Failed', counters.failed);

  console.log('\nUse-case coverage');
  for (const program of manifest.programs) {
    console.log(`  ${program.useCase}: ${program.title}`);
  }
  console.log('\nEdge cases included');
  console.log('  - Overdue weekly plan');
  console.log('  - Approval gap on week review');
  console.log('  - Overdue plan approval (TC8 style)');
  console.log('  - Missing standup for active assignee (TC7 style)');
  console.log('  - Missing retro');
  console.log('  - Short/weak retro content ("Done.")');
  console.log('  - Weak weekly plan phrasing');
  console.log('  - Unassigned backlog issue');
  console.log('  - Stale blocker near sprint end (TC5 style)');
  console.log('  - Context-scoped issue prompt (TC6 style)');
  console.log('  - Missing measurable success criteria (TC3 style)');
  console.log('  - Cancelled hypothesis');
  console.log('  - Hypothesis drift and ICE tie-break uncertainty');
  console.log('  - Open security verification gap');
  console.log('  - Compliance gate requires HITL approval (TC4 style)');
  console.log('  - Missing replay instructions in evidence bundle');
  console.log('  - Secret scan failure / stale attestation signal');
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});

