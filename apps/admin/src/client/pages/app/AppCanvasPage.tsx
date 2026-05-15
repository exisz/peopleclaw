/**
 * PLANET-1742 — Living SaaS shell · Canvas page.
 *
 * Canvas is now a single sidebar-routed page. System surfaces (Module Flow,
 * Cron, Secrets, etc.) and user App/component pages live in the left App
 * sidebar, not in a second top tab row inside the content area.
 */
import { useEffect, useMemo, useState } from 'react';
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

export default function AppCanvasPage() {
  const navigate = useNavigate();
  const { id: appId } = useParams<{ id: string }>();
  const [authChecked, setAuthChecked] = useState(false);

  const [components, setComponents] = useState<Component[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [appName, setAppName] = useState<string>('');
  const { getState, runComponent, runs } = useComponentRun();

  useEffect(() => {
    apiFetch('/api/me')
      .then(r => { if (!r.ok) { navigate('/signin'); return; } setAuthChecked(true); })
      .catch(() => navigate('/signin'));
  }, [navigate]);

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
      <div className="h-10 border-b border-border flex items-center px-3 gap-2 shrink-0">
        <span data-testid="app-locked-name" className="text-sm font-medium truncate">
          {appName || 'App'}
        </span>
        <span className="text-[10px] font-mono text-muted-foreground/70 truncate">{appId}</span>
      </div>

      <div data-testid="canvas-pane" className="flex-1 relative overflow-hidden">
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
            onNodeClick={(_e, node) => navigate(`/app/${appId}/components/${node.id}`)}
            fitView
          >
            <Background />
            <Controls />
          </ReactFlow>
        )}
      </div>
    </div>
  );
}
