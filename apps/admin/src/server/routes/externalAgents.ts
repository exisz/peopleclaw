import { Router } from 'express';
import type { ToolCall } from '@mariozechner/pi-ai';
import { getPrisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireTenant, type TenantedRequest } from '../middleware/tenant.js';
import { requireExternalAgent, type ExternalAgentRequest } from '../middleware/externalAgentAuth.js';
import { createExternalAgentToken, publicExternalAgentKey } from '../lib/externalAgentTokens.js';
import { evaluateExternalAgentOperation, normalizeExternalAgentScopes, EXTERNAL_AGENT_SCOPES, EXTERNAL_AGENT_OPERATION_POLICIES } from '../lib/externalAgentSafety.js';
import { appAgentTools, buildAppAgentToolResult, buildDryRunToolResult, executeAppAgentOperation, executeAppAgentTool, type AppAgentToolContext } from '../lib/appAgentTools.js';
import { appendAgentMessage, createAgentSession, readAgentSession } from '../lib/agentSessions.js';
import { streamCodexAgent, type CodexAgentEvent } from '../lib/codexAgent.js';

export const externalAgentsRouter = Router();

externalAgentsRouter.get('/external-agent-keys', requireAuth, requireTenant, async (req, res) => {
  const r = req as unknown as TenantedRequest;
  const records = await getPrisma().externalAgentKey.findMany({
    where: { tenantId: r.tenant.id },
    include: { app: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ keys: records.map(publicExternalAgentKey) });
});

externalAgentsRouter.post('/external-agent-keys', requireAuth, requireTenant, async (req, res) => {
  const r = req as unknown as TenantedRequest;
  const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
  if (!name) {
    res.status(400).json({ error: 'name is required' });
    return;
  }
  let scopes;
  try {
    scopes = normalizeExternalAgentScopes(req.body?.scopes);
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : String(error), allowedScopes: EXTERNAL_AGENT_SCOPES });
    return;
  }

  const prisma = getPrisma();
  const appId = typeof req.body?.appId === 'string' && req.body.appId.trim() ? req.body.appId.trim() : null;
  if (appId) {
    const app = await prisma.app.findFirst({ where: { id: appId, tenantId: r.tenant.id }, select: { id: true } });
    if (!app) {
      res.status(404).json({ error: 'app not found for current tenant' });
      return;
    }
  }

  const tokenParts = createExternalAgentToken();
  const record = await prisma.externalAgentKey.create({
    data: {
      tenantId: r.tenant.id,
      appId,
      name,
      prefix: tokenParts.prefix,
      tokenHash: tokenParts.tokenHash,
      scopes: JSON.stringify(scopes),
      createdByUserId: r.user.id,
    },
    include: { app: { select: { id: true, name: true } } },
  });
  res.status(201).json({
    key: publicExternalAgentKey(record),
    token: tokenParts.token,
    tokenHint: 'Store this token now. PeopleClaw only stores a hash and cannot reveal it again.',
  });
});

externalAgentsRouter.delete('/external-agent-keys/:id', requireAuth, requireTenant, async (req, res) => {
  const r = req as unknown as TenantedRequest;
  const prisma = getPrisma();
  const record = await prisma.externalAgentKey.findFirst({ where: { id: req.params.id, tenantId: r.tenant.id } });
  if (!record) {
    res.status(404).json({ error: 'external agent key not found' });
    return;
  }
  const revoked = await prisma.externalAgentKey.update({
    where: { id: record.id },
    data: { revokedAt: record.revokedAt ?? new Date() },
  });
  res.json({ key: publicExternalAgentKey(revoked) });
});

externalAgentsRouter.get('/external-agent/whoami', requireExternalAgent('whoami'), async (req, res) => {
  const r = req as ExternalAgentRequest;
  res.json({ externalAgent: r.externalAgent });
});

externalAgentsRouter.post('/external-agent/safety/check', requireExternalAgent('whoami'), async (req, res) => {
  const r = req as ExternalAgentRequest;
  const operation = typeof req.body?.operation === 'string' ? req.body.operation : '';
  const decision = evaluateExternalAgentOperation({
    operation,
    scopes: r.externalAgent.scopes,
    dryRun: Boolean(req.body?.dryRun),
    confirmed: Boolean(req.body?.confirmed),
  });
  res.status(decision.allowed ? 200 : 403).json({ decision });
});

externalAgentsRouter.get('/external-agent/safety/policy', requireExternalAgent('whoami'), async (_req, res) => {
  res.json({ allowedScopes: EXTERNAL_AGENT_SCOPES, operations: EXTERNAL_AGENT_OPERATION_POLICIES });
});

function currentExternalAgent(req: unknown) {
  return (req as ExternalAgentRequest).externalAgent;
}

