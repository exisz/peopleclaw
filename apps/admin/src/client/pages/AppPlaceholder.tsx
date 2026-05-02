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
import ComponentTabContent from '../components/canvas/ComponentTabContent';
import { AppSecretsPanel } from '../components/AppSecretsPanel';
import { AppScheduledTasksPanel } from '../components/AppScheduledTasksPanel';
import { useComponentRun } from '../components/canvas/useComponentRun';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';

import { apiFetch, apiClient } from '../lib/api';

function formatToolResult(name: string, result: unknown): string {
  const r = result as Record<string, unknown> | undefined;
  switch (name) {
    case 'add_component': return `加了 ${r?.name ?? '组件'} 节点`;
    case 'update_component': return `更新了 ${r?.name ?? '组件'}`;
    case 'delete_component': return `删除了组件`;
    case 'add_connection': return `加了连线`;
    case 'delete_connection': return `删除了连线`;
    case 'apply_template': return `套用了模板 (${r?.components ?? 0} 组件, ${r?.connections ?? 0} 连线)`;
    case 'list_components': return `列出了组件`;
    default: return `${name} 完成`;
  }
}

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
interface ToolCallCard {
  name: string;
  result?: unknown;
}
interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  toolCalls?: ToolCallCard[];
}

export default function AppPlaceholder() {
  const navigate = useNavigate();
  const { id: routeAppId } = useParams<{ id: string }>();
  const [user, setUser] = useState<{ name?: string; email?: string } | null>(null);
  const [selectedAppId, setSelectedAppId] = useState<string | null>(routeAppId ?? null);
  const [canvasRefreshKey, setCanvasRefreshKey] = useState(0);
  const refreshCanvas = useCallback(() => setCanvasRefreshKey(k => k + 1), []);

  useEffect(() => {
    apiFetch('/api/me')
      .then(r => { if (!r.ok) { navigate('/signin'); return null; } return r.json(); })
      .then(d => { if (d) setUser(d); })
      .catch(() => navigate('/signin'));
  }, [navigate]);

  if (!user) return <div className="flex items-center justify-center h-full text-muted-foreground">Loading...</div>;

  return (
    <div className="flex flex-col h-full">
      {/* Dual pane with resizable panels */}
      <PanelGroup direction="horizontal" className="flex-1">
        <Panel defaultSize={50} minSize={25}>
          <ChatPane appId={selectedAppId} onCanvasChange={refreshCanvas} />
        </Panel>
        <PanelResizeHandle className="w-1 bg-border hover:bg-primary/20 transition-colors cursor-col-resize" />
        <Panel defaultSize={50} minSize={25}>
          <CanvasPane initialAppId={routeAppId} onAppSelected={setSelectedAppId} refreshKey={canvasRefreshKey} />
        </Panel>
      </PanelGroup>
    </div>
  );
}

// ─── Chat Pane ─────────────────────────────────────────────────
function ChatPane({ appId, onCanvasChange }: { appId: string | null; onCanvasChange: () => void }) {
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
    if (!text || isStreaming || !appId) return;
    const userMsg: ChatMessage = { role: 'user', content: text };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setIsStreaming(true);

    try {
      const res = await apiClient.postRaw('/api/chat', { messages: newMessages, appId });
      if (!res.ok) {
        const err = await res.text();
        setMessages([...newMessages, { role: 'assistant', content: `Error: ${err}` }]);
        setIsStreaming(false);
        return;
      }

      // Parse SSE stream
      const reader = res.body?.getReader();
      if (!reader) { setIsStreaming(false); return; }
      const decoder = new TextDecoder();
      let assistantContent = '';
      let toolCalls: ToolCallCard[] = [];
      let buffer = '';
      setMessages([...newMessages, { role: 'assistant', content: '', toolCalls: [] }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        // Parse SSE lines
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        let currentEvent = '';
        for (const line of lines) {
          if (line.startsWith('event: ')) {
            currentEvent = line.slice(7);
          } else if (line.startsWith('data: ')) {
            const dataStr = line.slice(6);
            try {
              const data = JSON.parse(dataStr);
              if (currentEvent === 'text_delta') {
                assistantContent += data.text;
              } else if (currentEvent === 'tool_result') {
                const label = formatToolResult(data.name, data.result);
                toolCalls = [...toolCalls, { name: data.name, result: data.result }];
                assistantContent += '';
                // Trigger canvas refresh on mutation events
                onCanvasChange();
              } else if (currentEvent === 'component_added' || currentEvent === 'component_updated' ||
                         currentEvent === 'component_deleted' || currentEvent === 'connection_added' ||
                         currentEvent === 'connection_deleted') {
                onCanvasChange();
              }
            } catch { /* skip malformed */ }
            currentEvent = '';
          }
        }

        setMessages(prev => {
          const copy = [...prev];
          copy[copy.length - 1] = { role: 'assistant', content: assistantContent, toolCalls: [...toolCalls] };
          return copy;
        });
      }
    } catch (e) {
      setMessages([...newMessages, { role: 'assistant', content: `Error: ${e}` }]);
    }
    setIsStreaming(false);
  }, [input, messages, isStreaming, appId, onCanvasChange]);

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
              {m.toolCalls && m.toolCalls.length > 0 && (
                <div className="mb-2 space-y-1">
                  {m.toolCalls.map((tc, j) => (
                    <div key={j} className="text-xs bg-muted/50 rounded px-2 py-1 border border-border/50">
                      ✓ {formatToolResult(tc.name, tc.result)}
                    </div>
                  ))}
                </div>
              )}
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

