// Workflow engine: resolves next step from definition graph and dispatches handler.
import { getPrisma } from '../lib/prisma.js';
import { handlers } from './handlers/index.js';
import type { CaseStep } from '../generated/prisma/index.js';

export interface WorkflowDefinition {
  nodes: Array<{
    id: string;
    type: string;
    kind: 'auto' | 'human';
    /** Canonical handler id, e.g. "shopify.list_product". Falls back to `type` for legacy nodes. */
    handler?: string;
    config?: Record<string, unknown>;
    /** Payload fields required before this node can execute (PLANET-1260). */
    requiredFields?: string[];
  }>;
  edges: Array<{ source: string; target: string }>;
}

/** Resolve dispatch key: prefer node.handler, then config.handler, then legacy node.type. */
export function resolveHandlerKey(node: WorkflowDefinition['nodes'][number]): string {
  const cfgHandler =
    node.config && typeof node.config.handler === 'string'
      ? (node.config.handler as string)
      : undefined;
  return node.handler ?? cfgHandler ?? node.type;
}

export interface HandlerContext {
  userId: number;
  tenantId: string;
  caseId: string;
  workflowId: string;
  stepConfig: Record<string, unknown>;
}

export interface HandlerResult {
  output: Record<string, unknown>;
  status?: 'done' | 'failed';
  error?: string;
}

export function parseDef(def: string): WorkflowDefinition {
  try {
    const v = JSON.parse(def);
    if (!v?.edges) throw new Error('invalid');
    // Merge steps[] info into nodes[] when nodes lack type/kind (common in DEFAULT_WORKFLOW format)
    let nodes: WorkflowDefinition['nodes'] = v.nodes ?? [];
    if (Array.isArray(v.steps) && v.steps.length) {
      if (!nodes.length) {
        // No nodes array — derive from steps
        nodes = v.steps.map((s: Record<string, unknown>) => ({
          id: s.id as string,
          type: (s.type as string) || (s.assignee as string) || 'unknown',
          kind: (s.kind as 'auto' | 'human') || ((s.type as string)?.startsWith('human') ? 'human' : 'auto'),
          handler: (s.handler as string) || (s.assignee as string) || undefined,
          config: (s.config as Record<string, unknown>) || {},
          requiredFields: (s.requiredFields as string[]) || undefined,
        }));
      } else {
        // Nodes exist but may lack type/kind — merge from steps
        const stepMap = new Map(v.steps.map((s: Record<string, unknown>) => [s.id, s]));
        nodes = nodes.map((n: Record<string, unknown>) => {
          if (n.type && n.kind) return n as WorkflowDefinition['nodes'][number];
          const step = stepMap.get(n.id as string) as Record<string, unknown> | undefined;
          return {
            id: n.id as string,
            type: (n.type as string) || (step?.type as string) || (step?.assignee as string) || 'unknown',
            kind: (n.kind as 'auto' | 'human') || (step?.kind as 'auto' | 'human') || ((step?.type as string)?.startsWith('human') ? 'human' : 'auto'),
            handler: (n.handler as string) || (step?.handler as string) || (step?.assignee as string) || undefined,
            config: (n.config as Record<string, unknown>) || (step?.config as Record<string, unknown>) || {},
            requiredFields: (n.requiredFields as string[]) || (step?.requiredFields as string[]) || undefined,
          };
        });
      }
    }
    return { nodes, edges: v.edges } as WorkflowDefinition;
  } catch {
    return { nodes: [], edges: [] };
  }
}

function nextNodeId(def: WorkflowDefinition, fromId: string): string | null {
  const edge = def.edges.find((e) => e.source === fromId);
  return edge?.target ?? null;
}

function firstNodeId(def: WorkflowDefinition): string | null {
  if (!def.nodes.length) return null;
  const targets = new Set(def.edges.map((e) => e.target));
  const root = def.nodes.find((n) => !targets.has(n.id));
  return (root ?? def.nodes[0]).id;
}

/**
 * Drive a case forward from its currentStepId.
 * - For auto steps: invoke handler, persist CaseStep, advance to next.
 * - For human steps: create a CaseStep with status=waiting_human, set case.status=waiting_human, stop.
 * - When no next step exists: mark case status=done.
 */
