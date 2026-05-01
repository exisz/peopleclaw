/**
 * PLANET-1416: Chat + Canvas dual-pane interface (Stage 2).
 */
import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ReactFlow,
  Background,
  Controls,
  type Node,
  type Edge,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import ComponentNode, { type ComponentNodeData } from '../components/canvas/ComponentNode';
import ComponentDetail from '../components/canvas/ComponentDetail';
import { useComponentRun } from '../components/canvas/useComponentRun';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import TenantSwitcher from '../components/TenantSwitcher';
import UserMenu from '../components/UserMenu';
import CreditsBadge from '../components/CreditsBadge';
import { apiFetch, apiClient } from '../lib/api';

// Types
interface App {
  id: string;
  name: string;
  description?: string | null;
}
interface Component {
  id: string;
  name: string;
  type: string;
  runtime?: string;
  canvasX?: number | null;
  canvasY?: number | null;
}
interface Connection {
  id: string;
  fromComponentId: string;
  toComponentId: string;
  type?: string;
}
interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export default function AppPlaceholder() {
  const navigate = useNavigate();
  const { id: routeAppId } = useParams<{ id: string }>();
  const [user, setUser] = useState<{ name?: string; email?: string } | null>(null);

  useEffect(() => {
    apiFetch('/api/me')
      .then(r => { if (!r.ok) { navigate('/signin'); return null; } return r.json(); })
      .then(d => { if (d) setUser(d); })
      .catch(() => navigate('/signin'));
  }, [navigate]);

  if (!user) return <div className="flex items-center justify-center h-screen text-muted-foreground">Loading...</div>;

  return (
    <div className="flex flex-col h-screen">
      {/* Top bar */}
      <header data-testid="top-bar" className="h-14 border-b border-border flex items-center justify-between px-4 shrink-0 bg-background">
        <div className="flex items-center gap-3">
          <span className="font-semibold text-lg">PeopleClaw</span>
          <TenantSwitcher />
        </div>
        <div className="flex items-center gap-3">
          <CreditsBadge />
          <UserMenu />
        </div>
      </header>

      {/* Dual pane with resizable panels */}
      <PanelGroup direction="horizontal" className="flex-1">
        <Panel defaultSize={50} minSize={25}>
          <ChatPane />
        </Panel>
        <PanelResizeHandle className="w-1 bg-border hover:bg-primary/20 transition-colors cursor-col-resize" />
        <Panel defaultSize={50} minSize={25}>
          <CanvasPane initialAppId={routeAppId} />
        </Panel>
      </PanelGroup>
    </div>
  );
}

