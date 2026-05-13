import * as React from 'react';
import type { AgentChatMessage, AgentChatTransport, AgentSessionDetail, AgentSessionSummary } from './types';
import { createFetchAgentChatTransport } from './transport';

export interface UseAgentChatOptions {
  appId?: string;
  transport?: AgentChatTransport;
}

export function useAgentChat({ appId, transport = createFetchAgentChatTransport() }: UseAgentChatOptions) {
  const [sessions, setSessions] = React.useState<AgentSessionSummary[]>([]);
  const [activeSession, setActiveSession] = React.useState<AgentSessionDetail | null>(null);
  const [messages, setMessages] = React.useState<AgentChatMessage[]>([]);
  const [streaming, setStreaming] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const refreshSessions = React.useCallback(async () => {
    if (!appId) return;
    const next = await transport.listSessions(appId);
    setSessions(next);
  }, [appId, transport]);

  const openSession = React.useCallback(async (sessionId: string) => {
    if (!appId) return;
    const detail = await transport.getSession(appId, sessionId);
    setActiveSession(detail);
    setMessages(detail.messages);
  }, [appId, transport]);

  const createSession = React.useCallback(async (title?: string) => {
    if (!appId) return null;
    const detail = await transport.createSession(appId, title);
    setActiveSession(detail);
    setMessages(detail.messages);
    await refreshSessions();
    return detail;
  }, [appId, refreshSessions, transport]);

  const deleteSession = React.useCallback(async (sessionId: string) => {
    if (!appId) return;
    await transport.deleteSession(appId, sessionId);
    if (activeSession?.id === sessionId) {
      setActiveSession(null);
      setMessages([]);
    }
    await refreshSessions();
  }, [activeSession?.id, appId, refreshSessions, transport]);

  const sendMessage = React.useCallback(async (content: string) => {
    if (!appId || streaming) return;
    const text = content.trim();
    if (!text) return;
    setError(null);
    setStreaming(true);
    let session = activeSession;
    try {
      if (!session) session = await createSession(text.slice(0, 48)) as AgentSessionDetail;
      if (!session) throw new Error('Unable to create chat session');
      const userMsg: AgentChatMessage = { id: `local-user-${Date.now()}`, role: 'user', content: text, timestamp: new Date().toISOString() };
      const assistantMsg: AgentChatMessage = { id: `local-assistant-${Date.now()}`, role: 'assistant', content: '', timestamp: new Date().toISOString() };
      setMessages(prev => [...prev, userMsg, assistantMsg]);

      let assistantText = '';
      await transport.sendMessage(appId, session.id, text, (event) => {
        if (event.type === 'text_delta' && typeof event.text === 'string') {
          assistantText += event.text;
          setMessages(prev => {
            const copy = [...prev];
            copy[copy.length - 1] = { ...copy[copy.length - 1]!, content: assistantText };
            return copy;
          });
        } else if (event.type === 'tool_start') {
          const toolName = typeof event.toolName === 'string' ? event.toolName : 'tool';
          setMessages(prev => [...prev, {
            id: `local-tool-${Date.now()}`,
            role: 'tool',
            content: 'running…',
            toolName,
            timestamp: new Date().toISOString(),
          }]);
        } else if (event.type === 'tool_end') {
          const toolName = typeof event.toolName === 'string' ? event.toolName : 'tool';
          setMessages(prev => prev.map(m => m.role === 'tool' && m.toolName === toolName ? { ...m, content: 'done' } : m));
        } else if (event.type === 'error') {
          setError(typeof event.message === 'string' ? event.message : 'Unknown agent error');
        }
      });
      await openSession(session.id);
      await refreshSessions();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setStreaming(false);
    }
  }, [activeSession, appId, createSession, openSession, refreshSessions, streaming, transport]);

  React.useEffect(() => {
    if (!appId) return;
    refreshSessions().catch(e => setError(e instanceof Error ? e.message : String(e)));
  }, [appId, refreshSessions]);

  return {
    sessions,
    activeSession,
    messages,
    streaming,
    error,
    refreshSessions,
    openSession,
    createSession,
    deleteSession,
    sendMessage,
    setError,
  };
}

