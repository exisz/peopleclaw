import { randomUUID } from 'node:crypto';
import { getPrisma } from './prisma.js';

export type AgentSessionMessageRole = 'user' | 'assistant' | 'tool' | 'system';

export interface AgentSessionMessage {
  id: string;
  role: AgentSessionMessageRole;
  content: string;
  timestamp: string;
  toolName?: string;
}

export interface AgentSessionMeta {
  id: string;
  tenantId: string;
  appId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export interface AgentSessionSummary extends AgentSessionMeta {
  messageCount: number;
}

export interface AgentSessionDetail extends AgentSessionSummary {
  messages: AgentSessionMessage[];
}

const TABLE = '__agent_chat_sessions';

interface StoredAgentSession extends AgentSessionMeta {
  messages: AgentSessionMessage[];
}

function parsePayload(payload: string): StoredAgentSession | null {
  try {
    const parsed = JSON.parse(payload) as Partial<StoredAgentSession>;
    if (!parsed.id || !parsed.tenantId || !parsed.appId || !Array.isArray(parsed.messages)) return null;
    return parsed as StoredAgentSession;
  } catch {
    return null;
  }
}

function toDetail(stored: StoredAgentSession): AgentSessionDetail {
  return { ...stored, messageCount: stored.messages.length };
}

function titleFromMessage(message: string): string {
  const firstLine = message.replace(/\s+/g, ' ').trim();
  return firstLine ? firstLine.slice(0, 60) : 'New chat';
}

async function findStoredSession(tenantId: string, appId: string, sessionId: string): Promise<StoredAgentSession | null> {
  const record = await getPrisma().appStoreRecord.findFirst({
    where: { id: sessionId, tenantId, appId, table: TABLE },
  });
  return record ? parsePayload(record.payload) : null;
}

export async function createAgentSession(params: { tenantId: string; appId: string; title?: string }): Promise<AgentSessionDetail> {
  const now = new Date().toISOString();
  const session: StoredAgentSession = {
    id: randomUUID(),
    tenantId: params.tenantId,
    appId: params.appId,
    title: params.title?.trim() || 'New chat',
    createdAt: now,
    updatedAt: now,
    messages: [],
  };
  await getPrisma().appStoreRecord.create({
    data: {
      id: session.id,
      tenantId: params.tenantId,
      appId: params.appId,
      table: TABLE,
      payload: JSON.stringify(session),
    },
  });
  return toDetail(session);
}

export async function listAgentSessions(tenantId: string, appId: string): Promise<AgentSessionSummary[]> {
  const records = await getPrisma().appStoreRecord.findMany({
    where: { tenantId, appId, table: TABLE },
    orderBy: { updatedAt: 'desc' },
  });
  return records
    .map(record => parsePayload(record.payload))
    .filter((session): session is StoredAgentSession => Boolean(session))
    .map(session => ({ ...session, messageCount: session.messages.length }))
    .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
}

export async function readAgentSession(tenantId: string, appId: string, sessionId: string): Promise<AgentSessionDetail | null> {
  const stored = await findStoredSession(tenantId, appId, sessionId);
  return stored ? toDetail(stored) : null;
}

export async function appendAgentMessage(tenantId: string, appId: string, sessionId: string, message: Omit<AgentSessionMessage, 'id' | 'timestamp'> & { id?: string; timestamp?: string }): Promise<AgentSessionMessage> {
  const stored = await findStoredSession(tenantId, appId, sessionId);
  if (!stored) throw new Error('session not found');

  const nextMessage: AgentSessionMessage = {
    id: message.id ?? randomUUID(),
    role: message.role,
    content: message.content,
    timestamp: message.timestamp ?? new Date().toISOString(),
    ...(message.toolName ? { toolName: message.toolName } : {}),
  };

  const next: StoredAgentSession = {
    ...stored,
    title: stored.title === 'New chat' && nextMessage.role === 'user' ? titleFromMessage(nextMessage.content) : stored.title,
    updatedAt: nextMessage.timestamp,
    messages: [...stored.messages, nextMessage],
  };

  await getPrisma().appStoreRecord.update({
    where: { id: sessionId },
    data: { payload: JSON.stringify(next) },
  });
  return nextMessage;
}

export async function deleteAgentSession(tenantId: string, appId: string, sessionId: string): Promise<boolean> {
  const result = await getPrisma().appStoreRecord.deleteMany({
    where: { id: sessionId, tenantId, appId, table: TABLE },
  });
  return result.count > 0;
}
