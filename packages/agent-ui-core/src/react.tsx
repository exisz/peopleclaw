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
            let lastAssistant = -1;
            for (let i = copy.length - 1; i >= 0; i -= 1) {
              if (copy[i]?.role === 'assistant') { lastAssistant = i; break; }
            }
            if (lastAssistant >= 0) copy[lastAssistant] = { ...copy[lastAssistant]!, content: assistantText };
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

function roleLabel(message: AgentChatMessage) {
  if (message.role === 'user') return 'You';
  if (message.role === 'tool') return message.toolName || 'Tool';
  if (message.role === 'system') return 'System';
  return 'Agent';
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

  const startThread = () => void chat.createSession('New conversation');

  const newThreadButton = (label = 'New') => (
    <button
      className="inline-flex items-center justify-center gap-1.5 rounded-full border border-primary/30 bg-primary px-3.5 py-2 text-xs font-bold text-primary-foreground shadow-sm shadow-primary/20 transition hover:-translate-y-0.5 hover:bg-primary/90 disabled:cursor-not-allowed disabled:translate-y-0 disabled:opacity-50"
      onClick={startThread}
      disabled={!appId || chat.streaming}
    >
      <span aria-hidden>＋</span>{label}
    </button>
  );

  const sessionList = (variant: 'desktop' | 'mobile') => (
    <div className={variant === 'desktop' ? 'flex-1 overflow-y-auto px-3 pb-4' : 'max-h-56 overflow-y-auto px-3 pb-3'}>
      {chat.sessions.length === 0 ? (
        <div className="rounded-[1.4rem] border border-dashed border-border bg-background/55 px-4 py-6 text-center text-xs text-muted-foreground shadow-inner">
          <div className="mx-auto mb-3 grid h-9 w-9 place-items-center rounded-2xl bg-muted text-base">✦</div>
          <div className="font-bold text-foreground">No threads yet</div>
          <div className="mt-1.5 leading-relaxed">Create a thread or send a message to begin.</div>
        </div>
      ) : chat.sessions.map(session => {
        const active = chat.activeSession?.id === session.id;
        return (
          <div key={session.id} className="group relative mb-2.5 flex items-stretch gap-2">
            <button
              className={`min-w-0 flex-1 rounded-[1.35rem] border px-3.5 py-3 text-left text-xs transition duration-200 ${active ? 'border-primary/35 bg-primary/10 shadow-sm ring-1 ring-primary/20' : 'border-border/40 bg-background/45 hover:border-border hover:bg-background/85 hover:shadow-sm'}`}
              onClick={() => void chat.openSession(session.id)}
              aria-current={active ? 'page' : undefined}
            >
              <div className="flex items-center gap-2">
                <span className={`h-2 w-2 shrink-0 rounded-full ${active ? 'bg-primary' : 'bg-muted-foreground/30'}`} />
                <span className={`truncate ${active ? 'font-bold text-foreground' : 'font-semibold text-foreground/90'}`}>{session.title || 'New conversation'}</span>
              </div>
              <div className="mt-2 flex items-center justify-between gap-2 text-[10px] text-muted-foreground">
                <span>{session.messageCount} msgs</span>
                <span className="truncate">{formatTimestamp(session.updatedAt)}</span>
              </div>
            </button>
            <button
              className="my-1 inline-flex w-9 shrink-0 items-center justify-center rounded-2xl border border-transparent text-sm leading-none text-muted-foreground transition hover:border-destructive/30 hover:bg-destructive/10 hover:text-destructive focus-visible:border-destructive/40 focus-visible:bg-destructive/10 focus-visible:text-destructive md:opacity-55 md:group-hover:opacity-100 md:focus:opacity-100"
              onClick={() => void chat.deleteSession(session.id)}
              title="Delete thread"
              aria-label={`Delete thread ${session.title || 'New conversation'}`}
            >
              ⌫
            </button>
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="relative flex h-full min-h-0 flex-col overflow-hidden bg-gradient-to-br from-primary/10 via-background to-muted md:flex-row">
      <aside className="hidden w-80 shrink-0 border-r border-border/70 bg-card/78 shadow-[20px_0_60px_-55px_rgba(0,0,0,0.8)] backdrop-blur md:flex md:flex-col" aria-label="Chat threads">
        <div className="px-5 py-5">
          <div className="mb-5 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/70 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground">Live agent</div>
              <h2 className="mt-3 text-lg font-black tracking-tight text-foreground">Threads</h2>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Persistent context for this App.</p>
            </div>
            {newThreadButton()}
          </div>
        </div>
        {sessionList('desktop')}
      </aside>

      <div className="shrink-0 border-b border-border/70 bg-card/88 backdrop-blur md:hidden" aria-label="Chat threads">
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <div className="text-sm font-black tracking-tight">Threads</div>
            <div className="truncate text-[11px] text-muted-foreground">
              {chat.activeSession?.title || `${chat.sessions.length} saved thread${chat.sessions.length === 1 ? '' : 's'}`}
            </div>
          </div>
          {newThreadButton('New')}
        </div>
        {sessionList('mobile')}
      </div>

      <section className="flex min-h-0 min-w-0 flex-1 flex-col">
        <div className="shrink-0 border-b border-border/60 bg-background/45 px-4 py-3 backdrop-blur sm:px-6">
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="truncate text-sm font-black tracking-tight text-foreground">{chat.activeSession?.title || 'New conversation'}</div>
              <div className="mt-0.5 text-[11px] text-muted-foreground">{chat.messages.length} messages · streamed responses</div>
            </div>
            <div className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest ${chat.streaming ? 'bg-primary/15 text-foreground' : 'bg-muted text-muted-foreground'}`}>{chat.streaming ? 'Streaming' : 'Ready'}</div>
          </div>
        </div>

        <div ref={scrollerRef} className="flex-1 overflow-y-auto px-4 py-5 sm:px-6 md:px-8 md:py-8">
          {chat.messages.length === 0 ? (
            <div className="mx-auto mt-8 max-w-2xl overflow-hidden rounded-[2rem] border border-border/70 bg-card/82 text-center shadow-[0_28px_90px_-60px_rgba(0,0,0,0.9)] ring-1 ring-white/40 backdrop-blur dark:ring-white/10 md:mt-16">
              <div className="bg-gradient-to-br from-primary/15 via-card to-accent/10 px-7 py-8">
                <div className="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-[1.25rem] border border-border/70 bg-background/80 text-2xl shadow-sm">✺</div>
                <h2 className="text-xl font-black tracking-tight text-foreground">{emptyTitle}</h2>
                <p className="mx-auto mt-3 max-w-md text-sm leading-7 text-muted-foreground">{emptyDescription}</p>
                <div className="mt-6">{newThreadButton('Create thread')}</div>
              </div>
              <div className="grid gap-2 border-t border-border/60 bg-background/45 px-5 py-4 text-left text-[11px] text-muted-foreground sm:grid-cols-3">
                <div className="rounded-2xl bg-card/70 p-3">Ask for a plan</div>
                <div className="rounded-2xl bg-card/70 p-3">Summarize app state</div>
                <div className="rounded-2xl bg-card/70 p-3">Find the next action</div>
              </div>
            </div>
          ) : (
            <div className="mx-auto flex max-w-5xl flex-col gap-5">
              {chat.messages.map(message => (
                <div key={message.id} className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {message.role !== 'user' && <div className="mt-1 hidden h-9 w-9 shrink-0 place-items-center rounded-2xl border border-border/70 bg-card text-sm shadow-sm sm:grid">{message.role === 'tool' ? '⌁' : '✦'}</div>}
                  <div className={`max-w-[88%] sm:max-w-[76%] ${message.role === 'user' ? 'items-end' : 'items-start'} flex flex-col gap-1.5`}>
                    <div className="px-1 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">{roleLabel(message)}</div>
                    <div className={`rounded-[1.45rem] px-4 py-3 text-sm leading-7 shadow-sm ring-1 ${
                      message.role === 'user'
                        ? 'rounded-tr-md bg-foreground text-background ring-foreground/10'
                        : message.role === 'tool'
                          ? 'border border-amber-300/35 bg-amber-500/10 font-mono text-xs text-amber-950 ring-amber-500/10 dark:text-amber-100'
                          : 'rounded-tl-md border border-border/70 bg-card/92 text-card-foreground ring-white/45 dark:ring-white/10'
                    }`}>
                      <div className="whitespace-pre-wrap break-words">{message.content || (chat.streaming && message.role === 'assistant' ? '…' : '')}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          {chat.error && <div className="mx-auto mt-4 max-w-5xl rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive">{chat.error}</div>}
        </div>

        <div className="border-t border-border/70 bg-background/78 p-3 backdrop-blur supports-[backdrop-filter]:bg-background/62 sm:p-4">
          <div className="mx-auto flex max-w-5xl items-end gap-2 rounded-[1.5rem] border border-border/80 bg-card/94 p-2 shadow-[0_18px_70px_-50px_rgba(0,0,0,0.95)] ring-1 ring-white/45 dark:ring-white/10">
            <textarea
              className="min-h-12 max-h-40 flex-1 resize-none rounded-[1rem] border-0 bg-transparent px-3 py-3 text-sm leading-6 outline-none placeholder:text-muted-foreground/75 focus:ring-0 disabled:opacity-60"
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
              className="rounded-[1rem] bg-primary px-5 py-3 text-sm font-black text-primary-foreground shadow-sm transition hover:-translate-y-0.5 hover:bg-primary/90 disabled:cursor-not-allowed disabled:translate-y-0 disabled:opacity-50"
              disabled={!input.trim() || !appId || chat.streaming}
              onClick={submit}
            >
              {chat.streaming ? 'Sending…' : 'Send'}
            </button>
          </div>
          <div className="mx-auto mt-2 max-w-5xl px-2 text-[10px] text-muted-foreground">Enter sends · Shift+Enter inserts a new line</div>
        </div>
      </section>
    </div>
  );
}
