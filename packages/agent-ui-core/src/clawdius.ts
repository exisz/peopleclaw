import type { AgentChatMessage, AgentChatTransport, AgentSessionDetail, AgentSessionSummary, AgentStreamEvent } from './types';
import type { AgentChatFetch } from './transport';

export interface ClawdiusAgentChatTransportOptions {
  /** Gateway base path. Clawdius defaults to `/api`. */
  basePath?: string;
  /** Inject auth/tenant/tracing headers from the host app. */
  fetch?: AgentChatFetch;
}

type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord {
  return value && typeof value === 'object' ? value as UnknownRecord : {};
}

function textFromContent(content: unknown): string {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content.map(part => {
      const p = asRecord(part);
      if (p.type === 'text' && typeof p.text === 'string') return p.text;
      if (p.type === 'toolCall' && typeof p.name === 'string') return `\n🔧 ${p.name}`;
      return '';
    }).join('\n').trim();
  }
  return '';
}

function normalizeTimestamp(value: unknown): string {
  if (typeof value === 'string') return value;
  return new Date().toISOString();
}

function toMessage(raw: unknown, index: number): AgentChatMessage | null {
  const msg = asRecord(raw);
  const role = String(msg.role ?? 'assistant');
  const content = textFromContent(msg.content);
  const id = typeof msg.id === 'string' ? msg.id : `clawdius-${index}`;
  const timestamp = normalizeTimestamp(msg.timestamp);

  if (role === 'user') return { id, role: 'user', content, timestamp };
  if (role === 'assistant') return content ? { id, role: 'assistant', content, timestamp } : null;
  if (role === 'tool' || role === 'toolResult') {
    return {
      id,
      role: 'tool',
      content: content.length > 800 ? `${content.slice(0, 800)}…` : content,
      timestamp,
      toolName: typeof msg.name === 'string' ? msg.name : typeof msg.toolName === 'string' ? msg.toolName : 'tool',
    };
  }
  return null;
}

function toSummary(raw: unknown, fallbackAgentId: string): AgentSessionSummary {
  const s = asRecord(raw);
  return {
    id: String(s.id),
    appId: String(s.agentId ?? fallbackAgentId),
    title: String(s.title ?? 'New conversation'),
    createdAt: normalizeTimestamp(s.createdAt),
    updatedAt: normalizeTimestamp(s.updatedAt),
    messageCount: typeof s.messageCount === 'number' ? s.messageCount : 0,
  };
}

function toDetail(raw: unknown, fallbackAgentId: string): AgentSessionDetail {
  const s = asRecord(raw);
  const messages = Array.isArray(s.messages)
    ? s.messages.map(toMessage).filter((m): m is AgentChatMessage => Boolean(m))
    : [];
  return {
    id: String(s.id),
    appId: String(s.agentId ?? fallbackAgentId),
    title: String(s.title ?? 'New conversation'),
    createdAt: normalizeTimestamp(s.createdAt),
    updatedAt: normalizeTimestamp(s.updatedAt),
    messageCount: messages.length,
    messages,
  };
}

async function jsonOrThrow<T>(res: Response): Promise<T> {
  if (!res.ok) throw new Error(await res.text().catch(() => `HTTP ${res.status}`));
  return await res.json() as T;
}

function normalizeClawdiusEvent(event: UnknownRecord): AgentStreamEvent | null {
  if (event.type === 'message_update') {
    const assistantEvent = asRecord(event.assistantMessageEvent);
    if (assistantEvent.type === 'text_delta' && typeof assistantEvent.delta === 'string') {
      return { type: 'text_delta', text: assistantEvent.delta };
    }
  }
  if (event.type === 'tool_execution_start') {
    return { type: 'tool_start', toolName: typeof event.toolName === 'string' ? event.toolName : 'tool' };
  }
  if (event.type === 'tool_execution_end') {
    return { type: 'tool_end', toolName: typeof event.toolName === 'string' ? event.toolName : 'tool' };
  }
  if (event.type === 'subagent_start') {
    return { type: 'tool_start', toolName: typeof event.agentId === 'string' ? `subagent:${event.agentId}` : 'subagent' };
  }
  if (event.type === 'subagent_text_delta' && typeof event.delta === 'string') {
    return { type: 'text_delta', text: event.delta };
  }
  if (event.type === 'subagent_end') {
    return { type: 'tool_end', toolName: typeof event.agentId === 'string' ? `subagent:${event.agentId}` : 'subagent' };
  }
  if (event.type === 'done') return { type: 'done', sessionId: typeof event.threadId === 'string' ? event.threadId : undefined };
  if (event.type === 'error') return { type: 'error', message: String(event.error ?? event.message ?? 'Unknown Clawdius error') };
  return null;
}

async function parseNormalizedSse(res: Response, onEvent: (event: AgentStreamEvent) => void) {
  if (!res.ok) throw new Error(await res.text().catch(() => `HTTP ${res.status}`));
  const reader = res.body?.getReader();
  if (!reader) throw new Error('Response body is not readable');
  const decoder = new TextDecoder();
  let buffer = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      if (!line.startsWith('data:')) continue;
      try {
        const normalized = normalizeClawdiusEvent(asRecord(JSON.parse(line.slice(5).trim())));
        if (normalized) onEvent(normalized);
      } catch {
        // Ignore malformed gateway heartbeat/debug lines.
      }
    }
  }
}

/**
 * Adapter for Clawdius Gateway's existing `/api/threads` + `/api/chat` contract.
 * The core package still owns only abstract `AgentChatTransport`; Clawdius keeps
 * auth, selected-agent state, and gateway-specific routes outside the UI core.
 */
export function createClawdiusAgentChatTransport(options: ClawdiusAgentChatTransportOptions = {}): AgentChatTransport {
  const basePath = options.basePath ?? '/api';
  const fetchImpl = options.fetch ?? ((input: string, init?: RequestInit) => fetch(input, init));
  const threadsPath = `${basePath}/threads`;
  const threadPath = (sessionId: string) => `${threadsPath}/${encodeURIComponent(sessionId)}`;

  return {
    async listSessions(agentId: string) {
      const raw = await jsonOrThrow<unknown[]>(await fetchImpl(`${threadsPath}?agentId=${encodeURIComponent(agentId)}`));
      return raw
        .filter(item => asRecord(item).isSubagent !== true)
        .filter(item => String(asRecord(item).agentId ?? agentId) === agentId)
        .map(item => toSummary(item, agentId));
    },
    async createSession(agentId: string, title?: string) {
      const raw = await jsonOrThrow<unknown>(await fetchImpl(threadsPath, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId, title: title || 'New conversation' }),
      }));
      return toDetail({ ...asRecord(raw), messages: [] }, agentId);
    },
    async getSession(agentId: string, sessionId: string) {
      return toDetail(await jsonOrThrow<unknown>(await fetchImpl(threadPath(sessionId))), agentId);
    },
    async deleteSession(_agentId: string, sessionId: string) {
      const res = await fetchImpl(threadPath(sessionId), { method: 'DELETE' });
      if (!res.ok) throw new Error(await res.text().catch(() => `HTTP ${res.status}`));
    },
    async sendMessage(agentId: string, sessionId: string, message: string, onEvent: (event: AgentStreamEvent) => void) {
      const res = await fetchImpl(`${basePath}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId, threadId: sessionId, message }),
      });
      await parseNormalizedSse(res, onEvent);
    },
  };
}
