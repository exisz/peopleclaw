import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { randomUUID } from 'node:crypto';

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

type JsonlEntry =
  | { type: 'session'; session: AgentSessionMeta }
  | { type: 'message'; message: AgentSessionMessage };

function rootDir(): string {
  return process.env.PEOPLECLAW_AGENT_SESSIONS_DIR
    ?? (process.env.VERCEL ? path.join(os.tmpdir(), 'peopleclaw-agent-sessions') : path.join(process.cwd(), '.peopleclaw-agent-sessions'));
}

function safeSegment(value: string | number): string {
  return String(value).replace(/[^a-zA-Z0-9._-]/g, '_');
}

function appDir(tenantId: string, appId: string): string {
  return path.join(rootDir(), safeSegment(tenantId), safeSegment(appId));
}

function indexPath(tenantId: string, appId: string): string {
  return path.join(appDir(tenantId, appId), 'sessions.json');
}

function sessionFilePath(tenantId: string, appId: string, sessionId: string): string {
  return path.join(appDir(tenantId, appId), `${safeSegment(sessionId)}.jsonl`);
}

function ensureDir(dir: string): void {
  fs.mkdirSync(dir, { recursive: true });
}

function readIndex(tenantId: string, appId: string): AgentSessionMeta[] {
  try {
    return JSON.parse(fs.readFileSync(indexPath(tenantId, appId), 'utf8')) as AgentSessionMeta[];
  } catch {
    return [];
  }
}

function writeIndex(tenantId: string, appId: string, sessions: AgentSessionMeta[]): void {
  ensureDir(appDir(tenantId, appId));
  fs.writeFileSync(indexPath(tenantId, appId), JSON.stringify(sessions, null, 2));
}

function appendLine(tenantId: string, appId: string, sessionId: string, entry: JsonlEntry): void {
  fs.appendFileSync(sessionFilePath(tenantId, appId, sessionId), `${JSON.stringify(entry)}\n`);
}

function titleFromMessage(message: string): string {
  const firstLine = message.replace(/\s+/g, ' ').trim();
  return firstLine ? firstLine.slice(0, 60) : 'New chat';
}

export function createAgentSession(params: { tenantId: string; appId: string; title?: string }): AgentSessionDetail {
  const now = new Date().toISOString();
  const session: AgentSessionMeta = {
    id: randomUUID(),
    tenantId: params.tenantId,
    appId: params.appId,
    title: params.title?.trim() || 'New chat',
    createdAt: now,
    updatedAt: now,
  };
  ensureDir(appDir(params.tenantId, params.appId));
  fs.writeFileSync(sessionFilePath(params.tenantId, params.appId, session.id), `${JSON.stringify({ type: 'session', session } satisfies JsonlEntry)}\n`);
  const index = readIndex(params.tenantId, params.appId);
  index.push(session);
  writeIndex(params.tenantId, params.appId, index);
  return { ...session, messageCount: 0, messages: [] };
}

export function listAgentSessions(tenantId: string, appId: string): AgentSessionSummary[] {
  return readIndex(tenantId, appId)
    .map(meta => ({ ...meta, messageCount: readAgentSession(tenantId, appId, meta.id)?.messages.length ?? 0 }))
    .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
}

export function readAgentSession(tenantId: string, appId: string, sessionId: string): AgentSessionDetail | null {
  const file = sessionFilePath(tenantId, appId, sessionId);
  let meta = readIndex(tenantId, appId).find(s => s.id === sessionId) ?? null;
  const messages: AgentSessionMessage[] = [];
  try {
    const raw = fs.readFileSync(file, 'utf8');
    for (const line of raw.split('\n')) {
      if (!line.trim()) continue;
      const entry = JSON.parse(line) as JsonlEntry;
      if (entry.type === 'session') meta = entry.session;
      if (entry.type === 'message') messages.push(entry.message);
    }
  } catch {
    return null;
  }
  if (!meta) return null;
  return { ...meta, messageCount: messages.length, messages };
}

export function appendAgentMessage(tenantId: string, appId: string, sessionId: string, message: Omit<AgentSessionMessage, 'id' | 'timestamp'> & { id?: string; timestamp?: string }): AgentSessionMessage {
  const stored: AgentSessionMessage = {
    id: message.id ?? randomUUID(),
    role: message.role,
    content: message.content,
    timestamp: message.timestamp ?? new Date().toISOString(),
    ...(message.toolName ? { toolName: message.toolName } : {}),
  };
  appendLine(tenantId, appId, sessionId, { type: 'message', message: stored });

  const index = readIndex(tenantId, appId);
  const meta = index.find(s => s.id === sessionId);
  if (meta) {
    meta.updatedAt = stored.timestamp;
    if (meta.title === 'New chat' && stored.role === 'user') meta.title = titleFromMessage(stored.content);
    writeIndex(tenantId, appId, index);
  }
  return stored;
}

export function deleteAgentSession(tenantId: string, appId: string, sessionId: string): boolean {
  try { fs.unlinkSync(sessionFilePath(tenantId, appId, sessionId)); } catch { /* ignore */ }
  const index = readIndex(tenantId, appId);
  const next = index.filter(s => s.id !== sessionId);
  writeIndex(tenantId, appId, next);
  return next.length !== index.length;
}
