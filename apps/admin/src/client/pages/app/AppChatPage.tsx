/**
 * PLANET-1407: Living SaaS — Chat page.
 *
 * Chat is now navigable as a full page rather than an always-on middle pane.
 * This page intentionally stays *self-contained* so it can render even when
 * no canvas is mounted; it talks to the same `/api/chat` SSE endpoint as the
 * legacy dual-pane experience.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { apiClient } from '../../lib/api';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export default function AppChatPage() {
  const { id: appId } = useParams<{ id: string }>();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || streaming || !appId) return;
    const next: ChatMessage[] = [...messages, { role: 'user', content: text }];
    setMessages(next);
    setInput('');
    setStreaming(true);
    try {
      const res = await apiClient.postRaw('/api/chat', { messages: next, appId });
      if (!res.ok) {
        const err = await res.text();
        setMessages([...next, { role: 'assistant', content: `Error: ${err}` }]);
        setStreaming(false);
        return;
      }
      const reader = res.body?.getReader();
      if (!reader) {
        setStreaming(false);
        return;
      }
      const decoder = new TextDecoder();
      let acc = '';
      let buf = '';
      setMessages([...next, { role: 'assistant', content: '' }]);
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop() ?? '';
        let evt = '';
        for (const line of lines) {
          if (line.startsWith('event: ')) evt = line.slice(7);
          else if (line.startsWith('data: ')) {
            try {
              const d = JSON.parse(line.slice(6));
              if (evt === 'text_delta' && typeof d.text === 'string') acc += d.text;
            } catch { /* ignore malformed */ }
            evt = '';
          }
        }
        setMessages(prev => {
          const copy = [...prev];
          copy[copy.length - 1] = { role: 'assistant', content: acc };
          return copy;
        });
      }
    } catch (e) {
      setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${String(e)}` }]);
    }
    setStreaming(false);
  }, [input, messages, streaming, appId]);

  return (
    <div data-testid="page-app-chat" className="flex flex-col h-full bg-muted/10">
      <header className="px-6 py-4 border-b border-border">
        <h1 className="text-lg font-semibold tracking-tight">Chat</h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Direct conversation with the app's compose agent.
        </p>
      </header>
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-3">
        {messages.length === 0 && (
          <div className="text-center text-muted-foreground mt-20">
            <p className="text-2xl mb-2">💬</p>
            <p className="text-sm">Ask the agent to add components, wire flows, or change the canvas.</p>
          </div>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            data-testid={`page-chat-message-${i}`}
            className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[75%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap ${
                m.role === 'user'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-card border border-border text-card-foreground'
              }`}
            >
              {m.content || (streaming && i === messages.length - 1 ? '...' : '')}
            </div>
          </div>
        ))}
      </div>
      <div className="border-t border-border p-3 flex gap-2">
        <input
          data-testid="page-chat-input"
          className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          placeholder="Type a message..."
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          disabled={streaming || !appId}
        />
        <button
          data-testid="page-chat-send-btn"
          onClick={send}
          disabled={streaming || !input.trim() || !appId}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          Send
        </button>
      </div>
    </div>
  );
}
