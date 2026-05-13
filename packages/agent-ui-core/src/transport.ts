import type { AgentChatTransport, AgentSessionDetail, AgentSessionSummary, AgentStreamEvent } from './types';
import { parseAgentSseStream } from './sse';

async function jsonOrThrow<T>(res: Response): Promise<T> {
  if (!res.ok) throw new Error(await res.text().catch(() => `HTTP ${res.status}`));
  return await res.json() as T;
}

export function createFetchAgentChatTransport(basePath = '/api'): AgentChatTransport {
  const appSessionsPath = (appId: string) => `${basePath}/apps/${encodeURIComponent(appId)}/agent-sessions`;
  const sessionPath = (appId: string, sessionId: string) => `${appSessionsPath(appId)}/${encodeURIComponent(sessionId)}`;

  return {
    async listSessions(appId: string) {
      return jsonOrThrow<AgentSessionSummary[]>(await fetch(appSessionsPath(appId)));
    },
    async createSession(appId: string, title?: string) {
      return jsonOrThrow<AgentSessionDetail>(await fetch(appSessionsPath(appId), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title }),
      }));
    },
    async getSession(appId: string, sessionId: string) {
      return jsonOrThrow<AgentSessionDetail>(await fetch(sessionPath(appId, sessionId)));
    },
    async deleteSession(appId: string, sessionId: string) {
      const res = await fetch(sessionPath(appId, sessionId), { method: 'DELETE' });
      if (!res.ok) throw new Error(await res.text().catch(() => `HTTP ${res.status}`));
    },
    async sendMessage(appId: string, sessionId: string, message: string, onEvent: (event: AgentStreamEvent) => void) {
      const res = await fetch(`${sessionPath(appId, sessionId)}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
      });
      await parseAgentSseStream(res, onEvent);
    },
  };
}
