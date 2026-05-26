/**
 * @version 0.1.0
 * @date 2026-05-26
 * @author Monica Peters <monica.peters@gfachallenger.gauntletai.com>
 *
 * Purpose: Seed Ship Workspace with FleetGraph PRD test-case states (TC1–TC8) and
 * USERS.md persona roles so proactive/on-demand detectors have real data to evaluate.
 *
 * Usage:
 *   pnpm --filter @ship/api db:seed
 *   pnpm --filter @ship/api db:seed:fleetgraph
 *
 * Example:
 *   DATABASE_URL=postgresql://ship:ship_dev_password@localhost:5432/ship_dev \
 *   pnpm --filter @ship/api db:seed:fleetgraph
 *
 * Dependencies: Postgres Ship schema, base db:seed workspace/users, fixture seed helpers
 *
 * Security/PHI: N/A — synthetic demo data only.
 * HIPAA: N/A — no PHI.
 * FHIR: N/A — not interoperability.
 * Accessibility: N/A — non-UI script.
 * Performance: Idempotent inserts keyed by document titles; safe to re-run.
 * Stability: Skips existing demo records; does not truncate workspace data.
 * Legal/compliance: N/A — internal demo seed data.
 */

import { config } from 'dotenv';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import { loadProductionSecrets } from '../config/ssm.js';
import {
  seedIssueWithOpenBlocker,
  seedProjectWithHypothesis,
  seedSprintContextForIssue,
  seedSprintMissingStandup,
  seedSprintOverduePlanApproval,
  seedStaleIssue,
  seedWeeklyPlan,
  seedWeeklyRetro,
} from '../services/fleetgraph/seed-helpers.js';

const { Pool } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

config({ path: join(__dirname, '../../.env.local') });
config({ path: join(__dirname, '../../.env') });

const MARKER = '[FG-PRD]';
const WORKSPACE_NAME = process.env.FLEETGRAPH_DEMO_WORKSPACE ?? 'Ship Workspace';
const PROGRAM_PREFIX = 'FGPRD';

interface UserRow {
  id: string;
  email: string;
  name: string;
  person_doc_id: string | null;
}

/** USERS.md persona mapping for FleetGraph notification routing demos. */
const PERSONA_ROLES: Array<{ email: string; fleetgraph_role: string; use_case: string }> = [
  { email: 'dev@ship.local', fleetgraph_role: 'director', use_case: 'UC1' },
  { email: 'alice.chen@ship.local', fleetgraph_role: 'manager', use_case: 'UC1' },
  { email: 'bob.martinez@ship.local', fleetgraph_role: 'manager', use_case: 'UC1' },
  { email: 'emma.johnson@ship.local', fleetgraph_role: 'engineer', use_case: 'UC2' },
  { email: 'frank.garcia@ship.local', fleetgraph_role: 'engineer', use_case: 'UC2' },
  { email: 'grace.lee@ship.local', fleetgraph_role: 'pm', use_case: 'UC3' },
  { email: 'carol.williams@ship.local', fleetgraph_role: 'pm', use_case: 'UC3' },
  { email: 'henry.patel@ship.local', fleetgraph_role: 'auditor', use_case: 'UC4' },
  { email: 'david.kim@ship.local', fleetgraph_role: 'auditor', use_case: 'UC4' },
];

async function createAssociation(
  pool: pg.Pool,
  documentId: string,
  relatedId: string,
  relationshipType: 'program' | 'project' | 'sprint',
): Promise<void> {
  await pool.query(
    `INSERT INTO document_associations (document_id, related_id, relationship_type, metadata)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (document_id, related_id, relationship_type) DO NOTHING`,
    [documentId, relatedId, relationshipType, JSON.stringify({ created_via: 'seed-fleetgraph-demo' })]
  );
}

async function documentExists(
  pool: pg.Pool,
  workspaceId: string,
  documentType: string,
  title: string,
): Promise<string | null> {
  const result = await pool.query<{ id: string }>(
    `SELECT id FROM documents
     WHERE workspace_id = $1 AND document_type = $2 AND title = $3 AND deleted_at IS NULL
     LIMIT 1`,
    [workspaceId, documentType, title]
  );
  return result.rows[0]?.id ?? null;
}

