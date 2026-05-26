import { pool } from '../../db/client.js';

function tiptapParagraph(text: string): unknown {
  return {
    type: 'doc',
    content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
  };
}

function tiptapHypothesisOnly(hypothesisText: string): unknown {
  return {
    type: 'doc',
    content: [
      {
        type: 'heading',
        attrs: { level: 2 },
        content: [{ type: 'text', text: 'Hypothesis' }],
      },
      {
        type: 'paragraph',
        content: [{ type: 'text', text: hypothesisText }],
      },
    ],
  };
}

export async function seedWeeklyPlan(options: {
  workspaceId: string;
  userId: string;
  text?: string;
  title?: string;
}): Promise<string> {
  const content = options.text !== undefined ? tiptapParagraph(options.text) : null;
  const result = await pool.query(
    `INSERT INTO documents (workspace_id, document_type, title, created_by, content, visibility)
     VALUES ($1, 'weekly_plan', $2, $3, $4, 'workspace')
     RETURNING id`,
    [
      options.workspaceId,
      options.title ?? 'Test Weekly Plan',
      options.userId,
      content !== null ? JSON.stringify(content) : null,
    ]
  );
  return result.rows[0].id as string;
}

export async function seedWeeklyRetro(options: {
  workspaceId: string;
  userId: string;
  text: string;
  title?: string;
}): Promise<string> {
  const result = await pool.query(
    `INSERT INTO documents (workspace_id, document_type, title, created_by, content, visibility)
     VALUES ($1, 'weekly_retro', $2, $3, $4, 'workspace')
     RETURNING id`,
    [
      options.workspaceId,
      options.title ?? 'Test Weekly Retro',
      options.userId,
      JSON.stringify(tiptapParagraph(options.text)),
    ]
  );
  return result.rows[0].id as string;
}

export async function seedStaleIssue(options: {
  workspaceId: string;
  userId: string;
  priority?: string;
  title?: string;
  staleHours?: number;
}): Promise<string> {
  const staleHours = options.staleHours ?? 25;
  const result = await pool.query(
    `INSERT INTO documents (
       workspace_id, document_type, title, created_by, properties, visibility, updated_at
     )
     VALUES ($1, 'issue', $2, $3, $4, 'workspace', NOW() - ($5 || ' hours')::interval)
     RETURNING id`,
    [
      options.workspaceId,
      options.title ?? 'Stale Test Issue',
      options.userId,
      JSON.stringify({ state: 'in_progress', priority: options.priority ?? 'high' }),
      String(staleHours),
    ]
  );
  return result.rows[0].id as string;
}

export async function seedHealthyIssue(options: {
  workspaceId: string;
  userId: string;
  title?: string;
}): Promise<string> {
  const result = await pool.query(
    `INSERT INTO documents (workspace_id, document_type, title, created_by, properties, visibility)
     VALUES ($1, 'issue', $2, $3, $4, 'workspace')
     RETURNING id`,
    [
      options.workspaceId,
      options.title ?? 'Healthy Issue',
      options.userId,
      JSON.stringify({ state: 'in_progress', priority: 'medium' }),
    ]
  );
  return result.rows[0].id as string;
}

export async function seedIssueWithOpenBlocker(options: {
  workspaceId: string;
  userId: string;
  priority?: string;
  title?: string;
  blockerText?: string;
  blockerAgeHours?: number;
}): Promise<string> {
  const result = await pool.query(
    `INSERT INTO documents (
       workspace_id, document_type, title, created_by, properties, visibility, updated_at
     )
     VALUES ($1, 'issue', $2, $3, $4, 'workspace', NOW())
     RETURNING id`,
    [
      options.workspaceId,
      options.title ?? 'Blocked Issue',
      options.userId,
      JSON.stringify({
        state: 'in_progress',
        priority: options.priority ?? 'high',
        assignee_id: options.userId,
      }),
    ]
  );
  const issueId = result.rows[0].id as string;
  const blockerAgeHours = options.blockerAgeHours ?? 25;

  await pool.query(
    `INSERT INTO issue_iterations (
       issue_id, workspace_id, status, blockers_encountered, author_id, created_at
     )
     VALUES ($1, $2, 'in_progress', $3, $4, NOW() - ($5 || ' hours')::interval)`,
    [
      issueId,
      options.workspaceId,
      options.blockerText ?? 'Waiting on platform API access before merge.',
      options.userId,
      String(blockerAgeHours),
    ]
  );

  return issueId;
}

