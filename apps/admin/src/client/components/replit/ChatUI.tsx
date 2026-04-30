/**
 * PLANET-1385: Custom chat UI — replaces CopilotKit chat.
 * Streams responses from /api/chat endpoint.
 */
import { useState, useRef, useEffect } from 'react';
import { Paperclip, Link2, Sparkles, FileText, Table2 } from 'lucide-react';
import { CreateFormDialog } from './CreateFormDialog';
import { CreateTableDialog } from './CreateTableDialog';
import { useCanvas } from '../CanvasContext';
import { CanvasFormView } from './CanvasFormView';
import { CanvasTableView } from './CanvasTableView';
import type { CanvasElement } from './canvasElements';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  actions?: { icon: string; label: string }[];
  files?: { name: string }[];
}

function ChatMessage({ message }: { message: Message }) {
  const isUser = message.role === 'user';
  return (
    <div className={`flex gap-3 ${isUser ? 'justify-end' : ''}`}>
      {!isUser && (
        <div className="w-7 h-7 rounded-full bg-amber-500 flex items-center justify-center shrink-0 mt-0.5">
          <Sparkles className="w-3.5 h-3.5 text-black" />
        </div>
      )}
      <div className={`max-w-[80%] ${isUser ? 'order-first' : ''}`}>
        <div className="text-xs text-muted-foreground mb-1 font-medium">
          {isUser ? '你' : 'PeopleClaw AI'}
        </div>
        <div
          className={`rounded-xl px-3.5 py-2.5 text-sm leading-relaxed ${
            isUser
              ? 'bg-primary text-primary-foreground ml-auto'
              : 'bg-muted/80 text-foreground'
          }`}
        >
          {message.content}
        </div>
        {message.files && message.files.length > 0 && (
          <div className="flex gap-1.5 mt-1.5 flex-wrap">
            {message.files.map((f, i) => (
              <span key={i} className="inline-flex items-center gap-1 text-xs bg-muted rounded px-2 py-0.5">
                📎 {f.name}
              </span>
            ))}
          </div>
        )}
        {message.actions && message.actions.length > 0 && (
          <div className="flex gap-1.5 mt-1.5 flex-wrap">
            {message.actions.map((a, i) => (
              <span key={i} className="inline-flex items-center gap-1 text-xs bg-muted rounded px-2 py-0.5">
                🔗 {a.label}
              </span>
            ))}
          </div>
        )}
      </div>
      {isUser && (
        <div className="w-7 h-7 rounded-full bg-foreground/10 flex items-center justify-center shrink-0 mt-0.5">
          <span className="text-xs font-medium">你</span>
        </div>
      )}
    </div>
  );
}

export function ChatUI({ taskId }: { taskId: string }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [model, setModel] = useState('Economy');
  const [showFormDialog, setShowFormDialog] = useState(false);
  const [showTableDialog, setShowTableDialog] = useState(false);
  const { setCanvas } = useCanvas();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  async function sendMessage() {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: Message = { id: `u-${Date.now()}`, role: 'user', content: text };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setLoading(true);

    const assistantMsg: Message = { id: `a-${Date.now()}`, role: 'assistant', content: '' };

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages.map(m => ({ role: m.role, content: m.content })),
          taskId,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Unknown error' }));
        assistantMsg.content = `Error: ${err.error || res.statusText}`;
        setMessages([...newMessages, assistantMsg]);
        setLoading(false);
        return;
      }

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let accumulated = '';

      if (reader) {
        setMessages([...newMessages, assistantMsg]);

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              if (data === '[DONE]') break;
              try {
                const parsed = JSON.parse(data);
                const delta = parsed.choices?.[0]?.delta?.content;
                if (delta) {
                  accumulated += delta;
                  setMessages(prev => {
                    const updated = [...prev];
                    const last = updated[updated.length - 1];
                    if (last && last.role === 'assistant') {
                      updated[updated.length - 1] = { ...last, content: accumulated };
                    }
                    return updated;
                  });
                }
              } catch {
                // skip parse errors
              }
            }
          }
        }
      }
    } catch (err: unknown) {
      assistantMsg.content = `Error: ${err instanceof Error ? err.message : 'Network error'}`;
      setMessages([...newMessages, assistantMsg]);
    }

    setLoading(false);
  }

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.length === 0 && (
          <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
            开始对话来自动化你的工作流...
          </div>
        )}
        {messages.map(msg => (
          <ChatMessage key={msg.id} message={msg} />
        ))}
        {loading && messages[messages.length - 1]?.role === 'user' && (
          <div className="flex gap-3">
            <div className="w-7 h-7 rounded-full bg-amber-500 flex items-center justify-center shrink-0">
              <Sparkles className="w-3.5 h-3.5 text-black animate-pulse" />
            </div>
            <div className="bg-muted/80 rounded-xl px-3.5 py-2.5">
              <div className="flex gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-foreground/30 animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-foreground/30 animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-foreground/30 animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="border-t border-border p-3">
        <div className="flex items-center gap-2 bg-muted/50 rounded-xl px-3 py-2.5">
          <button className="text-muted-foreground hover:text-foreground transition-colors">
            <Paperclip className="w-4 h-4" />
          </button>
          <button className="text-muted-foreground hover:text-foreground transition-colors">
            <Link2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => setShowFormDialog(true)}
            className="text-muted-foreground hover:text-foreground transition-colors"
            title="新建表单"
          >
            <FileText className="w-4 h-4" />
          </button>
          <button
            onClick={() => setShowTableDialog(true)}
            className="text-muted-foreground hover:text-foreground transition-colors"
            title="新建表格"
          >
            <Table2 className="w-4 h-4" />
          </button>
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }}}
            placeholder="Make, test, iterate..."
            className="flex-1 bg-transparent outline-none text-sm placeholder:text-muted-foreground/60"
            disabled={loading}
          />
          <select
            value={model}
            onChange={e => setModel(e.target.value)}
            className="text-xs bg-transparent text-muted-foreground border-none outline-none cursor-pointer"
          >
            <option>Economy</option>
            <option>Standard</option>
            <option>Premium</option>
          </select>
          <button
            onClick={sendMessage}
            disabled={!input.trim() || loading}
            className="text-xs font-medium text-primary hover:text-primary/80 disabled:opacity-40 transition-colors"
          >
            Plan
          </button>
        </div>
      </div>

      {/* Create dialogs */}
      <CreateFormDialog
        open={showFormDialog}
        onClose={() => setShowFormDialog(false)}
        onCreated={(el: CanvasElement) => setCanvas(<CanvasFormView element={el} />, el.name)}
      />
      <CreateTableDialog
        open={showTableDialog}
        onClose={() => setShowTableDialog(false)}
        onCreated={(el: CanvasElement) => setCanvas(<CanvasTableView element={el} />, el.name)}
      />
    </div>
  );
}
