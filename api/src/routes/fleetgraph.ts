import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import {
  decideFleetGraphHitlRequest,
  executeFleetGraphRun,
  getFleetGraphMetrics,
  listFleetGraphRecentRuns,
  listFleetGraphOpenFindings,
} from '../services/fleetgraph/runtime.js';

type RouterType = ReturnType<typeof Router>;
const router: RouterType = Router();

function getWorkspaceId(req: Request): string | null {
  return req.workspaceId ?? null;
}

function getUserId(req: Request): string | null {
  return req.userId ?? null;
}

router.post('/run', authMiddleware, async (req: Request, res: Response) => {
  try {
    const workspaceId = getWorkspaceId(req);
    const userId = getUserId(req);
    if (!workspaceId || !userId) {
      res.status(401).json({ error: 'unauthorized' });
      return;
    }

    const prompt = typeof req.body?.prompt === 'string' ? req.body.prompt : undefined;
    const documentId = typeof req.body?.document_id === 'string' ? req.body.document_id : undefined;
    const documentType = typeof req.body?.document_type === 'string' ? req.body.document_type : undefined;

    const result = await executeFleetGraphRun('on_demand', {
      userId,
      workspaceId,
      documentId,
      documentType,
      prompt,
    });

    res.json(result);
  } catch (error) {
    console.error('FleetGraph on-demand run failed:', error);
    res.status(500).json({ error: 'fleetgraph_run_failed' });
  }
});

router.post('/proactive/webhook', authMiddleware, async (req: Request, res: Response) => {
  try {
    const workspaceId = getWorkspaceId(req);
    const userId = getUserId(req);
    if (!workspaceId || !userId) {
      res.status(401).json({ error: 'unauthorized' });
      return;
    }

    const documentId = typeof req.body?.document_id === 'string' ? req.body.document_id : undefined;
    const documentType = typeof req.body?.document_type === 'string' ? req.body.document_type : undefined;

    const result = await executeFleetGraphRun('proactive_webhook', {
      userId,
      workspaceId,
      documentId,
      documentType,
      prompt: 'webhook-triggered proactive scan',
    });

    res.json(result);
  } catch (error) {
    console.error('FleetGraph webhook run failed:', error);
    res.status(500).json({ error: 'fleetgraph_webhook_failed' });
  }
});

router.get('/findings', authMiddleware, async (req: Request, res: Response) => {
  try {
    const workspaceId = getWorkspaceId(req);
    if (!workspaceId) {
      res.status(401).json({ error: 'unauthorized' });
      return;
    }

    const findings = await listFleetGraphOpenFindings(workspaceId);
    res.json({ findings });
  } catch (error) {
    console.error('FleetGraph findings query failed:', error);
    res.status(500).json({ error: 'fleetgraph_findings_failed' });
  }
});

router.get('/metrics', authMiddleware, async (req: Request, res: Response) => {
  try {
    const workspaceId = getWorkspaceId(req);
    if (!workspaceId) {
      res.status(401).json({ error: 'unauthorized' });
      return;
    }

    const metrics = await getFleetGraphMetrics(workspaceId);
    res.json(metrics);
  } catch (error) {
    console.error('FleetGraph metrics query failed:', error);
    res.status(500).json({ error: 'fleetgraph_metrics_failed' });
  }
});

router.get('/traces', authMiddleware, async (req: Request, res: Response) => {
  try {
    const workspaceId = getWorkspaceId(req);
    if (!workspaceId) {
      res.status(401).json({ error: 'unauthorized' });
      return;
    }

    const runs = await listFleetGraphRecentRuns(workspaceId);
    res.json({ runs });
  } catch (error) {
    console.error('FleetGraph trace list failed:', error);
    res.status(500).json({ error: 'fleetgraph_traces_failed' });
  }
});

router.post('/hitl/:requestId/approve', authMiddleware, async (req: Request, res: Response) => {
  try {
    const workspaceId = getWorkspaceId(req);
    const userId = getUserId(req);
    if (!workspaceId || !userId) {
      res.status(401).json({ error: 'unauthorized' });
      return;
    }

    const requestId = req.params.requestId;
    if (!requestId) {
      res.status(400).json({ error: 'request_id_required' });
      return;
    }

    const note = typeof req.body?.note === 'string' ? req.body.note : undefined;

    const decision = await decideFleetGraphHitlRequest(workspaceId, requestId, userId, true, note);
    res.json(decision);
  } catch (error) {
    console.error('FleetGraph HITL approve failed:', error);
    res.status(500).json({ error: 'fleetgraph_hitl_approve_failed' });
  }
});

router.post('/hitl/:requestId/reject', authMiddleware, async (req: Request, res: Response) => {
  try {
    const workspaceId = getWorkspaceId(req);
    const userId = getUserId(req);
    if (!workspaceId || !userId) {
      res.status(401).json({ error: 'unauthorized' });
      return;
    }

    const requestId = req.params.requestId;
    if (!requestId) {
      res.status(400).json({ error: 'request_id_required' });
      return;
    }

    const note = typeof req.body?.note === 'string' ? req.body.note : undefined;

    const decision = await decideFleetGraphHitlRequest(workspaceId, requestId, userId, false, note);
    res.json(decision);
  } catch (error) {
    console.error('FleetGraph HITL reject failed:', error);
    res.status(500).json({ error: 'fleetgraph_hitl_reject_failed' });
  }
});

export default router;