// ─── Chat Pane ─────────────────────────────────────────────────
function ChatPane() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  };

  useEffect(scrollToBottom, [messages]);

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || isStreaming) return;
    const userMsg: ChatMessage = { role: 'user', content: text };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setIsStreaming(true);

    try {
      const res = await apiClient.postRaw('/api/chat', { messages: newMessages });
      if (!res.ok) {
        const err = await res.text();
        setMessages([...newMessages, { role: 'assistant', content: `Error: ${err}` }]);
        setIsStreaming(false);
        return;
      }

      // Parse plain text stream
      const reader = res.body?.getReader();
      if (!reader) { setIsStreaming(false); return; }
      const decoder = new TextDecoder();
      let assistantContent = '';
      setMessages([...newMessages, { role: 'assistant', content: '' }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        assistantContent += chunk;
        setMessages(prev => {
          const copy = [...prev];
          copy[copy.length - 1] = { role: 'assistant', content: assistantContent };
          return copy;
        });
      }
    } catch (e) {
      setMessages([...newMessages, { role: 'assistant', content: `Error: ${e}` }]);
    }
    setIsStreaming(false);
  }, [input, messages, isStreaming]);

  return (
    <div className="flex flex-col h-full bg-muted/20">
      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <div className="text-center text-muted-foreground mt-20">
            <p className="text-2xl mb-2">💬</p>
            <p>开始和 AI 对话吧</p>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} data-testid={`chat-message-${i}`} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap ${
              m.role === 'user'
                ? 'bg-primary text-primary-foreground'
                : 'bg-card border border-border text-card-foreground'
            }`}>
              {m.content || (isStreaming && i === messages.length - 1 ? '...' : '')}
            </div>
          </div>
        ))}
      </div>
      {/* Input */}
      <div className="border-t border-border p-3 flex gap-2">
        <input
          data-testid="chat-input"
          className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          placeholder="输入消息..."
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
          disabled={isStreaming}
        />
        <button
          data-testid="chat-send-btn"
          onClick={sendMessage}
          disabled={isStreaming || !input.trim()}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          发送
        </button>
      </div>
    </div>
  );
}

// ─── Canvas Pane ─────────────────────────────────────────────────
const nodeTypes = { component: ComponentNode };

function CanvasPane({ initialAppId }: { initialAppId?: string }) {
  const [apps, setApps] = useState<App[]>([]);
  const [selectedAppId, setSelectedAppId] = useState<string | null>(initialAppId ?? null);
  const [components, setComponents] = useState<Component[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'flow' | 'detail'>('flow');
  const [selectedNode, setSelectedNode] = useState<Component | null>(null);
  const [detailTab, setDetailTab] = useState<'flow' | 'preview'>('flow');
  const { getState, runComponent, runs } = useComponentRun();

  // Load apps
  useEffect(() => {
    apiClient.get<{ apps: App[] }>('/api/apps').then(d => {
      setApps(d.apps);
      if (d.apps.length > 0 && !selectedAppId) setSelectedAppId(d.apps[0].id);
    }).catch(() => {});
  }, []);

  // Load app detail when selected
  useEffect(() => {
    if (!selectedAppId) { setComponents([]); setConnections([]); return; }
    apiClient.get<{ app: { components: Component[]; connections: Connection[] } }>(`/api/apps/${selectedAppId}`)
      .then(d => {
        setComponents(d.app.components);
        setConnections(d.app.connections);
      })
      .catch(() => { setComponents([]); setConnections([]); });
  }, [selectedAppId]);

  // Create new app
  const createApp = async () => {
    const name = prompt('App 名称:');
    if (!name) return;
    const d = await apiClient.post<{ app: App }>('/api/apps', { name });
    setApps(prev => [d.app, ...prev]);
    setSelectedAppId(d.app.id);
  };

  // Template picker state (PLANET-1424)
  const [templates, setTemplates] = useState<{ id: string; name: string; description: string; componentCount: number }[]>([]);
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);

  // Load templates on mount
  useEffect(() => {
    apiClient.get<{ templates: typeof templates }>('/api/apps/templates')
      .then(d => setTemplates(d.templates))
      .catch(() => {});
  }, []);

  const createFromTemplate = async (templateId: string) => {
    setShowTemplatePicker(false);
    const d = await apiClient.post<{ app: { id: string; name: string } }>('/api/apps/from-template', { templateId });
    setApps(prev => [{ id: d.app.id, name: d.app.name }, ...prev]);
    setSelectedAppId(d.app.id);
  };

  // Convert to xyflow nodes/edges with custom node type
  const nodes: Node[] = useMemo(() => components.map((c, i) => ({
    id: c.id,
    type: 'component',
    position: { x: c.canvasX ?? 100 + i * 200, y: c.canvasY ?? 100 },
    data: {
      label: c.name,
      name: c.name,
      type: c.type,
      icon: c.type === 'BACKEND' ? '⚙️' : c.type === 'FULLSTACK' ? '🔗' : '🎨',
      status: getState(c.id).status,
      onRun: () => runComponent(c.id),
    } satisfies ComponentNodeData,
  })), [components, runs]);

  const edges: Edge[] = useMemo(() => connections.map(conn => {
    // PLANET-1428: TRIGGER edges animate only when target is running
    const targetState = getState(conn.toComponentId);
    const isTriggered = conn.type === 'TRIGGER' && targetState.status === 'running';
    return {
      id: conn.id,
      source: conn.fromComponentId,
      target: conn.toComponentId,
      label: conn.type ?? '',
      animated: isTriggered,
      style: conn.type === 'TRIGGER' ? { stroke: isTriggered ? '#f59e0b' : '#94a3b8' } : undefined,
    };
  }), [connections, runs]);

  return (
    <div className="flex flex-col h-full bg-background">
      {/* App selector bar */}
      <div data-testid="app-selector" className="h-10 border-b border-border flex items-center px-3 gap-2 shrink-0">
        <select
          className="text-sm border border-input rounded px-2 py-1 bg-background"
          value={selectedAppId ?? ''}
          onChange={e => setSelectedAppId(e.target.value || null)}
        >
          {apps.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          {apps.length === 0 && <option value="">无 App</option>}
        </select>
        <button
          data-testid="new-app-btn"
          onClick={() => setShowTemplatePicker(true)}
          className="text-sm text-primary hover:underline"
        >
          + New App
        </button>
        {/* Right-side tabs */}
        <div className="ml-auto flex gap-1 text-xs">
          <button
            onClick={() => setActiveTab('flow')}
            data-testid="tab-flow-graph"
            className={`px-2 py-1 rounded ${activeTab === 'flow' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`}
          >模块流程图</button>
          <button
            onClick={() => setActiveTab('detail')}
            data-testid="tab-component-detail"
            className={`px-2 py-1 rounded ${activeTab === 'detail' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`}
          >组件详情</button>
        </div>
      </div>

      {/* Template picker modal (PLANET-1424) */}
      {showTemplatePicker && (
        <div className="absolute inset-0 z-50 bg-black/40 flex items-center justify-center" data-testid="template-picker-overlay" onClick={() => setShowTemplatePicker(false)}>
          <div className="bg-background border border-border rounded-lg shadow-xl p-6 w-96 max-h-[80vh] overflow-auto" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-4">选择模板</h3>
            <div className="space-y-2">
              <button
                data-testid="template-blank-btn"
                onClick={() => { setShowTemplatePicker(false); createApp(); }}
                className="w-full text-left p-3 rounded border border-border hover:bg-muted transition"
              >
                <span className="font-medium">📄 空白 App</span>
                <p className="text-xs text-muted-foreground">从零开始</p>
              </button>
              {templates.map(t => (
                <button
                  key={t.id}
                  data-testid={`template-${t.id}-btn`}
                  onClick={() => createFromTemplate(t.id)}
                  className="w-full text-left p-3 rounded border border-border hover:bg-muted transition"
                >
                  <span className="font-medium">{t.name}</span>
                  <p className="text-xs text-muted-foreground">{t.description} ({t.componentCount} 组件)</p>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Main canvas area */}
      <div data-testid="canvas-pane" className="flex-1 relative">
        {activeTab === 'flow' ? (
          components.length === 0 ? (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              <div className="text-center">
                <p className="text-2xl mb-2">📦</p>
                <p>此 App 还没有组件</p>
              </div>
            </div>
          ) : (
            <ReactFlow
              nodes={nodes}
              edges={edges}
              nodeTypes={nodeTypes}
              onNodeClick={(_e, node) => {
                const comp = components.find(c => c.id === node.id);
                if (comp) {
                  setSelectedNode(comp);
                  setActiveTab('detail');
                  // PLANET-1428: set default detail sub-tab based on type
                  setDetailTab(comp.type === 'FRONTEND' ? 'preview' : 'flow');
                }
              }}
              fitView
            >
              <Background />
              <Controls />
            </ReactFlow>
          )
        ) : (
          selectedNode ? (
            <ComponentDetail
              component={selectedNode}
              runState={getState(selectedNode.id)}
              onRun={() => runComponent(selectedNode.id)}
              defaultTab={detailTab}
            />
          ) : (
            <div className="p-4">
              <p className="text-muted-foreground text-sm">点击流程图中的节点查看详情</p>
            </div>
          )
        )}
      </div>

      {/* Bottom drawer — module list */}
      <div className="border-t border-border">
        <button
          data-testid="module-list-drawer-toggle"
          onClick={() => setDrawerOpen(!drawerOpen)}
          className="w-full text-xs text-muted-foreground hover:bg-muted px-3 py-1.5 text-left flex items-center gap-1"
        >
          <span>{drawerOpen ? '▼' : '▶'}</span>
          <span>模块列表 ({components.length})</span>
        </button>
        {drawerOpen && (
          <div className="max-h-40 overflow-auto px-3 pb-2">
            {components.length === 0 ? (
              <p className="text-xs text-muted-foreground py-2">无组件</p>
            ) : (
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-muted-foreground border-b">
                    <th className="text-left py-1">名称</th>
                    <th className="text-left py-1">类型</th>
                    <th className="text-left py-1">Runtime</th>
                    <th className="text-left py-1">状态</th>
                  </tr>
                </thead>
                <tbody>
                  {components.map(c => {
                    const st = getState(c.id);
                    return (
                      <tr key={c.id} data-testid={`module-list-row-${c.id}`} className="border-b border-border/50">
                        <td className="py-1">{c.name}</td>
                        <td className="py-1">{c.type}</td>
                        <td className="py-1">{c.runtime ?? '-'}</td>
                        <td className="py-1">
                          <span data-testid={`module-list-status-${c.id}`} className={st.status === 'running' ? 'text-yellow-600' : st.status === 'done' ? 'text-green-600' : st.status === 'error' ? 'text-red-600' : 'text-muted-foreground'}>
                            {st.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