async function requireExternalApp(req: unknown, res: any, appId: string) {
  const agent = currentExternalAgent(req);
  if (agent.appId && agent.appId !== appId) {
    res.status(403).json({ error: 'external agent key is scoped to a different app' });
    return null;
  }
  const app = await getPrisma().app.findFirst({
    where: { id: appId, tenantId: agent.tenantId },
    select: { id: true, tenantId: true, name: true, description: true, createdAt: true, updatedAt: true },
  });
  if (!app) {
    res.status(404).json({ error: 'app not found for external agent tenant' });
    return null;
  }
  return app;
}

function publicApp(app: { id: string; name: string; description: string | null; createdAt: Date; updatedAt: Date }) {
  return {
    id: app.id,
    name: app.name,
    description: app.description,
    createdAt: app.createdAt.toISOString(),
    updatedAt: app.updatedAt.toISOString(),
  };
}

function publicComponent(component: any) {
  return {
    id: component.id,
    name: component.name,
    type: component.type,
    runtime: component.runtime,
    icon: component.icon ?? null,
    canvasX: component.canvasX,
    canvasY: component.canvasY,
    isExported: component.isExported,
    hasInputSchema: Boolean(component.inputSchema),
    hasOutputSchema: Boolean(component.outputSchema),
    sourceLength: typeof component.code === 'string' ? component.code.length : 0,
    createdAt: component.createdAt?.toISOString?.() ?? component.createdAt,
    updatedAt: component.updatedAt?.toISOString?.() ?? component.updatedAt,
  };
}

function actionArgs(input: unknown): Record<string, unknown> {
  if (input === undefined || input === null) return {};
  if (typeof input !== 'object' || Array.isArray(input)) throw new Error('args must be an object');
  return input as Record<string, unknown>;
}

function actionStatus(reason: string | undefined): number {
  return reason === 'missing_scope' || reason === 'denylisted_operation' ? 403 : 400;
}

externalAgentsRouter.get('/external-agent/apps', requireExternalAgent('list_apps'), async (req, res) => {
  const agent = currentExternalAgent(req);
  const apps = await getPrisma().app.findMany({
    where: { tenantId: agent.tenantId, ...(agent.appId ? { id: agent.appId } : {}) },
    orderBy: { createdAt: 'desc' },
    select: { id: true, name: true, description: true, createdAt: true, updatedAt: true },
  });
  res.json({ apps: apps.map(publicApp), externalAgent: { keyId: agent.keyId, appId: agent.appId, scopes: agent.scopes } });
});

externalAgentsRouter.get('/external-agent/apps/:appId', requireExternalAgent('inspect_app'), async (req, res) => {
  const app = await requireExternalApp(req, res, req.params.appId);
  if (!app) return;
  const prisma = getPrisma();
  const [components, connections, scheduledTaskCount, storeRecordCount] = await Promise.all([
    prisma.component.findMany({ where: { appId: app.id }, orderBy: { createdAt: 'asc' } }),
    prisma.componentConnection.findMany({ where: { appId: app.id }, orderBy: { createdAt: 'asc' } }),
    prisma.scheduledTask.count({ where: { appId: app.id } }),
    prisma.appStoreRecord.count({ where: { tenantId: app.tenantId, appId: app.id } }),
  ]);
  res.json({
    app: publicApp(app),
    components: components.map(publicComponent),
    connections: connections.map((connection) => ({
      id: connection.id,
      fromComponentId: connection.fromComponentId,
      toComponentId: connection.toComponentId,
      type: connection.type,
      createdAt: connection.createdAt.toISOString(),
    })),
    counts: { components: components.length, connections: connections.length, scheduledTasks: scheduledTaskCount, appStoreRecords: storeRecordCount },
    safety: { rawSql: false, secretsPlaintext: false, tenantScoped: true },
  });
});

externalAgentsRouter.post('/external-agent/apps/:appId/action', requireExternalAgent('whoami'), async (req, res) => {
  const agent = currentExternalAgent(req);
  const app = await requireExternalApp(req, res, req.params.appId);
  if (!app) return;
  const operation = typeof req.body?.operation === 'string' ? req.body.operation.trim() : '';
  if (!operation) {
    res.status(400).json({ error: 'operation is required' });
    return;
  }
  if (!appAgentTools.some((tool) => tool.name === operation)) {
    res.status(400).json({ error: `unsupported external agent action: ${operation}`, allowedOperations: appAgentTools.map((tool) => tool.name) });
    return;
  }

  let args: Record<string, unknown>;
  try {
    args = actionArgs(req.body?.args);
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : String(error) });
    return;
  }

  const dryRun = req.body?.dryRun === undefined ? true : Boolean(req.body.dryRun);
  const confirmed = Boolean(req.body?.confirmed);
  const decision = evaluateExternalAgentOperation({ operation, scopes: agent.scopes, dryRun, confirmed });
  if (!decision.allowed) {
    res.status(actionStatus(decision.reason)).json({ ok: false, decision });
    return;
  }

  const audit = { keyId: agent.keyId, tenantId: agent.tenantId, appId: app.id, operation, dryRun: decision.dryRun, confirmed, ts: new Date().toISOString() };
  if (decision.dryRun && decision.confirmRequired) {
    const result = buildDryRunToolResult(operation, args);
    res.json({ ok: true, decision, audit, action: result });
    return;
  }

  const action = await executeAppAgentOperation({ tenantId: agent.tenantId, appId: app.id }, operation, args);
  res.status(action.message.isError ? 400 : 200).json({ ok: !action.message.isError, decision, audit, action });
});