function formatTimestamp(value?: string) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export interface AgentChatSurfaceProps {
  appId?: string;
  emptyTitle?: string;
  emptyDescription?: string;
  inputPlaceholder?: string;
}

export function AgentChatSurface({
  appId,
  emptyTitle = 'Start a conversation',
  emptyDescription = 'Talk to this app agent. It keeps session context and streams replies live.',
  inputPlaceholder = 'Message this app…',
}: AgentChatSurfaceProps) {
  const chat = useAgentChat({ appId });
  const [input, setInput] = React.useState('');
  const scrollerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    scrollerRef.current?.scrollTo({ top: scrollerRef.current.scrollHeight, behavior: 'smooth' });
  }, [chat.messages, chat.streaming]);

  const submit = () => {
    const text = input.trim();
    if (!text || chat.streaming) return;
    setInput('');
    void chat.sendMessage(text);
  };

  return (
    <div className="flex h-full min-h-0 bg-muted/10">
      <aside className="hidden w-72 shrink-0 border-r border-border bg-background/70 md:flex md:flex-col">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div>
            <div className="text-sm font-semibold">Sessions</div>
            <div className="text-xs text-muted-foreground">PI Codex chat</div>
          </div>
          <button className="rounded-md border border-border px-2 py-1 text-xs hover:bg-muted" onClick={() => void chat.createSession('New chat')} disabled={!appId || chat.streaming}>
            New
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {chat.sessions.length === 0 ? (
            <div className="px-3 py-8 text-center text-xs text-muted-foreground">No sessions yet</div>
          ) : chat.sessions.map(session => (
            <div key={session.id} className="group mb-1 flex items-center gap-1">
              <button
                className={`min-w-0 flex-1 rounded-md px-3 py-2 text-left text-xs hover:bg-muted ${chat.activeSession?.id === session.id ? 'bg-muted font-medium' : ''}`}
                onClick={() => void chat.openSession(session.id)}
              >
                <div className="truncate">{session.title}</div>
                <div className="mt-0.5 text-[10px] text-muted-foreground">{session.messageCount} msgs · {formatTimestamp(session.updatedAt)}</div>
              </button>
              <button
                className="rounded px-2 py-1 text-xs text-muted-foreground opacity-0 hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
                onClick={() => void chat.deleteSession(session.id)}
                title="Delete session"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      </aside>

      <section className="flex min-w-0 flex-1 flex-col">
        <div ref={scrollerRef} className="flex-1 overflow-y-auto p-6">
          {chat.messages.length === 0 ? (
            <div className="mx-auto mt-20 max-w-md text-center text-muted-foreground">
              <div className="mb-3 text-4xl">💬</div>
              <h2 className="text-base font-semibold text-foreground">{emptyTitle}</h2>
              <p className="mt-1 text-sm">{emptyDescription}</p>
            </div>
          ) : (
            <div className="mx-auto flex max-w-4xl flex-col gap-4">
              {chat.messages.map(message => (
                <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[82%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm ${
                    message.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : message.role === 'tool'
                        ? 'border border-amber-300/40 bg-amber-500/10 font-mono text-xs text-amber-900 dark:text-amber-200'
                        : 'border border-border bg-card text-card-foreground'
                  }`}>
                    {message.role === 'tool' && <div className="mb-1 font-semibold">Tool · {message.toolName}</div>}
                    <div className="whitespace-pre-wrap break-words">{message.content || (chat.streaming && message.role === 'assistant' ? '…' : '')}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
          {chat.error && <div className="mx-auto mt-4 max-w-4xl rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{chat.error}</div>}
        </div>
        <div className="border-t border-border bg-background/80 p-3">
          <div className="mx-auto flex max-w-4xl items-end gap-2">
            <textarea
              className="min-h-11 max-h-40 flex-1 resize-none rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring disabled:opacity-60"
              rows={1}
              value={input}
              placeholder={inputPlaceholder}
              disabled={!appId || chat.streaming}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  submit();
                }
              }}
            />
            <button
              className="rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              disabled={!input.trim() || !appId || chat.streaming}
              onClick={submit}
            >
              {chat.streaming ? 'Sending…' : 'Send'}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