const PERMANENT_TAB_IDS = ['flow', 'list', 'secrets', 'scheduled'] as const;
type PermanentTabId = typeof PERMANENT_TAB_IDS[number];
function isPermanentTab(id: string): id is PermanentTabId {
  return (PERMANENT_TAB_IDS as readonly string[]).includes(id);
}

const PERMANENT_TAB_LABELS: Record<PermanentTabId, { label: string; icon: string; testId: string }> = {
  flow: { label: '模块流程图', icon: '📊', testId: 'tab-flow-graph' },
  list: { label: '模块列表', icon: '📋', testId: 'tab-module-list' },
  secrets: { label: 'Secrets', icon: '🔐', testId: 'tab-app-secrets' },
  scheduled: { label: '定时任务', icon: '⏰', testId: 'tab-app-scheduled' },
};

function componentIcon(type: string): string {
  return type === 'BACKEND' ? '⚙️' : type === 'FULLSTACK' ? '🔗' : '🎨';
}

function CanvasPane({ initialAppId, onAppSelected, refreshKey }: { initialAppId?: string; onAppSelected?: (id: string | null) => void; refreshKey?: number }) {
  // PLANET-1442: When route provides an app id, lock to that app (no switcher)
  const isLocked = !!initialAppId;
  const [apps, setApps] = useState<App[]>([]);
  const [selectedAppId, setSelectedAppId] = useState<string | null>(initialAppId ?? null);
  const [components, setComponents] = useState<Component[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [detailTab, setDetailTab] = useState<'flow' | 'preview'>('preview');
  const { getState, runComponent, runs } = useComponentRun();

  // PLANET-1468: IDE-style multi-tab state
  const [openTabIds, setOpenTabIds] = useState<string[]>(['flow', 'list', 'secrets', 'scheduled']);
  const [activeTabId, setActiveTabId] = useState<string>('flow');
  const [showAddTabMenu, setShowAddTabMenu] = useState(false);
  const dragSrcRef = useRef<string | null>(null);

  // Load tabs from localStorage when app changes
  const lsKey = selectedAppId ? `peopleclaw:openTabs:${selectedAppId}` : null;
  const lastLoadedLsKeyRef = useRef<string | null>(null);
  useEffect(() => {
    if (!lsKey) return;
    // Guard: only reload tabs when lsKey actually transitioned to a NEW value.
    // Without this guard, React StrictMode double-invoke or any spurious effect re-run
    // could clobber freshly opened component tabs (PLANET-1468 race fix).
    if (lastLoadedLsKeyRef.current === lsKey) return;
    lastLoadedLsKeyRef.current = lsKey;
    try {
      const raw = localStorage.getItem(lsKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed.openTabIds)) {
          // Always ensure permanent tabs are present
          const ids = [...parsed.openTabIds];
          for (const p of PERMANENT_TAB_IDS) if (!ids.includes(p)) ids.push(p);
          setOpenTabIds(ids);
        }
        if (typeof parsed.activeTabId === 'string') {
          setActiveTabId(parsed.activeTabId);
        }
      } else {
        setOpenTabIds(['flow', 'list', 'secrets', 'scheduled']);
        setActiveTabId('flow');
      }
    } catch {
      setOpenTabIds(['flow', 'list', 'secrets', 'scheduled']);
      setActiveTabId('flow');
    }
  }, [lsKey]);

  // Persist tabs
  useEffect(() => {
    if (!lsKey) return;
    try {
      localStorage.setItem(lsKey, JSON.stringify({ openTabIds, activeTabId }));
    } catch {}
  }, [lsKey, openTabIds, activeTabId]);

  const openComponentTab = useCallback((compId: string, compType?: string) => {
    setOpenTabIds(prev => prev.includes(compId) ? prev : [...prev, compId]);
    setActiveTabId(compId);
    if (compType) setDetailTab(compType === 'FRONTEND' ? 'preview' : 'flow');
  }, []);

  const closeTab = useCallback((tabId: string) => {
    if (isPermanentTab(tabId)) return;
    setOpenTabIds(prev => {
      const next = prev.filter(id => id !== tabId);
      return next;
    });
    setActiveTabId(prev => prev === tabId ? 'flow' : prev);
  }, []);

  // Load apps
  useEffect(() => {
    apiClient.get<{ apps: App[] }>('/api/apps').then(d => {
      setApps(d.apps);
      if (d.apps.length > 0 && !selectedAppId) setSelectedAppId(d.apps[0].id);
    }).catch(() => {});
  }, []);

  // Notify parent of app selection
  useEffect(() => {
    onAppSelected?.(selectedAppId);
  }, [selectedAppId, onAppSelected]);

  // Load app detail when selected or refreshKey changes
  useEffect(() => {
    if (!selectedAppId) { setComponents([]); setConnections([]); return; }
    apiClient.get<{ app: { components: Component[]; connections: Connection[] } }>(`/api/apps/${selectedAppId}`)
      .then(d => {
        setComponents(d.app.components);
        setConnections(d.app.connections);
      })
      .catch(() => { setComponents([]); setConnections([]); });
  }, [selectedAppId, refreshKey]);

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
      {/* App selector bar — hidden when locked to a single app (PLANET-1442) */}
      <div data-testid="app-selector" className="h-10 border-b border-border flex items-center px-3 gap-2 shrink-0">
        {!isLocked && (
          <>
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
          </>
        )}
        {isLocked && (
          <span data-testid="app-locked-name" className="text-sm font-medium">
            {apps.find(a => a.id === selectedAppId)?.name ?? 'App'}
          </span>
        )}
      </div>

      {/* PLANET-1468: IDE-style top tab bar */}
      <div data-testid="ide-tab-bar" className="flex items-center border-b border-border bg-muted/30 overflow-x-auto shrink-0">
        {openTabIds.map(tabId => {
          const isActive = activeTabId === tabId;
          const perm = isPermanentTab(tabId) ? PERMANENT_TAB_LABELS[tabId] : null;
          const comp = !perm ? components.find(c => c.id === tabId) : null;
          const label = perm
            ? (tabId === 'list' ? `${perm.label} (${components.length})` : perm.label)
            : (comp?.name ?? tabId);
          const icon = perm ? perm.icon : (comp ? componentIcon(comp.type) : '📦');
          const testId = perm ? perm.testId : `tab-component-${tabId}`;
          const closeable = !perm;
          return (
            <div
              key={tabId}
              data-testid={testId}
              data-tab-id={tabId}
              data-tab-active={isActive ? 'true' : 'false'}
              draggable
              onDragStart={() => { dragSrcRef.current = tabId; }}
              onDragOver={e => e.preventDefault()}
              onDrop={e => {
                e.preventDefault();
                const src = dragSrcRef.current;
                dragSrcRef.current = null;
                if (!src || src === tabId) return;
                setOpenTabIds(prev => {
                  const arr = [...prev];
                  const fromIdx = arr.indexOf(src);
                  const toIdx = arr.indexOf(tabId);
                  if (fromIdx < 0 || toIdx < 0) return prev;
                  arr.splice(fromIdx, 1);
                  arr.splice(toIdx, 0, src);
                  return arr;
                });
              }}
              onClick={() => setActiveTabId(tabId)}
              className={`group flex items-center gap-1.5 px-3 py-1.5 text-xs border-r border-border cursor-pointer select-none whitespace-nowrap ${
                isActive
                  ? 'bg-background text-foreground border-b-2 border-b-primary'
                  : 'text-muted-foreground hover:bg-muted'
              }`}
            >
              <span>{icon}</span>
              <span className="max-w-[160px] truncate">{label}</span>
              {closeable && (
                <button
                  data-testid={`tab-close-${tabId}`}
                  onClick={e => { e.stopPropagation(); closeTab(tabId); }}
                  className="ml-1 opacity-50 hover:opacity-100 hover:bg-destructive/10 rounded px-1"
                  aria-label="close tab"
                >✕</button>
              )}
            </div>
          );
        })}
        <div className="relative">
          <button
            data-testid="tab-add-btn"
            onClick={() => setShowAddTabMenu(v => !v)}
            className="px-2 py-1.5 text-xs text-muted-foreground hover:bg-muted"
            aria-label="add tab"
          >+</button>
          {showAddTabMenu && (
            <div
              data-testid="tab-add-menu"
              className="absolute top-full left-0 mt-1 z-40 bg-popover border border-border rounded shadow-md min-w-[180px] max-h-64 overflow-auto"
            >
              {components.filter(c => !openTabIds.includes(c.id)).length === 0 ? (
                <div className="px-3 py-2 text-xs text-muted-foreground">所有组件都已打开</div>
              ) : (
                components.filter(c => !openTabIds.includes(c.id)).map(c => (
                  <button
                    key={c.id}
                    data-testid={`tab-add-option-${c.id}`}
                    onClick={() => { setShowAddTabMenu(false); openComponentTab(c.id, c.type); }}
                    className="w-full text-left px-3 py-1.5 text-xs hover:bg-muted flex items-center gap-2"
                  >
                    <span>{componentIcon(c.type)}</span>
                    <span className="truncate">{c.name}</span>
                  </button>
                ))
              )}
            </div>
          )}
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

      {/* Main canvas area — all tab panels mounted, hidden via display:none for keepalive */}
      <div data-testid="canvas-pane" className="flex-1 relative overflow-hidden">
        {openTabIds.map(tabId => {
          const isActive = activeTabId === tabId;
          // Permanent tabs always rendered; component tabs only mounted while in openTabIds
          if (tabId === 'flow') {
            return (
              <div key="flow" data-testid="tab-panel-flow" hidden={!isActive} className="h-full w-full">
                {components.length === 0 ? (
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
                      if (comp) openComponentTab(comp.id, comp.type);
                    }}
                    fitView
                  >
                    <Background />
                    <Controls />
                  </ReactFlow>
                )}
              </div>
            );
          }
          if (tabId === 'list') {
            return (
              <div key="list" data-testid="tab-panel-list" hidden={!isActive} className="h-full w-full overflow-auto">
                <ModuleListPanel components={components} getState={getState} onOpenComponent={openComponentTab} />
              </div>
            );
          }
          if (tabId === 'secrets') {
            return (
              <div key="secrets" data-testid="tab-panel-secrets" hidden={!isActive} className="h-full w-full overflow-auto">
                {selectedAppId ? (
                  <AppSecretsPanel appId={selectedAppId} />
                ) : (
                  <div className="p-4"><p className="text-muted-foreground text-sm">先选一个 App</p></div>
                )}
              </div>
            );
          }
          if (tabId === 'scheduled') {
            return (
              <div key="scheduled" data-testid="tab-panel-scheduled" hidden={!isActive} className="h-full w-full overflow-auto">
                {selectedAppId ? (
                  <AppScheduledTasksPanel appId={selectedAppId} components={components.map(c => ({ id: c.id, name: c.name, type: c.type }))} />
                ) : (
                  <div className="p-4"><p className="text-muted-foreground text-sm">先选一个 App</p></div>
                )}
              </div>
            );
          }
          // Component tab
          const comp = components.find(c => c.id === tabId);
          if (!comp) {
            return (
              <div key={tabId} data-testid={`tab-panel-${tabId}`} hidden={!isActive} className="h-full w-full p-4">
                <p className="text-xs text-muted-foreground">组件已删除或不存在</p>
              </div>
            );
          }
          return (
            <div key={tabId} data-testid={`tab-panel-${tabId}`} hidden={!isActive} className="h-full w-full overflow-auto">
              <ComponentTabContent
                component={comp}
                runState={getState(comp.id)}
                onRun={() => runComponent(comp.id)}
                defaultTab={detailTab}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Module list panel — was previously the bottom drawer; now a first-class tab.
function ModuleListPanel({
  components,
  getState,
  onOpenComponent,
}: {
  components: Component[];
  getState: (id: string) => { status: string };
  onOpenComponent: (id: string, type?: string) => void;
}) {
  return (
    <div className="p-4">
      <button
        data-testid="module-list-drawer-toggle"
        className="text-xs text-muted-foreground mb-2"
        type="button"
      >
        全部模块 ({components.length})
      </button>
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
                <tr
                  key={c.id}
                  data-testid={`module-list-row-${c.id}`}
                  onClick={() => onOpenComponent(c.id, c.type)}
                  className="border-b border-border/50 hover:bg-muted cursor-pointer"
                >
                  <td className="py-1">{c.name}</td>
                  <td className="py-1">{c.type}</td>
                  <td className="py-1">{c.runtime ?? '-'}</td>
                  <td className="py-1">
                    <span
                      data-testid={`module-list-status-${c.id}`}
                      className={
                        st.status === 'running'
                          ? 'text-yellow-600'
                          : st.status === 'done'
                          ? 'text-green-600'
                          : st.status === 'error'
                          ? 'text-red-600'
                          : 'text-muted-foreground'
                      }
                    >
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
  );
}