export async function seedSprintContextForIssue(options: {
  workspaceId: string;
  userId: string;
  issueId: string;
  sprintNumber?: number;
  sprintStartOffsetDays?: number;
}): Promise<string> {
  const sprintNumber = options.sprintNumber ?? 1;
  const sprintStartOffsetDays = options.sprintStartOffsetDays ?? -5;

  await pool.query(
    `UPDATE workspaces
     SET sprint_start_date = (CURRENT_DATE + ($1 || ' days')::interval)::date
     WHERE id = $2`,
    [String(sprintStartOffsetDays), options.workspaceId]
  );

  const sprintResult = await pool.query(
    `INSERT INTO documents (
       workspace_id, document_type, title, created_by, properties, visibility
     )
     VALUES ($1, 'sprint', $2, $3, $4, 'workspace')
     RETURNING id`,
    [
      options.workspaceId,
      'FleetGraph Test Sprint',
      options.userId,
      JSON.stringify({ sprint_number: sprintNumber }),
    ]
  );
  const sprintId = sprintResult.rows[0].id as string;

  await pool.query(
    `INSERT INTO document_associations (document_id, related_id, relationship_type)
     VALUES ($1, $2, 'sprint')`,
    [options.issueId, sprintId]
  );

  return sprintId;
}

export async function seedProjectWithHypothesis(options: {
  workspaceId: string;
  userId: string;
  hypothesisText: string;
  title?: string;
}): Promise<string> {
  const result = await pool.query(
    `INSERT INTO documents (workspace_id, document_type, title, created_by, content, visibility)
     VALUES ($1, 'project', $2, $3, $4, 'workspace')
     RETURNING id`,
    [
      options.workspaceId,
      options.title ?? 'Test Project',
      options.userId,
      JSON.stringify(tiptapHypothesisOnly(options.hypothesisText)),
    ]
  );
  return result.rows[0].id as string;
}

export async function seedSprintMissingStandup(options: {
  workspaceId: string;
  userId: string;
  sprintStartOffsetDays?: number;
}): Promise<{ sprintId: string; issueId: string }> {
  const sprintStartOffsetDays = options.sprintStartOffsetDays ?? -3;

  await pool.query(
    `UPDATE workspaces
     SET sprint_start_date = (CURRENT_DATE + ($1 || ' days')::interval)::date
     WHERE id = $2`,
    [String(sprintStartOffsetDays), options.workspaceId]
  );

  const sprintResult = await pool.query(
    `INSERT INTO documents (
       workspace_id, document_type, title, created_by, properties, visibility
     )
     VALUES ($1, 'sprint', $2, $3, $4, 'workspace')
     RETURNING id`,
    [
      options.workspaceId,
      'Active Sprint Missing Standup',
      options.userId,
      JSON.stringify({ sprint_number: 1, owner_id: options.userId }),
    ]
  );
  const sprintId = sprintResult.rows[0].id as string;

  const issueResult = await pool.query(
    `INSERT INTO documents (
       workspace_id, document_type, title, created_by, properties, visibility
     )
     VALUES ($1, 'issue', $2, $3, $4, 'workspace')
     RETURNING id`,
    [
      options.workspaceId,
      'Standup Gap Issue',
      options.userId,
      JSON.stringify({
        state: 'in_progress',
        priority: 'medium',
        assignee_id: options.userId,
      }),
    ]
  );
  const issueId = issueResult.rows[0].id as string;

  await pool.query(
    `INSERT INTO document_associations (document_id, related_id, relationship_type)
     VALUES ($1, $2, 'sprint')`,
    [issueId, sprintId]
  );

  return { sprintId, issueId };
}

export async function seedSprintOverduePlanApproval(options: {
  workspaceId: string;
  userId: string;
  sprintStartOffsetDays?: number;
}): Promise<{ sprintId: string; planId: string }> {
  const sprintStartOffsetDays = options.sprintStartOffsetDays ?? -3;

  await pool.query(
    `UPDATE workspaces
     SET sprint_start_date = (CURRENT_DATE + ($1 || ' days')::interval)::date
     WHERE id = $2`,
    [String(sprintStartOffsetDays), options.workspaceId]
  );

  const sprintResult = await pool.query(
    `INSERT INTO documents (
       workspace_id, document_type, title, created_by, properties, visibility
     )
     VALUES ($1, 'sprint', $2, $3, $4, 'workspace')
     RETURNING id`,
    [
      options.workspaceId,
      'Sprint Pending Plan Approval',
      options.userId,
      JSON.stringify({ sprint_number: 1, owner_id: options.userId, plan_approval: null }),
    ]
  );
  const sprintId = sprintResult.rows[0].id as string;

  const planResult = await pool.query(
    `INSERT INTO documents (
       workspace_id, document_type, title, created_by, content, properties, visibility
     )
     VALUES ($1, 'weekly_plan', $2, $3, $4, $5, 'workspace')
     RETURNING id`,
    [
      options.workspaceId,
      'Submitted Weekly Plan',
      options.userId,
      JSON.stringify(
        tiptapParagraph(
          'Deliver onboarding improvements with measurable weekly active user lift and documented QA evidence.'
        )
      ),
      JSON.stringify({ week_number: 1, person_id: options.userId }),
    ]
  );
  const planId = planResult.rows[0].id as string;

  return { sprintId, planId };
}
