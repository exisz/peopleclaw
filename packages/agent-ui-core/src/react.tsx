import * as React from 'react';
import type { AgentChatMessage, AgentChatTransport, AgentSessionDetail, AgentSessionSummary } from './types';
import { createFetchAgentChatTransport } from './transport';

export interface UseAgentChatOptions {
  appId?: string;
  transport?: AgentChatTransport;
}

export function useAgentChat({ appId, transport }: UseAgentChatOptions) {
  const defaultTransport = React.useMemo(() => createFetchAgentChatTransport(), []);
  const chatTransport = transport ?? defaultTransport;
  const [sessions, setSessions] = React.useState<AgentSessionSummary[]>([]);
  const [activeSession, setActiveSession] = React.useState<AgentSessionDetail | null>(null);
  const [messages, setMessages] = React.useState<AgentChatMessage[]>([]);
  const [streaming, setStreaming] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const refreshSessions = React.useCallback(async () => {
    if (!appId) return;
    const next = await chatTransport.listSessions(appId);
    setSessions(next);
  }, [appId, chatTransport]);

  const openSession = React.useCallback(async (sessionId: string) => {
    if (!appId) return;
    const detail = await chatTransport.getSession(appId, sessionId);
    setActiveSession(detail);
    setMessages(detail.messages);
  }, [appId, chatTransport]);

  const createSession = React.useCallback(async (title?: string) => {
    if (!appId) return null;
    const detail = await chatTransport.createSession(appId, title);
    setActiveSession(detail);
    setMessages(detail.messages);
    await refreshSessions();
    return detail;
  }, [appId, refreshSessions, chatTransport]);

  const deleteSession = React.useCallback(async (sessionId: string) => {
    if (!appId) return;
    await chatTransport.deleteSession(appId, sessionId);
    if (activeSession?.id === sessionId) {
      setActiveSession(null);
      setMessages([]);
    }
    await refreshSessions();
  }, [activeSession?.id, appId, refreshSessions, chatTransport]);

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
      await chatTransport.sendMessage(appId, session.id, text, (event) => {
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
  }, [activeSession, appId, createSession, openSession, refreshSessions, streaming, chatTransport]);

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
  return d.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export interface AgentChatSurfaceProps {
  appId?: string;
  emptyTitle?: string;
  emptyDescription?: string;
  inputPlaceholder?: string;
  transport?: AgentChatTransport;
}

export function AgentChatSurface({
  appId,
  emptyTitle = 'Start a conversation',
  emptyDescription = 'Talk to this app agent. It keeps session context and streams replies live.',
  inputPlaceholder = 'Message this app…',
  transport,
}: AgentChatSurfaceProps) {
  const chat = useAgentChat({ appId, transport });
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

  const startThread = () => void chat.createSession('New chat');

  const newThreadButton = (label = 'New Thread') => (
    <button
      className="inline-flex items-center justify-center rounded-full border border-primary/20 bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
      onClick={startThread}
      disabled={!appId || chat.streaming}
    >
      {label}
    </button>
  );

  const sessionList = (variant: 'desktop' | 'mobile') => (
    <div className={variant === 'desktop' ? 'flex-1 overflow-y-auto p-3' : 'max-h-48 overflow-y-auto px-3 pb-3'}>
      {chat.sessions.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/80 bg-background/60 px-3 py-5 text-center text-xs text-muted-foreground">
          <div className="font-semibold text-foreground">No threads yet</div>
          <div className="mt-1 leading-relaxed">Send your first message or create a new thread.</div>
        </div>
      ) : chat.sessions.map(session => {
        const active = chat.activeSession?.id === session.id;
        return (
          <div key={session.id} className="group mb-2 flex items-center gap-2">
            <button
              className={`min-w-0 flex-1 rounded-2xl border px-3 py-2.5 text-left text-xs transition ${active ? 'border-primary/25 bg-primary/10 shadow-sm ring-1 ring-primary/10' : 'border-transparent hover:border-border/80 hover:bg-background/80'}`}
              onClick={() => void chat.openSession(session.id)}
              aria-current={active ? 'page' : undefined}
            >
              <div className={`truncate ${active ? 'font-semibold text-foreground' : 'font-medium text-foreground/90'}`}>{session.title || 'New chat'}</div>
              <div className="mt-1 truncate text-[10px] text-muted-foreground">{session.messageCount} msgs · {formatTimestamp(session.updatedAt)}</div>
            </button>
            <button
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-transparent text-base leading-none text-muted-foreground transition hover:border-destructive/30 hover:bg-destructive/10 hover:text-destructive focus-visible:border-destructive/40 focus-visible:bg-destructive/10 focus-visible:text-destructive md:opacity-60 md:group-hover:opacity-100 md:focus:opacity-100"
              onClick={() => void chat.deleteSession(session.id)}
              title="Delete thread"
              aria-label={`Delete thread ${session.title || 'New chat'}`}
            >
              ×
            </button>
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="flex h-full min-h-0 flex-col bg-gradient-to-br from-background via-background to-muted/35 md:flex-row">
      <aside className="hidden w-72 shrink-0 border-r border-border/80 bg-muted/30 md:flex md:flex-col" aria-label="Chat threads">
        <div className="border-b border-border/70 px-4 py-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm font-semibold tracking-tight">Threads</div>
              <div className="mt-0.5 text-xs text-muted-foreground">PeopleClaw App agent</div>
            </div>
            {newThreadButton()}
          </div>
        </div>
        {sessionList('desktop')}
      </aside>

      <div className="shrink-0 border-b border-border/80 bg-background/90 md:hidden" aria-label="Chat threads">
        <div className="flex items-center justify-between gap-3 px-3 py-3">
          <div className="min-w-0">
            <div className="text-sm font-semibold">Threads</div>
            <div className="truncate text-[11px] text-muted-foreground">
              {chat.activeSession?.title || `${chat.sessions.length} saved thread${chat.sessions.length === 1 ? '' : 's'}`}
            </div>
          </div>
          {newThreadButton('New')}
        </div>
        {sessionList('mobile')}
      </div>

      <section className="flex min-h-0 min-w-0 flex-1 flex-col">
        <div ref={scrollerRef} className="flex-1 overflow-y-auto px-4 py-5 sm:px-6 md:px-8 md:py-7">
          {chat.messages.length === 0 ? (
            <div className="mx-auto mt-10 max-w-xl rounded-3xl border border-border/70 bg-card/80 px-6 py-8 text-center text-muted-foreground shadow-sm md:mt-16">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-2xl">💬</div>
              <h2 className="text-base font-semibold text-foreground">{emptyTitle}</h2>
              <p className="mt-2 text-sm leading-relaxed">{emptyDescription}</p>
              <div className="mt-5">{newThreadButton()}</div>
            </div>
          ) : (
            <div className="mx-auto flex max-w-4xl flex-col gap-4">
              {chat.messages.map(message => (
                <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[82%] rounded-3xl px-4 py-3 text-sm leading-relaxed shadow-sm ${
                    message.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : message.role === 'tool'
                        ? 'border border-amber-300/40 bg-amber-500/10 font-mono text-xs text-amber-900 dark:text-amber-200'
                        : 'border border-border/80 bg-card text-card-foreground'
                  }`}>
                    {message.role === 'tool' && <div className="mb-1 font-semibold">Tool · {message.toolName}</div>}
                    <div className="whitespace-pre-wrap break-words">{message.content || (chat.streaming && message.role === 'assistant' ? '…' : '')}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
          {chat.error && <div className="mx-auto mt-4 max-w-4xl rounded-2xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{chat.error}</div>}
        </div>
        <div className="border-t border-border/80 bg-background/85 p-3 backdrop-blur supports-[backdrop-filter]:bg-background/70">
          <div className="mx-auto flex max-w-4xl items-end gap-2 rounded-2xl border border-border bg-card p-2 shadow-sm">
            <textarea
              className="min-h-11 max-h-40 flex-1 resize-none rounded-xl border-0 bg-transparent px-3 py-2 text-sm outline-none placeholder:text-muted-foreground/80 focus:ring-0 disabled:opacity-60"
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
              className="rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
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
