import { pool } from '../../db/client.js';
import { executeFleetGraphRun } from './runtime.js';

interface WorkspaceScanTarget {
  workspace_id: string;
  user_id: string;
}

async function loadWorkspaceScanTargets(): Promise<WorkspaceScanTarget[]> {
  const result = await pool.query<WorkspaceScanTarget>(
    `SELECT DISTINCT ON (wm.workspace_id)
       wm.workspace_id,
       wm.user_id
     FROM workspace_memberships wm
     JOIN workspaces w ON w.id = wm.workspace_id
     WHERE w.archived_at IS NULL
     ORDER BY wm.workspace_id, CASE WHEN wm.role = 'admin' THEN 0 ELSE 1 END, wm.created_at ASC`
  );

  return result.rows;
}

export async function runFleetGraphProactivePoll(): Promise<void> {
  const targets = await loadWorkspaceScanTargets();
  for (const target of targets) {
    try {
      await executeFleetGraphRun('proactive_poll', {
        userId: target.user_id,
        workspaceId: target.workspace_id,
        prompt: 'scheduled proactive scan',
      });
    } catch (error) {
      console.error('FleetGraph proactive scan failed for workspace', target.workspace_id, error);
    }
  }
}

export function startFleetGraphProactiveScheduler(): () => void {
  const pollMs = Number(process.env.FLEETGRAPH_POLL_INTERVAL_MS ?? 3 * 60 * 1000);
  const enabled = process.env.FLEETGRAPH_PROACTIVE_ENABLED === '1';

  if (!enabled) {
    return () => {};
  }

  // Execute once on startup and then on interval.
  runFleetGraphProactivePoll().catch((error) => {
    console.error('FleetGraph initial proactive scan failed:', error);
  });

  const intervalHandle = setInterval(() => {
    runFleetGraphProactivePoll().catch((error) => {
      console.error('FleetGraph scheduled proactive scan failed:', error);
    });
  }, pollMs);

  return () => clearInterval(intervalHandle);
}
