/**
 * @version 0.1.0
 * @date 2026-05-29
 * @author Monica Peters <monica.peters@gfachallenger.gauntletai.com>
 *
 * Purpose: Measure end-to-end FleetGraph detection latency from Ship state change
 * to first surfaced finding, while reporting run latency separately.
 *
 * Usage:
 *   DATABASE_URL=... pnpm --filter @ship/api exec tsx src/scripts/measure-detection-latency.ts
 */

import { cleanupFleetGraphTables, createFleetGraphTestContext, destroyFleetGraphTestContext, seedStaleIssue } from '../services/fleetgraph/__tests__/fixtures.js';
import { executeFleetGraphRun, listFleetGraphOpenFindings } from '../services/fleetgraph/runtime.js';

const POLL_INTERVAL_MS = 500;
const MAX_WAIT_MS = 60_000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function main(): Promise<void> {
  const ctx = await createFleetGraphTestContext();

  try {
    await cleanupFleetGraphTables(ctx.workspaceId);
    const issueId = await seedStaleIssue({
      workspaceId: ctx.workspaceId,
      userId: ctx.userId,
      title: 'Latency probe issue',
    });

    const eventIntroducedAtMs = Date.now();
    const eventIntroducedAtIso = new Date(eventIntroducedAtMs).toISOString();

    const runResult = await executeFleetGraphRun('proactive_webhook', {
      userId: ctx.userId,
      workspaceId: ctx.workspaceId,
      documentId: issueId,
      documentType: 'issue',
      prompt: 'latency-measurement-run',
    });

    let surfacedFindingAtIso: string | null = null;
    const deadlineMs = Date.now() + MAX_WAIT_MS;
    while (Date.now() < deadlineMs) {
      const findings = await listFleetGraphOpenFindings(ctx.workspaceId, issueId);
      const surfacedFinding = findings[0];
      if (surfacedFinding) {
        surfacedFindingAtIso = surfacedFinding.updatedAt;
        break;
      }
      await sleep(POLL_INTERVAL_MS);
    }

    if (!surfacedFindingAtIso) {
      throw new Error(`No finding surfaced within ${MAX_WAIT_MS}ms`);
    }

    const surfacedAtMs = new Date(surfacedFindingAtIso).getTime();
    const detectionLatencyMs = surfacedAtMs - eventIntroducedAtMs;

    console.log(
      JSON.stringify(
        {
          eventIntroducedAt: eventIntroducedAtIso,
          surfacedFindingAt: surfacedFindingAtIso,
          detectionLatencyMs,
          runLatencyMs: runResult.run.latencyMs,
          traceId: runResult.run.traceId,
          internalTraceUrl: runResult.run.traceUrl,
          externalTraceUrl: runResult.run.externalTraceUrl,
        },
        null,
        2
      )
    );
  } finally {
    await destroyFleetGraphTestContext(ctx);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
