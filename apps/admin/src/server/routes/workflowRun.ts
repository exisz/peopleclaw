/**
 * POST /api/workflows/:id/run — PLANET-1069
 * One-shot workflow execution with SSE streaming.
 * Does NOT create a Case record — this is a direct "run now" for the editor.
 */
import { Router } from 'express';
import { nanoid } from 'nanoid';
import { getPrisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireTenant, type TenantedRequest } from '../middleware/tenant.js';
import { handlers } from '../engine/handlers/index.js';
import type { HandlerContext } from '../engine/executor.js';

export const workflowRunRouter = Router();

interface WfNode {
  id: string;
  type: string;
  kind?: string;
  handler?: string;
  assignee?: string;
  name?: string;
  description?: string;
  position?: { x: number; y: number };
  config?: Record<string, unknown>;
}
interface WfDef {
  nodes: WfNode[];
  steps?: WfNode[];
  edges: Array<{ source: string; target: string }>;
}

function parseDef(s: string): WfDef {
  try {
    const v = JSON.parse(s);
    if (v?.nodes || v?.steps) {
      // Normalise: if nodes exist but lack handler/assignee, merge from steps
      if (v.steps?.length) {
        const stepMap = new Map(v.steps.map((s: WfNode) => [s.id, s]));
        if (!v.nodes || v.nodes.length === 0) {
          v.nodes = v.steps;
        } else {
          // Merge handler/assignee from steps into nodes
          v.nodes = v.nodes.map((n: WfNode) => {
            const step = stepMap.get(n.id) as WfNode | undefined;
            if (step && !n.handler && !n.assignee) {
              return { ...n, handler: step.assignee ?? step.handler, assignee: step.assignee ?? step.handler, name: step.name };
            }
            return n;
          });
        }
      }
      return v as WfDef;
    }
  } catch { /* */ }
  return { nodes: [], edges: [] };
}

function resolveHandlerKey(node: WfNode): string {
  const cfgHandler =
    node.config && typeof node.config.handler === 'string' ? node.config.handler : undefined;
  return node.handler ?? node.assignee ?? cfgHandler ?? node.type;
}

/** Ordered list of nodes from first to last via edges (linear chain assumed). */
function orderedNodes(def: WfDef): WfNode[] {
  if (!def.nodes.length) return [];
  // If no edges defined, return nodes in array order (steps-style definition)
  if (!def.edges || def.edges.length === 0) return def.nodes;
  const targetSet = new Set(def.edges.map((e) => e.target));
  const rootNode = def.nodes.find((n) => !targetSet.has(n.id)) ?? def.nodes[0];
  const edgeMap = new Map(def.edges.map((e) => [e.source, e.target]));
  const ordered: WfNode[] = [];
  const visited = new Set<string>();
  let cur: string | undefined = rootNode.id;
  while (cur && !visited.has(cur)) {
    const node = def.nodes.find((n) => n.id === cur);
    if (!node) break;
    ordered.push(node);
    visited.add(cur);
    cur = edgeMap.get(cur);
  }
  return ordered;
}

workflowRunRouter.post(
  '/workflows/:id/run',
  requireAuth,
  requireTenant,
  async (req, res) => {
    const r = req as unknown as TenantedRequest;
    const prisma = getPrisma();
    const wf = await prisma.workflow.findUnique({ where: { id: req.params.id } });
    if (!wf) {
      res.status(404).json({ error: 'workflow not found' });
      return;
    }

    // Initial payload — may be provided in request body
    const initPayload: Record<string, unknown> = req.body?.payload ?? {};
    const runId = nanoid(12);

    // Set up SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    const send = (event: string, data: unknown) => {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (typeof (res as any).flush === 'function') (res as any).flush();
    };

    const def = parseDef(wf.definition);
    const nodes = orderedNodes(def);

    send('start', { runId, totalSteps: nodes.length });

    const stepResults: Array<{
      stepId: string;
      stepType: string;
      status: 'success' | 'error' | 'skipped';
      output: Record<string, unknown>;
      error?: string;
      durationMs: number;
    }> = [];

    let context: Record<string, unknown> = { ...initPayload };
    let finalOutput: Record<string, unknown> = {};
    let shopifyProductUrl: string | null = null;

    for (const node of nodes) {
      const handlerKey = resolveHandlerKey(node);
      const handler = handlers[handlerKey];

      send('step:start', { stepId: node.id, stepType: node.type, handler: handlerKey });

      if (!handler) {
        const result = {
          stepId: node.id,
          stepType: node.type,
          status: 'error' as const,
          output: { error: `NoHandler:${handlerKey}` },
          error: `No handler registered for "${handlerKey}"`,
          durationMs: 0,
        };
        stepResults.push(result);
        send('step:done', result);
        send('run:error', { runId, failedStep: node.id, error: result.error, steps: stepResults });
        res.end();
        return;
      }

      const ctx: HandlerContext = {
        userId: r.user.id,
        tenantId: r.tenant.id,
        caseId: `run:${runId}`,
        workflowId: wf.id,
        stepConfig: node.config ?? {},
      };

      const t0 = Date.now();
      try {
        const result = await handler({ payload: context }, ctx);
        const durationMs = Date.now() - t0;

        if (result.status === 'failed') {
          const row = {
            stepId: node.id,
            stepType: node.type,
            status: 'error' as const,
            output: result.output ?? {},
            error: result.error ?? 'Step failed',
            durationMs,
          };
          stepResults.push(row);
          send('step:done', row);
          send('run:error', { runId, failedStep: node.id, error: row.error, steps: stepResults });
          res.end();
          return;
        }

        // Merge output into context
        context = { ...context, ...(result.output ?? {}) };
        finalOutput = context;

        // Capture Shopify product URL if available
        if (result.output?.productAdminUrl) {
          shopifyProductUrl = result.output.productAdminUrl as string;
        }

        const row = {
          stepId: node.id,
          stepType: node.type,
          status: 'success' as const,
          output: result.output ?? {},
          durationMs,
        };
        stepResults.push(row);
        send('step:done', row);
      } catch (e) {
        const durationMs = Date.now() - t0;
        const errMsg = e instanceof Error ? e.message : String(e);
        const row = {
          stepId: node.id,
          stepType: node.type,
          status: 'error' as const,
          output: { error: errMsg },
          error: errMsg,
          durationMs,
        };
        stepResults.push(row);
        send('step:done', row);
        send('run:error', { runId, failedStep: node.id, error: errMsg, steps: stepResults });
        res.end();
        return;
      }
    }

    send('run:complete', {
      runId,
      steps: stepResults,
      finalOutput,
      shopifyProductUrl,
    });
    res.end();
  },
);
