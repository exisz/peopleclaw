import { Router, type Request, type Response } from 'express';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireTenant, type TenantedRequest } from '../middleware/tenant.js';
import { getPrisma } from '../lib/prisma.js';
import {
  appendAgentMessage,
  createAgentSession,
  deleteAgentSession,
  listAgentSessions,
  readAgentSession,
} from '../lib/agentSessions.js';
import { streamCodexAgent } from '../lib/codexAgent.js';
import { getCodexConnectionStatus } from '../lib/codexAuth.js';

export const agentChatRouter = Router();

async function requireTenantApp(req: Request, res: Response): Promise<{ app: { id: string; name: string }; tenantId: string } | null> {
  const r = req as unknown as TenantedRequest;
  const appId = req.params.appId;
  if (!appId) {
    res.status(400).json({ error: 'appId is required' });
    return null;
  }
  const app = await getPrisma().app.findFirst({ where: { id: appId, tenantId: r.tenant.id }, select: { id: true, name: true } });
  if (!app) {
    res.status(404).json({ error: 'app not found' });
    return null;
  }
  return { app, tenantId: r.tenant.id };
}

function sendSse(res: Response, event: string, data: unknown): void {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

agentChatRouter.get('/agent-chat/codex/status', requireAuth, (_req, res) => {
  res.json(getCodexConnectionStatus());
});

agentChatRouter.get('/apps/:appId/agent-sessions', requireAuth, requireTenant, async (req, res) => {
  const checked = await requireTenantApp(req, res);
  if (!checked) return;
  res.json(await listAgentSessions(checked.tenantId, checked.app.id));
});

agentChatRouter.post('/apps/:appId/agent-sessions', requireAuth, requireTenant, async (req, res) => {
  const checked = await requireTenantApp(req, res);
  if (!checked) return;
  const title = typeof req.body?.title === 'string' ? req.body.title : undefined;
  res.status(201).json(await createAgentSession({ tenantId: checked.tenantId, appId: checked.app.id, title }));
});

agentChatRouter.get('/apps/:appId/agent-sessions/:sessionId', requireAuth, requireTenant, async (req, res) => {
  const checked = await requireTenantApp(req, res);
  if (!checked) return;
  const session = await readAgentSession(checked.tenantId, checked.app.id, req.params.sessionId);
  if (!session) {
    res.status(404).json({ error: 'session not found' });
    return;
  }
  res.json(session);
});

agentChatRouter.delete('/apps/:appId/agent-sessions/:sessionId', requireAuth, requireTenant, async (req, res) => {
  const checked = await requireTenantApp(req, res);
  if (!checked) return;
  await deleteAgentSession(checked.tenantId, checked.app.id, req.params.sessionId);
  res.status(204).end();
});

agentChatRouter.post('/apps/:appId/agent-sessions/:sessionId/messages', requireAuth, requireTenant, async (req, res) => {
  const checked = await requireTenantApp(req, res);
  if (!checked) return;
  const session = await readAgentSession(checked.tenantId, checked.app.id, req.params.sessionId);
  if (!session) {
    res.status(404).json({ error: 'session not found' });
    return;
  }
  const message = typeof req.body?.message === 'string' ? req.body.message.trim() : '';
  if (!message) {
    res.status(400).json({ error: 'message is required' });
    return;
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  const storedUserMessage = await appendAgentMessage(checked.tenantId, checked.app.id, session.id, { role: 'user', content: message });
  try {
    const assistantContent = await streamCodexAgent({
      appId: checked.app.id,
      appName: checked.app.name,
      sessionId: session.id,
      messages: [...session.messages, storedUserMessage],
      userMessage: message,
      onEvent: event => sendSse(res, event.type, event),
    });
    await appendAgentMessage(checked.tenantId, checked.app.id, session.id, { role: 'assistant', content: assistantContent });
  } catch (e) {
    const err = e instanceof Error ? e.message : String(e);
    sendSse(res, 'error', { message: err });
  } finally {
    sendSse(res, 'done', { sessionId: session.id });
    res.end();
  }
});