async function seedPersonaRoles(pool: pg.Pool, workspaceId: string): Promise<number> {
  let updated = 0;
  for (const persona of PERSONA_ROLES) {
    const result = await pool.query(
      `UPDATE documents
       SET properties = properties
         || jsonb_build_object('fleetgraph_role', $1::text, 'use_case', $2::text, 'users_md_persona', true)
       WHERE workspace_id = $3
         AND document_type = 'person'
         AND properties->>'email' = $4`,
      [persona.fleetgraph_role, persona.use_case, workspaceId, persona.email]
    );
    updated += result.rowCount ?? 0;
  }
  return updated;
}

async function ensureDemoProgram(
  pool: pg.Pool,
  workspaceId: string,
): Promise<string> {
  const existing = await pool.query<{ id: string }>(
    `SELECT id FROM documents
     WHERE workspace_id = $1 AND document_type = 'program' AND properties->>'prefix' = $2`,
    [workspaceId, PROGRAM_PREFIX]
  );
  if (existing.rows[0]) return existing.rows[0].id;

  const title = `${MARKER} FleetGraph PRD Evidence Program`;
  const result = await pool.query<{ id: string }>(
    `INSERT INTO documents (workspace_id, document_type, title, properties)
     VALUES ($1, 'program', $2, $3)
     RETURNING id`,
    [
      workspaceId,
      title,
      JSON.stringify({
        prefix: PROGRAM_PREFIX,
        color: '#6366f1',
        emoji: '🤖',
        purpose: 'fleetgraph_prd_demo',
        users_md_coverage: ['UC1', 'UC2', 'UC3', 'UC4'],
        prd_test_cases: ['TC1', 'TC2', 'TC3', 'TC4', 'TC5', 'TC6', 'TC7', 'TC8'],
      }),
    ]
  );
  return result.rows[0]!.id;
}

async function ensureDemoProject(
  pool: pg.Pool,
  workspaceId: string,
  programId: string,
  ownerId: string,
  tc: string,
  titleSuffix: string,
  plan: string,
): Promise<string> {
  const title = `${MARKER} ${tc} ${titleSuffix}`;
  const existing = await pool.query<{ id: string }>(
    `SELECT d.id FROM documents d
     JOIN document_associations da ON da.document_id = d.id
       AND da.related_id = $3 AND da.relationship_type = 'program'
     WHERE d.workspace_id = $1 AND d.document_type = 'project' AND d.title = $2`,
    [workspaceId, title, programId]
  );
  if (existing.rows[0]) return existing.rows[0].id;

  const result = await pool.query<{ id: string }>(
    `INSERT INTO documents (workspace_id, document_type, title, properties)
     VALUES ($1, 'project', $2, $3)
     RETURNING id`,
    [
      workspaceId,
      title,
      JSON.stringify({
        color: '#818cf8',
        emoji: '📌',
        owner_id: ownerId,
        impact: 5,
        confidence: 4,
        ease: 3,
        plan,
        fleetgraph_demo_tc: tc,
      }),
    ]
  );
  const projectId = result.rows[0]!.id;
  await createAssociation(pool, projectId, programId, 'program');
  return projectId;
}

