/**
 * PLANET-1407 — Living SaaS shell · Canvas page.
 *
 * The Canvas is the App's interactive workspace: an xyflow graph of all
 * components plus an IDE-style tab strip with Module Flow / Module List /
 * Secrets / Cron permanent tabs and per-component tabs. Chat lives on its
 * own page — the legacy Chat-pane / Canvas dual-pane has been removed.
 *
 * This component is intentionally self-contained: it owns the component &
 * connection fetches and tab state for the route-locked App id, so the
 * Canvas page works in isolation under the canonical Living SaaS shell.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ReactFlow,
  Background,
  Controls,
  type Node,
  type Edge,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import ComponentNode, { type ComponentNodeData } from '../../components/canvas/ComponentNode';
import ComponentTabContent from '../../components/canvas/ComponentTabContent';
import { AppSecretsPanel } from '../../components/AppSecretsPanel';
import { AppScheduledTasksPanel } from '../../components/AppScheduledTasksPanel';
import { useComponentRun } from '../../components/canvas/useComponentRun';
import { apiClient, apiFetch } from '../../lib/api';

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

const nodeTypes = { component: ComponentNode };

const PERMANENT_TAB_IDS = ['flow', 'list', 'secrets', 'scheduled'] as const;
type PermanentTabId = typeof PERMANENT_TAB_IDS[number];
function isPermanentTab(id: string): id is PermanentTabId {
  return (PERMANENT_TAB_IDS as readonly string[]).includes(id);
}

const PERMANENT_TAB_LABELS: Record<PermanentTabId, { label: string; icon: string; testId: string }> = {
  flow:      { label: 'Module Flow',  icon: '📊', testId: 'tab-flow-graph' },
  list:      { label: 'Module List',  icon: '📋', testId: 'tab-module-list' },
  secrets:   { label: 'Secrets',      icon: '🔐', testId: 'tab-app-secrets' },
  scheduled: { label: 'Cron',         icon: '⏰', testId: 'tab-app-scheduled' },
};

function componentIcon(type: string): string {
  return type === 'BACKEND' ? '⚙️' : type === 'FULLSTACK' ? '🔗' : '🎨';
}

export default function AppCanvasPage() {
  const navigate = useNavigate();
  const { id: appId } = useParams<{ id: string }>();
  const [authChecked, setAuthChecked] = useState(false);

  const [components, setComponents] = useState<Component[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [appName, setAppName] = useState<string>('');
  const [detailTab, setDetailTab] = useState<'flow' | 'preview'>('preview');
  const { getState, runComponent, runs } = useComponentRun();

  // IDE-style multi-tab state (PLANET-1468 carried forward)
  const [openTabIds, setOpenTabIds] = useState<string[]>([...PERMANENT_TAB_IDS]);
  const [activeTabId, setActiveTabId] = useState<string>('flow');
  const [showAddTabMenu, setShowAddTabMenu] = useState(false);
  const dragSrcRef = useRef<string | null>(null);

  // Auth gate (matches the legacy AppPlaceholder behaviour).
  useEffect(() => {
    apiFetch('/api/me')
      .then(r => { if (!r.ok) { navigate('/signin'); return; } setAuthChecked(true); })
      .catch(() => navigate('/signin'));
  }, [navigate]);

  // Persist tabs per app
  const lsKey = appId ? `peopleclaw:openTabs:${appId}` : null;
  const lastLoadedLsKeyRef = useRef<string | null>(null);
  useEffect(() => {
    if (!lsKey) return;
    if (lastLoadedLsKeyRef.current === lsKey) return;
    lastLoadedLsKeyRef.current = lsKey;
    try {
      const raw = localStorage.getItem(lsKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed.openTabIds)) {
          const ids = [...parsed.openTabIds];
          for (const p of PERMANENT_TAB_IDS) if (!ids.includes(p)) ids.push(p);
          setOpenTabIds(ids);
        }
        if (typeof parsed.activeTabId === 'string') setActiveTabId(parsed.activeTabId);
      } else {
        setOpenTabIds([...PERMANENT_TAB_IDS]);
        setActiveTabId('flow');
      }
    } catch {
      setOpenTabIds([...PERMANENT_TAB_IDS]);
      setActiveTabId('flow');
    }
  }, [lsKey]);

  useEffect(() => {
    if (!lsKey) return;
    try { localStorage.setItem(lsKey, JSON.stringify({ openTabIds, activeTabId })); } catch { /* ignore */ }
  }, [lsKey, openTabIds, activeTabId]);

  // Load app detail (components + connections)
  useEffect(() => {
    if (!appId) return;
    apiClient
      .get<{ app: { name: string; components: Component[]; connections: Connection[] } }>(`/api/apps/${appId}`)
      .then(d => {
        setAppName(d.app.name ?? '');
        setComponents(d.app.components ?? []);
        setConnections(d.app.connections ?? []);
      })
      .catch(() => { setComponents([]); setConnections([]); });
  }, [appId]);

  const openComponentTab = useCallback((compId: string, compType?: string) => {
    setOpenTabIds(prev => prev.includes(compId) ? prev : [...prev, compId]);
    setActiveTabId(compId);
    if (compType) setDetailTab(compType === 'FRONTEND' ? 'preview' : 'flow');
  }, []);

  const closeTab = useCallback((tabId: string) => {
    if (isPermanentTab(tabId)) return;
    setOpenTabIds(prev => prev.filter(id => id !== tabId));
    setActiveTabId(prev => prev === tabId ? 'flow' : prev);
  }, []);

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
  })), [components, runs, getState, runComponent]);

  const edges: Edge[] = useMemo(() => connections.map(conn => {
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
  }), [connections, runs, getState]);

  if (!authChecked) {
    return <div className="flex items-center justify-center h-full text-muted-foreground">Loading…</div>;
  }
  if (!appId) {
    return <div className="flex items-center justify-center h-full text-muted-foreground">No app selected</div>;
  }

  return (
    <div data-testid="page-app-canvas" className="flex flex-col h-full bg-background">
      {/* Locked-app name bar (replaces legacy app-selector dropdown) */}
      <div className="h-10 border-b border-border flex items-center px-3 gap-2 shrink-0">
        <span data-testid="app-locked-name" className="text-sm font-medium truncate">
          {appName || 'App'}
        </span>
        <span className="text-[10px] font-mono text-muted-foreground/70 truncate">{appId}</span>
      </div>

      {/* IDE-style top tab bar */}
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
                <div className="px-3 py-2 text-xs text-muted-foreground">All components are open</div>
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

      {/* Tab panels — all mounted, hidden via display:none for keepalive */}
      <div data-testid="canvas-pane" className="flex-1 relative overflow-hidden">
        {openTabIds.map(tabId => {
          const isActive = activeTabId === tabId;
          if (tabId === 'flow') {
            return (
              <div key="flow" data-testid="tab-panel-flow" hidden={!isActive} className="h-full w-full">
                {components.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-muted-foreground">
                    <div className="text-center">
                      <p className="text-2xl mb-2">📦</p>
                      <p>This App has no components yet</p>
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
                <AppSecretsPanel appId={appId} />
              </div>
            );
          }
          if (tabId === 'scheduled') {
            return (
              <div key="scheduled" data-testid="tab-panel-scheduled" hidden={!isActive} className="h-full w-full overflow-auto">
                <AppScheduledTasksPanel
                  appId={appId}
                  components={components.map(c => ({ id: c.id, name: c.name, type: c.type }))}
                />
              </div>
            );
          }
          const comp = components.find(c => c.id === tabId);
          if (!comp) {
            return (
              <div key={tabId} data-testid={`tab-panel-${tabId}`} hidden={!isActive} className="h-full w-full p-4">
                <p className="text-xs text-muted-foreground">Component deleted or not found</p>
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
                isActive={isActive}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

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
        Modules ({components.length})
      </button>
      {components.length === 0 ? (
        <p className="text-xs text-muted-foreground py-2">No components</p>
      ) : (
        <table className="w-full text-xs">
          <thead>
            <tr className="text-muted-foreground border-b">
              <th className="text-left py-1">Name</th>
              <th className="text-left py-1">Type</th>
              <th className="text-left py-1">Runtime</th>
              <th className="text-left py-1">Status</th>
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
