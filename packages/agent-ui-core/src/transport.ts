import type { AgentChatTransport, AgentSessionDetail, AgentSessionSummary, AgentStreamEvent } from './types';
import { parseAgentSseStream } from './sse';

export type AgentChatFetch = (input: string, init?: RequestInit) => Promise<Response>;

export interface FetchAgentChatTransportOptions {
  /**
   * Injectable fetch implementation for host apps that need auth, tenant, sudo,
   * tracing, or other request headers. Defaults to global fetch to keep the
   * package framework/app agnostic.
   */
  fetch?: AgentChatFetch;
}

async function jsonOrThrow<T>(res: Response): Promise<T> {
  if (!res.ok) throw new Error(await res.text().catch(() => `HTTP ${res.status}`));
  return await res.json() as T;
}

export function createFetchAgentChatTransport(
  basePath = '/api',
  options: FetchAgentChatTransportOptions = {},
): AgentChatTransport {
  const fetchImpl = options.fetch ?? ((input: string, init?: RequestInit) => fetch(input, init));
  const appSessionsPath = (appId: string) => `${basePath}/apps/${encodeURIComponent(appId)}/agent-sessions`;
  const sessionPath = (appId: string, sessionId: string) => `${appSessionsPath(appId)}/${encodeURIComponent(sessionId)}`;

  return {
    async listSessions(appId: string) {
      return jsonOrThrow<AgentSessionSummary[]>(await fetchImpl(appSessionsPath(appId)));
    },
    async createSession(appId: string, title?: string) {
      return jsonOrThrow<AgentSessionDetail>(await fetchImpl(appSessionsPath(appId), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title }),
      }));
    },
    async getSession(appId: string, sessionId: string) {
      return jsonOrThrow<AgentSessionDetail>(await fetchImpl(sessionPath(appId, sessionId)));
    },
    async deleteSession(appId: string, sessionId: string) {
      const res = await fetchImpl(sessionPath(appId, sessionId), { method: 'DELETE' });
      if (!res.ok) throw new Error(await res.text().catch(() => `HTTP ${res.status}`));
    },
    async sendMessage(appId: string, sessionId: string, message: string, onEvent: (event: AgentStreamEvent) => void) {
      const res = await fetchImpl(`${sessionPath(appId, sessionId)}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
      });
      await parseAgentSseStream(res, onEvent);
    },
  };
}