async function seedFleetGraphDemo(): Promise<void> {
  await loadProductionSecrets();

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  });

  console.log('🌱 FleetGraph PRD demo seed');
  console.log(`   Workspace: ${WORKSPACE_NAME}`);

  try {
    const workspaceResult = await pool.query<{ id: string; sprint_start_date: string }>(
      `SELECT id, sprint_start_date::text FROM workspaces WHERE name = $1 LIMIT 1`,
      [WORKSPACE_NAME]
    );
    const workspace = workspaceResult.rows[0];
    if (!workspace) {
      throw new Error(
        `Workspace "${WORKSPACE_NAME}" not found. Run pnpm --filter @ship/api db:seed first.`
      );
    }
    const workspaceId = workspace.id;

    const usersResult = await pool.query<UserRow>(
      `SELECT u.id, u.email, u.name, d.id AS person_doc_id
       FROM users u
       JOIN workspace_memberships wm ON wm.user_id = u.id AND wm.workspace_id = $1
       LEFT JOIN documents d ON d.workspace_id = $1
         AND d.document_type = 'person'
         AND d.properties->>'user_id' = u.id::text
       ORDER BY u.email`,
      [workspaceId]
    );
    const users = usersResult.rows;
    const byEmail = new Map(users.map((u) => [u.email, u]));

    const director = byEmail.get('dev@ship.local');
    const manager = byEmail.get('alice.chen@ship.local');
    const engineer = byEmail.get('emma.johnson@ship.local');
    const pm = byEmail.get('grace.lee@ship.local');
    const auditor = byEmail.get('henry.patel@ship.local');

    if (!director || !manager || !engineer || !pm || !auditor) {
      throw new Error('Expected seeded users missing. Run db:seed before db:seed:fleetgraph.');
    }

    const rolesUpdated = await seedPersonaRoles(pool, workspaceId);
    console.log(`✅ Updated ${rolesUpdated} person documents with USERS.md FleetGraph roles`);

    const programId = await ensureDemoProgram(pool, workspaceId);
    console.log(`✅ FleetGraph demo program ready (${PROGRAM_PREFIX})`);

    const tc1Project = await ensureDemoProject(
      pool,
      workspaceId,
      programId,
      manager.id,
      'TC1',
      'Manager Accountability — Weak Weekly Plan',
      'Demonstrates planning_risk when weekly plan lacks measurable outcomes (PRD TC1 / USERS UC1).'
    );
    const tc2Project = await ensureDemoProject(
      pool,
      workspaceId,
      programId,
      engineer.id,
      'TC2',
      'Engineer Evidence — Incomplete Retro',
      'Demonstrates evidence_risk when retro lacks proof artifacts (PRD TC2 / USERS UC2).'
    );
    const tc3Project = await ensureDemoProject(
      pool,
      workspaceId,
      programId,
      pm.id,
      'TC3',
      'PM Hypothesis — Missing Success Criteria',
      'Demonstrates hypothesis_risk when hypothesis lacks measurable metrics (PRD TC3 / USERS UC3).'
    );
    const tc4Project = await ensureDemoProject(
      pool,
      workspaceId,
      programId,
      auditor.id,
      'TC4',
      'Compliance Gate — HITL Required',
      'Use on-demand chat with a compliance prompt to trigger HITL (PRD TC4 / USERS UC4).'
    );
    const tc5Project = await ensureDemoProject(
      pool,
      workspaceId,
      programId,
      manager.id,
      'TC5',
      'Execution Risk — Stale Blocker Near Sprint End',
      'Demonstrates execution_risk from open blocker + sprint deadline (PRD TC5).'
    );
    const tc6Project = await ensureDemoProject(
      pool,
      workspaceId,
      programId,
      engineer.id,
      'TC6',
      'Context Chat — Issue Scoped On-Demand',
      'Open FleetGraph from the seeded issue and ask "what should happen next?" (PRD TC6).'
    );
    const tc7Project = await ensureDemoProject(
      pool,
      workspaceId,
      programId,
      manager.id,
      'TC7',
      'Accountability — Missing Standup',
      'Demonstrates accountability_risk when assignee has no standup (PRD TC7).'
    );
    const tc8Project = await ensureDemoProject(
      pool,
      workspaceId,
      programId,
      manager.id,
      'TC8',
      'Planning — Overdue Plan Approval',
      'Demonstrates planning_risk when plan approval is pending 2+ days (PRD TC8).'
    );

    console.log('✅ Demo projects ready for TC1–TC8');

    let created = 0;
    let skipped = 0;

    // TC1 — empty weekly plan (planning_risk)
    const tc1PlanTitle = `${MARKER} TC1 Weak Weekly Plan`;
    if (await documentExists(pool, workspaceId, 'weekly_plan', tc1PlanTitle)) {
      skipped += 1;
    } else {
      await seedWeeklyPlan({
        workspaceId,
        userId: manager.id,
        text: undefined,
        title: tc1PlanTitle,
      });
      created += 1;
    }

    // TC2 — short retro (evidence_risk)
    const tc2RetroTitle = `${MARKER} TC2 Incomplete Retro`;
    if (await documentExists(pool, workspaceId, 'weekly_retro', tc2RetroTitle)) {
      skipped += 1;
    } else {
      await seedWeeklyRetro({
        workspaceId,
        userId: engineer.id,
        text: 'Done.',
        title: tc2RetroTitle,
      });
      created += 1;
    }

    // TC3 — hypothesis without success criteria (hypothesis_risk)
    const tc3ProjectTitle = `${MARKER} TC3 Hypothesis Drift Project`;
    if (await documentExists(pool, workspaceId, 'project', tc3ProjectTitle)) {
      skipped += 1;
    } else {
      const driftProjectId = await seedProjectWithHypothesis({
        workspaceId,
        userId: pm.id,
        title: tc3ProjectTitle,
        hypothesisText:
          'We believe guided onboarding will increase weekly active usage without adding support load.',
      });
      await createAssociation(pool, driftProjectId, programId, 'program');
      created += 1;
    }

    // TC4 — compliance issue anchor (HITL via prompt)
    const tc4IssueTitle = `${MARKER} TC4 Open CVE Remediation Pending Replay Evidence`;
    if (await documentExists(pool, workspaceId, 'issue', tc4IssueTitle)) {
      skipped += 1;
    } else {
      const issueResult = await pool.query<{ id: string }>(
        `INSERT INTO documents (workspace_id, document_type, title, created_by, properties, visibility)
         VALUES ($1, 'issue', $2, $3, $4, 'workspace')
         RETURNING id`,
        [
          workspaceId,
          tc4IssueTitle,
          auditor.id,
          JSON.stringify({
            state: 'in_review',
            priority: 'urgent',
            assignee_id: auditor.id,
            compliance_gate: 'security_remediation',
          }),
        ]
      );
      await createAssociation(pool, issueResult.rows[0]!.id, programId, 'program');
      await createAssociation(pool, issueResult.rows[0]!.id, tc4Project, 'project');
      created += 1;
    }

    // TC5 — stale blocker near sprint end (execution_risk)
    const tc5IssueTitle = `${MARKER} TC5 Blocked Issue Near Sprint End`;
    if (await documentExists(pool, workspaceId, 'issue', tc5IssueTitle)) {
      skipped += 1;
    } else {
      const issueId = await seedIssueWithOpenBlocker({
        workspaceId,
        userId: engineer.id,
        title: tc5IssueTitle,
        priority: 'high',
        blockerText: 'Blocked on dependency review from platform team for 30+ hours.',
        blockerAgeHours: 30,
      });
      await createAssociation(pool, issueId, programId, 'program');
      await createAssociation(pool, issueId, tc5Project, 'project');
      await seedSprintContextForIssue({
        workspaceId,
        userId: engineer.id,
        issueId,
        sprintNumber: 1,
        sprintStartOffsetDays: -6,
      });
      created += 1;
    }

    // TC6 — context-scoped stale issue
    const tc6IssueTitle = `${MARKER} TC6 Context Issue — What Should Happen Next?`;
    if (await documentExists(pool, workspaceId, 'issue', tc6IssueTitle)) {
      skipped += 1;
    } else {
      const issueId = await seedStaleIssue({
        workspaceId,
        userId: engineer.id,
        title: tc6IssueTitle,
        priority: 'high',
        staleHours: 30,
      });
      await createAssociation(pool, issueId, programId, 'program');
      await createAssociation(pool, issueId, tc6Project, 'project');
      created += 1;
    }

    // TC7 — missing standup accountability
    const tc7SprintTitle = `${MARKER} TC7 Sprint Missing Standup`;
    if (await documentExists(pool, workspaceId, 'sprint', tc7SprintTitle)) {
      skipped += 1;
    } else {
      const { sprintId, issueId } = await seedSprintMissingStandup({
        workspaceId,
        userId: engineer.id,
        sprintStartOffsetDays: -3,
      });
      await pool.query(`UPDATE documents SET title = $1 WHERE id = $2`, [tc7SprintTitle, sprintId]);
      await pool.query(`UPDATE documents SET title = $1 WHERE id = $2`, [
        `${MARKER} TC7 Standup Gap Issue`,
        issueId,
      ]);
      await createAssociation(pool, sprintId, programId, 'program');
      await createAssociation(pool, sprintId, tc7Project, 'project');
      await createAssociation(pool, issueId, programId, 'program');
      await createAssociation(pool, issueId, tc7Project, 'project');
      created += 1;
    }

    // TC8 — overdue plan approval
    const tc8SprintTitle = `${MARKER} TC8 Sprint Pending Plan Approval`;
    if (await documentExists(pool, workspaceId, 'sprint', tc8SprintTitle)) {
      skipped += 1;
    } else {
      const { sprintId, planId } = await seedSprintOverduePlanApproval({
        workspaceId,
        userId: manager.id,
        sprintStartOffsetDays: -3,
      });
      await pool.query(`UPDATE documents SET title = $1 WHERE id = $2`, [tc8SprintTitle, sprintId]);
      await pool.query(`UPDATE documents SET title = $1 WHERE id = $2`, [
        `${MARKER} TC8 Submitted Weekly Plan`,
        planId,
      ]);
      await createAssociation(pool, sprintId, programId, 'program');
      await createAssociation(pool, sprintId, tc8Project, 'project');
      created += 1;
    }

    // Wiki index for manual verification
    const wikiTitle = `${MARKER} FleetGraph PRD Verification Index`;
    if (!(await documentExists(pool, workspaceId, 'wiki', wikiTitle))) {
      const wikiContent = {
        type: 'doc',
        content: [
          {
            type: 'bulletList',
            content: [
              'TC1: Open weak weekly plan — expect planning_risk',
              'TC2: Open incomplete retro — expect evidence_risk',
              'TC3: Open hypothesis project — expect hypothesis_risk',
              'TC4: Open TC4 issue + chat "compliance gate review" — expect compliance_risk + HITL',
              'TC5: Open blocked issue — expect execution_risk (proactive webhook/poll)',
              'TC6: Open context issue + ask "what should happen next?" — issue-scoped on-demand',
              'TC7: Proactive poll — expect accountability_risk (missing standup)',
              'TC8: Proactive webhook — expect planning_risk (overdue plan approval)',
              'Personas: see USERS.md roles on person documents (director/manager/engineer/pm/auditor)',
            ].map((line) => ({
              type: 'listItem',
              content: [{ type: 'paragraph', content: [{ type: 'text', text: line }] }],
            })),
          },
        ],
      };
      await pool.query(
        `INSERT INTO documents (workspace_id, document_type, title, content, properties, visibility)
         VALUES ($1, 'wiki', $2, $3, $4, 'workspace')`,
        [
          workspaceId,
          wikiTitle,
          JSON.stringify(wikiContent),
          JSON.stringify({ fleetgraph_prd_demo: true, source: 'seed-fleetgraph-demo' }),
        ]
      );
      created += 1;
    } else {
      skipped += 1;
    }

    console.log('');
    console.log(`✅ FleetGraph demo documents created: ${created}, skipped (existing): ${skipped}`);
    console.log('');
    console.log('Manual verification (login dev@ship.local / admin123):');
    console.log(`  1. Open program "${MARKER} FleetGraph PRD Evidence Program" (${PROGRAM_PREFIX})`);
    console.log('  2. Filter issues/docs by prefix [FG-PRD]');
    console.log('  3. Run FleetGraph on-demand from TC6 issue or proactive poll for TC7/TC8');
    console.log('  4. See wiki:', wikiTitle);
    console.log('');
    console.log('Automated signoff: pnpm --filter @ship/api test -- src/services/fleetgraph/runtime.test.ts');
  } catch (error) {
    console.error('❌ FleetGraph demo seed failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

void seedFleetGraphDemo();