externalAgentsRouter.post('/external-agent/apps/:appId/chat', requireExternalAgent('whoami'), async (req, res) => {
  const agent = currentExternalAgent(req);
  const app = await requireExternalApp(req, res, req.params.appId);
  if (!app) return;
  const message = typeof req.body?.message === 'string' ? req.body.message.trim() : '';
  if (!message) {
    res.status(400).json({ error: 'message is required' });
    return;
  }

  const confirmed = Boolean(req.body?.confirmed);
  const dryRun = req.body?.dryRun === undefined ? !confirmed : Boolean(req.body.dryRun);
  const decision = evaluateExternalAgentOperation({ operation: 'external_agent_chat', scopes: agent.scopes, dryRun, confirmed });
  if (!decision.allowed) {
    res.status(actionStatus(decision.reason)).json({ ok: false, decision });
    return;
  }

  let sessionId = typeof req.body?.sessionId === 'string' ? req.body.sessionId.trim() : '';
  if (!sessionId && typeof req.body?.threadId === 'string') sessionId = req.body.threadId.trim();
  let session = sessionId ? await readAgentSession(agent.tenantId, app.id, sessionId) : null;
  if (!session) {
    session = await createAgentSession({ tenantId: agent.tenantId, appId: app.id, title: typeof req.body?.title === 'string' ? req.body.title : undefined });
  }

  const events: CodexAgentEvent[] = [];
  const audit = { keyId: agent.keyId, tenantId: agent.tenantId, appId: app.id, sessionId: session.id, dryRun: decision.dryRun, confirmed, ts: new Date().toISOString() };
  const storedUserMessage = await appendAgentMessage(agent.tenantId, app.id, session.id, { role: 'user', content: message });

  if (decision.dryRun && !confirmed) {
    const response = 'Dry run only: no app agent model call or app mutation was executed. Re-run with confirmed=true and dryRun=false to let the App Agent act.';
    await appendAgentMessage(agent.tenantId, app.id, session.id, { role: 'assistant', content: response });
    events.push({ type: 'done', content: response });
    res.json({ ok: true, app: publicApp(app), sessionId: session.id, threadId: session.id, response, events, actions: [], audit, storedUserMessage });
    return;
  }

  const executeExternalTool = async (ctx: AppAgentToolContext, toolCall: ToolCall) => {
    const toolArgs = actionArgs((toolCall as any).arguments);
    const toolDecision = evaluateExternalAgentOperation({ operation: toolCall.name, scopes: agent.scopes, dryRun, confirmed });
    if (!toolDecision.allowed) {
      return buildAppAgentToolResult(toolCall.id, toolCall.name, toolDecision.message, { ok: false, decision: toolDecision }, true);
    }
    if (toolDecision.dryRun && toolDecision.confirmRequired) {
      return buildDryRunToolResult(toolCall.name, toolArgs);
    }
    return executeAppAgentTool(ctx, toolCall);
  };

  try {
    const result = await streamCodexAgent({
      tenantId: agent.tenantId,
      appId: app.id,
      appName: app.name,
      sessionId: session.id,
      messages: [...session.messages, storedUserMessage],
      userMessage: message,
      systemPromptAddendum: [
        'You are serving an external BYO coding agent through PeopleClaw M2M APIs.',
        'Respect the external control surface: app-scoped, low-code/component tools only; no raw SQL, migrations, plaintext secrets, or cross-tenant access.',
        decision.dryRun ? 'This request is dry-run: mutating tools will be simulated and must not change the app.' : 'This request is explicitly confirmed by the token holder; still use only safe scoped tools.',
      ].join('\n'),
      executeTool: executeExternalTool,
      onEvent: (event) => events.push(event),
    });
    for (const toolResult of result.toolResults) {
      await appendAgentMessage(agent.tenantId, app.id, session.id, { role: 'tool', toolName: toolResult.toolName, content: toolResult.summary });
    }
    await appendAgentMessage(agent.tenantId, app.id, session.id, { role: 'assistant', content: result.content });
    res.json({ ok: true, app: publicApp(app), sessionId: session.id, threadId: session.id, response: result.content, events, actions: result.toolResults, audit });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    events.push({ type: 'error', message });
    res.status(500).json({ ok: false, app: publicApp(app), sessionId: session.id, threadId: session.id, error: message, events, audit });
  }
});