export async function advanceCase(caseId: string): Promise<{ status: string; lastStepId: string | null }> {
  const prisma = getPrisma();
  const c = await prisma.case.findUnique({ where: { id: caseId }, include: { workflow: true } });
  if (!c) throw new Error(`Case not found: ${caseId}`);
  if (c.status === 'done' || c.status === 'failed' || c.status === 'cancelled' || c.status === 'awaiting_fix') {
    return { status: c.status, lastStepId: c.currentStepId };
  }

  // PLANET-1260: Clean up requiredFields meta when resuming
  {
    const pl = JSON.parse(c.payload);
    if (pl._missingFields || pl._blockedAt) {
      delete pl._missingFields;
      delete pl._blockedAt;
      c.payload = JSON.stringify(pl);
      // Reset currentStepId so workflow restarts from beginning after user fills fields
      c.currentStepId = null;
      await prisma.case.update({ where: { id: caseId }, data: { payload: c.payload, currentStepId: null } });
    }
  }

  const def = parseDef(c.workflow.definition);

  // Guard: if definition has no nodes or no entry node, fail the case immediately
  // instead of silently resolving to 'done' with 0 steps (the "fake green" bug, PLANET-1107).
  if (!def.nodes.length || firstNodeId(def) === null) {
    await prisma.case.update({
      where: { id: caseId },
      data: { status: 'failed' },
    });
    return { status: 'failed', lastStepId: null };
  }

  // PLANET-1371: Global requiredFields pre-check — ALWAYS check the first node's
  // requiredFields before ANY execution. If payload is missing required data, block.
  // This prevents AI nodes from "succeeding" with empty/garbage data.
  {
    const entryNodeId = firstNodeId(def);
    const entryNode = entryNodeId ? def.nodes.find(n => n.id === entryNodeId) : null;
    if (entryNode?.requiredFields?.length) {
      const payload = JSON.parse(c.payload);
      const missing = entryNode.requiredFields.filter((f) => {
        const val = payload[f];
        return val === undefined || val === null || val === '' || val === 0;
      });
      if (missing.length > 0) {
        await prisma.caseStep.create({
          data: {
            caseId: c.id,
            stepId: entryNode.id,
            stepType: entryNode.type,
            kind: 'auto',
            status: 'blocked',
            input: JSON.stringify({ requiredFields: entryNode.requiredFields, missingFields: missing }),
            startedAt: new Date(),
          },
        });
        const newPayload = { ...payload, _missingFields: missing, _blockedAt: entryNode.id };
        await prisma.case.update({
          where: { id: caseId },
          data: {
            status: 'waiting_human',
            currentStepId: null,
            payload: JSON.stringify(newPayload),
          },
        });
        return { status: 'waiting_human', lastStepId: entryNode.id };
      }
    }
  }

  // Determine which node to run next:
  // - if currentStepId is null → first node
  // - if resuming from waiting_review → next from currentStepId
  // - else → next from currentStepId
  let nodeId: string | null;
  if (!c.currentStepId) {
    nodeId = firstNodeId(def);
  } else {
    nodeId = nextNodeId(def, c.currentStepId);
  }

  // Execute auto steps in a loop until we hit human step or end
  let lastStepId: string | null = c.currentStepId;
  while (nodeId) {
    const node = def.nodes.find((n) => n.id === nodeId);
    if (!node) {
      await prisma.case.update({ where: { id: caseId }, data: { status: 'failed', currentStepId: nodeId } });
      return { status: 'failed', lastStepId };
    }

    // PLANET-1260: requiredFields pre-check — block if payload is missing required data
    if (node.requiredFields?.length) {
      const payload = JSON.parse(c.payload);
      const missing = node.requiredFields.filter((f) => {
        const val = payload[f];
        return val === undefined || val === null || val === '' || val === 0;
      });
      if (missing.length > 0) {
        await prisma.caseStep.create({
          data: {
            caseId: c.id,
            stepId: node.id,
            stepType: node.type,
            kind: 'auto',
            status: 'blocked',
            input: JSON.stringify({ requiredFields: node.requiredFields, missingFields: missing }),
            startedAt: new Date(),
          },
        });
        const newPayload = { ...payload, _missingFields: missing, _blockedAt: node.id };
        await prisma.case.update({
          where: { id: caseId },
          data: {
            status: 'waiting_human',
            currentStepId: node.id,
            payload: JSON.stringify(newPayload),
          },
        });
        return { status: 'waiting_human', lastStepId: node.id };
      }
    }

    const ctx: HandlerContext = {
      userId: c.ownerId,
      tenantId: c.tenantId ?? '',
      caseId: c.id,
      workflowId: c.workflowId,
      stepConfig: node.config ?? {},
    };

    if (node.kind === 'human') {
      // Create waiting_human step record
      await prisma.caseStep.create({
        data: {
          caseId: c.id,
          stepId: node.id,
          stepType: node.type,
          kind: 'human',
          status: 'waiting_human',
          startedAt: new Date(),
          input: JSON.stringify({ payload: JSON.parse(c.payload) }),
        },
      });
      await prisma.case.update({
        where: { id: caseId },
        data: { status: 'waiting_human', currentStepId: node.id },
      });
      return { status: 'waiting_human', lastStepId: node.id };
    }

    // Auto step — dispatch by canonical handler id with legacy `type` fallback
    const handlerKey = resolveHandlerKey(node);
    const handler = handlers[handlerKey];
    const stepRow = await prisma.caseStep.create({
      data: {
        caseId: c.id,
        stepId: node.id,
        stepType: node.type,
        kind: 'auto',
        status: 'running',
        startedAt: new Date(),
        input: JSON.stringify({ payload: JSON.parse(c.payload) }),
      },
    });

    if (!handler) {
      await prisma.caseStep.update({
        where: { id: stepRow.id },
        data: { status: 'failed', error: `No handler for ${handlerKey}`, completedAt: new Date() },
      });
      await prisma.case.update({ where: { id: caseId }, data: { status: 'failed', currentStepId: node.id } });
      return { status: 'failed', lastStepId: node.id };
    }

    try {
      const result = await handler({ payload: JSON.parse(c.payload) }, ctx);
      // Merge handler output back into payload so subsequent steps can use it
      const newPayload = { ...JSON.parse(c.payload), ...(result.output || {}) };
      await prisma.caseStep.update({
        where: { id: stepRow.id },
        data: {
          status: result.status ?? 'done',
          output: JSON.stringify(result.output ?? {}),
          error: result.error,
          completedAt: new Date(),
        },
      });
      await prisma.case.update({
        where: { id: caseId },
        data: { currentStepId: node.id, payload: JSON.stringify(newPayload) },
      });
      // refresh c.payload for loop
      c.payload = JSON.stringify(newPayload);
      c.currentStepId = node.id;
      lastStepId = node.id;

      if (result.status === 'failed') {
        await prisma.case.update({ where: { id: caseId }, data: { status: 'failed' } });
        return { status: 'failed', lastStepId };
      }

      // S5: auto step done — continue loop to next node (no pause)
      nodeId = nextNodeId(def, node.id);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await prisma.caseStep.update({
        where: { id: stepRow.id },
        data: { status: 'failed', error: msg, completedAt: new Date() },
      });
      await prisma.case.update({ where: { id: caseId }, data: { status: 'failed', currentStepId: node.id } });
      return { status: 'failed', lastStepId: node.id };
    }
  }

  // No more nodes — done
  await prisma.case.update({ where: { id: caseId }, data: { status: 'done' } });
  return { status: 'done', lastStepId };
}

