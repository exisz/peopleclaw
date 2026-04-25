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
  }>;
  edges: Array<{ source: string; target: string }>;
}

/** Resolve dispatch key: prefer node.handler, then config.handler, then legacy node.type. */
function resolveHandlerKey(node: WorkflowDefinition['nodes'][number]): string {
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

function parseDef(def: string): WorkflowDefinition {
  try {
    const v = JSON.parse(def);
    if (!v?.edges) throw new Error('invalid');

    let nodes = v.nodes as WorkflowDefinition['nodes'] | undefined;
    const steps = v.steps as Array<Record<string, unknown>> | undefined;

    if ((!nodes || !nodes.length) && steps?.length) {
      // No nodes at all — derive from steps (some definitions only have steps[])
      nodes = steps.map((s) => ({
        id: s.id as string,
        type: (s.type as string) || (s.assignee as string) || 'unknown',
        kind: (s.kind as 'auto' | 'human') || 'auto',
        handler: (s.handler as string) || (s.assignee as string) || undefined,
        config: (s.config as Record<string, unknown>) || undefined,
      }));
    } else if (nodes?.length && steps?.length) {
      // Both exist — nodes might be position-only (DEFAULT_WORKFLOW pattern)
      // Merge step info into nodes when nodes lack kind/type
      const stepMap = new Map(steps.map((s) => [s.id as string, s]));
      nodes = nodes.map((n) => {
        if (n.type && n.kind) return n; // already has full info
        const step = stepMap.get(n.id);
        if (!step) return n;
        return {
          ...n,
          type: n.type || (step.type as string) || (step.assignee as string) || 'unknown',
          kind: n.kind || (step.kind as 'auto' | 'human') || 'auto',
          handler: n.handler || (step.handler as string) || (step.assignee as string) || undefined,
          config: n.config || (step.config as Record<string, unknown>) || undefined,
        };
      });
    }

    if (!nodes?.length) throw new Error('invalid');
    return { nodes, edges: v.edges };
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

  // Determine which node to run next:
  // - if currentStepId is null → first node
  // - else → next from currentStepId
  let nodeId: string | null;
  if (!c.currentStepId) {
    nodeId = firstNodeId(def);
  } else {
    nodeId = nextNodeId(def, c.currentStepId);
  }

  // PLANET-1251: Parse step mode overrides from case
  const modeOverrides: Record<string, string> = JSON.parse(c.stepModeOverrides || '{}');

  // Execute auto steps in a loop until we hit human step or end
  let lastStepId: string | null = c.currentStepId;
  while (nodeId) {
    const node = def.nodes.find((n) => n.id === nodeId);
    if (!node) {
      await prisma.case.update({ where: { id: caseId }, data: { status: 'failed', currentStepId: nodeId } });
      return { status: 'failed', lastStepId };
    }

    // PLANET-1251: resolve effective kind from override or node default
    const effectiveKind: 'auto' | 'human' = (modeOverrides[node.id] as 'auto' | 'human') || node.kind;

    const ctx: HandlerContext = {
      userId: c.ownerId,
      tenantId: c.tenantId ?? '',
      caseId: c.id,
      workflowId: c.workflowId,
      stepConfig: node.config ?? {},
    };

    if (effectiveKind === 'human') {
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

    // PLANET-1251: If overridden to auto but no handler exists, fall back to human (don't crash)
    if (!handler) {
      if (modeOverrides[node.id] === 'auto') {
        // Overridden to auto but no handler — fall back to human
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
    }

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
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await prisma.caseStep.update({
        where: { id: stepRow.id },
        data: { status: 'failed', error: msg, completedAt: new Date() },
      });
      await prisma.case.update({ where: { id: caseId }, data: { status: 'failed', currentStepId: node.id } });
      return { status: 'failed', lastStepId: node.id };
    }

    nodeId = nextNodeId(def, node.id);
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
