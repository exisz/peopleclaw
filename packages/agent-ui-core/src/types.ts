export type AgentChatRole = 'user' | 'assistant' | 'tool' | 'system';

export interface AgentChatMessage {
  id: string;
  role: AgentChatRole;
  content: string;
  timestamp: string;
  toolName?: string;
}

export interface AgentSessionSummary {
  id: string;
  appId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
}

export interface AgentSessionDetail extends AgentSessionSummary {
  messages: AgentChatMessage[];
}

export type AgentStreamEvent =
  | { type: 'text_delta'; text: string }
  | { type: 'tool_start'; toolName: string; args?: unknown }
  | { type: 'tool_end'; toolName: string; result?: unknown }
  | { type: 'error'; message: string }
  | { type: 'done'; sessionId?: string }
  | { type: string; [key: string]: unknown };

export interface AgentChatTransport {
  listSessions(appId: string): Promise<AgentSessionSummary[]>;
  createSession(appId: string, title?: string): Promise<AgentSessionDetail>;
  getSession(appId: string, sessionId: string): Promise<AgentSessionDetail>;
  deleteSession(appId: string, sessionId: string): Promise<void>;
  sendMessage(
    appId: string,
    sessionId: string,
    message: string,
    onEvent: (event: AgentStreamEvent) => void,
  ): Promise<void>;
}