/**
 * Submit a human step result and continue the case.
 */
export async function submitHumanStep(
  caseId: string,
  stepId: string,
  output: Record<string, unknown>,
  action?: string,
): Promise<{ status: string; lastStepId: string | null }> {
  const prisma = getPrisma();
  const step = await prisma.caseStep.findFirst({
    where: { caseId, stepId, status: 'waiting_human' },
    orderBy: { createdAt: 'desc' },
  });
  if (!step) throw new Error(`No waiting_human step for ${stepId} in case ${caseId}`);

  const finalOutput = { ...output, _action: action };
  await prisma.caseStep.update({
    where: { id: step.id },
    data: { status: 'done', output: JSON.stringify(finalOutput), completedAt: new Date() },
  });

  // Merge into payload
  const c = await prisma.case.findUnique({ where: { id: caseId } });
  if (c) {
    const merged = { ...JSON.parse(c.payload), ...output };
    await prisma.case.update({
      where: { id: caseId },
      data: { payload: JSON.stringify(merged), status: 'running' },
    });
  }

  // If user rejected, mark case cancelled
  if (action === 'reject') {
    await prisma.case.update({ where: { id: caseId }, data: { status: 'cancelled' } });
    return { status: 'cancelled', lastStepId: stepId };
  }

  return advanceCase(caseId);
}

export async function listCaseSteps(caseId: string): Promise<CaseStep[]> {
  return getPrisma().caseStep.findMany({ where: { caseId }, orderBy: { createdAt: 'asc' } });
}
