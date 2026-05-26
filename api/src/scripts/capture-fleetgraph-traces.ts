/**
 * @version 0.1.0
 * @date 2026-05-25
 * @author Monica Peters <monica.peters@gfachallenger.gauntletai.com>
 *
 * Purpose: Execute PRD FleetGraph test-case seeds and print trace URLs for documentation.
 *
 * Usage:
 *   DATABASE_URL=... pnpm --filter @ship/api exec tsx src/scripts/capture-fleetgraph-traces.ts
 */

import { config } from 'dotenv';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { executeFleetGraphRun } from '../services/fleetgraph/runtime.js';
import {
  cleanupFleetGraphTables,
  createFleetGraphTestContext,
  destroyFleetGraphTestContext,
  seedProjectWithHypothesis,
  seedIssueWithOpenBlocker,
  seedSprintMissingStandup,
  seedSprintOverduePlanApproval,
  seedStaleIssue,
  seedWeeklyPlan,
  seedWeeklyRetro,
} from '../services/fleetgraph/__tests__/fixtures.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

config({ path: join(__dirname, '../../.env.local') });
config({ path: join(__dirname, '../../.env') });

interface TraceRow {
  tc: string;
  branch: string;
  traceUrl: string;
}

async function main(): Promise<void> {
  const ctx = await createFleetGraphTestContext();
  const traces: TraceRow[] = [];

  try {
    await cleanupFleetGraphTables(ctx.workspaceId);
    await seedWeeklyPlan({ workspaceId: ctx.workspaceId, userId: ctx.userId, text: undefined });
    const tc1 = await executeFleetGraphRun('on_demand', {
      userId: ctx.userId,
      workspaceId: ctx.workspaceId,
    });
    traces.push({ tc: 'TC1', branch: tc1.run.branch, traceUrl: tc1.run.traceUrl });

    await cleanupFleetGraphTables(ctx.workspaceId);
    await seedWeeklyRetro({ workspaceId: ctx.workspaceId, userId: ctx.userId, text: 'Done.' });
    const tc2 = await executeFleetGraphRun('on_demand', {
      userId: ctx.userId,
      workspaceId: ctx.workspaceId,
    });
    traces.push({ tc: 'TC2', branch: tc2.run.branch, traceUrl: tc2.run.traceUrl });

    await cleanupFleetGraphTables(ctx.workspaceId);
    const projectId = await seedProjectWithHypothesis({
      workspaceId: ctx.workspaceId,
      userId: ctx.userId,
      hypothesisText: 'Users will complete onboarding faster with guided setup.',
    });
    const tc3 = await executeFleetGraphRun('on_demand', {
      userId: ctx.userId,
      workspaceId: ctx.workspaceId,
      documentId: projectId,
      documentType: 'project',
    });
    traces.push({ tc: 'TC3', branch: tc3.run.branch, traceUrl: tc3.run.traceUrl });

    await cleanupFleetGraphTables(ctx.workspaceId);
    const tc4 = await executeFleetGraphRun('on_demand', {
      userId: ctx.userId,
      workspaceId: ctx.workspaceId,
      prompt: 'Run compliance audit review for this gate',
    });
    traces.push({ tc: 'TC4', branch: tc4.run.branch, traceUrl: tc4.run.traceUrl });

    await cleanupFleetGraphTables(ctx.workspaceId);
    await seedIssueWithOpenBlocker({ workspaceId: ctx.workspaceId, userId: ctx.userId });
    const tc5 = await executeFleetGraphRun('proactive_webhook', {
      userId: ctx.userId,
      workspaceId: ctx.workspaceId,
    });
    traces.push({ tc: 'TC5', branch: tc5.run.branch, traceUrl: tc5.run.traceUrl });

    await cleanupFleetGraphTables(ctx.workspaceId);
    const issueId = await seedStaleIssue({
      workspaceId: ctx.workspaceId,
      userId: ctx.userId,
      title: 'Context Issue',
    });
    const tc6 = await executeFleetGraphRun('on_demand', {
      userId: ctx.userId,
      workspaceId: ctx.workspaceId,
      documentId: issueId,
      documentType: 'issue',
      prompt: 'What should happen next?',
    });
    traces.push({ tc: 'TC6', branch: tc6.run.branch, traceUrl: tc6.run.traceUrl });

    await cleanupFleetGraphTables(ctx.workspaceId);
    await seedSprintMissingStandup({ workspaceId: ctx.workspaceId, userId: ctx.userId });
    const tc7 = await executeFleetGraphRun('proactive_poll', {
      userId: ctx.userId,
      workspaceId: ctx.workspaceId,
      prompt: 'scheduled proactive scan',
    });
    traces.push({ tc: 'TC7', branch: tc7.run.branch, traceUrl: tc7.run.traceUrl });

    await cleanupFleetGraphTables(ctx.workspaceId);
    await seedSprintOverduePlanApproval({ workspaceId: ctx.workspaceId, userId: ctx.userId });
    const tc8 = await executeFleetGraphRun('proactive_webhook', {
      userId: ctx.userId,
      workspaceId: ctx.workspaceId,
      prompt: 'webhook-triggered proactive scan',
    });
    traces.push({ tc: 'TC8', branch: tc8.run.branch, traceUrl: tc8.run.traceUrl });
  } finally {
    await destroyFleetGraphTestContext(ctx);
  }

  console.log('\nFleetGraph trace capture:\n');
  for (const row of traces) {
    console.log(`${row.tc} (${row.branch}): ${row.traceUrl}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
