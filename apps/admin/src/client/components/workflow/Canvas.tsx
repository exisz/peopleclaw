import { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  useReactFlow,
  type Node,
  type Edge,
  type NodeChange,
  type EdgeChange,
  MarkerType,
  applyNodeChanges,
  applyEdgeChanges,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import type { WorkflowStep } from '../../types';
import StepNode, { type StepNodeData } from './nodes/StepNode';
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
} from '../ui/context-menu';

const nodeTypes = { stepNode: StepNode };

const COL_W = 260;
const ROW_H = 160;

export function autoLayout(steps: WorkflowStep[]): WorkflowStep[] {
  // Assign positions to any step missing one (5-col grid)
  const COLS = 4;
  return steps.map((s, i) => {
    if (s.position) return s;
    return {
      ...s,
      position: {
        x: (i % COLS) * COL_W,
        y: Math.floor(i / COLS) * ROW_H,
      },
    };
  });
}

export interface CanvasProps {
  steps: WorkflowStep[];
  selectedIds: string[];
  caseStatuses?: Record<string, string>;
  caseErrors?: Record<string, string>;
  runningPath?: Set<string>; // node ids on running case path
  onSelectionChange: (ids: string[]) => void;
  onPositionsChange: (updates: Array<{ id: string; position: { x: number; y: number } }>) => void;
  onDropTemplate: (templateJson: unknown, position: { x: number; y: number }) => void;
  onErrorClick: (msg: string) => void;
  onContextAction: (action: string, nodeId: string) => void;
  onPaneClick: () => void;
}

function statusEdgeColor(s: string | undefined): string {
  if (s === 'failed') return '#ef4444';
  if (s === 'running' || s === 'in-progress') return '#3b82f6';
  if (s === 'done') return '#10b981';
  return '#94a3b8';
}

export default function Canvas({
  steps,
  selectedIds,
  caseStatuses = {},
  caseErrors = {},
  runningPath,
  onSelectionChange,
  onPositionsChange,
  onDropTemplate,
  onErrorClick,
  onContextAction,
  onPaneClick,
}: CanvasProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const rf = useReactFlow();

  const layoutedNodes: Node[] = useMemo(
    () =>
      steps.map((s, i) => ({
        id: s.id,
        type: 'stepNode',
        position: s.position ?? { x: (i % 4) * COL_W, y: Math.floor(i / 4) * ROW_H },
        selected: selectedIds.includes(s.id),
        data: {
          step: s,
          iconName: s.iconName,
          status: caseStatuses[s.id],
          errorMessage: caseErrors[s.id],
          disabled: s.disabled,
          stepIndex: i,
          totalSteps: steps.length,
          onErrorClick,
        } as StepNodeData as unknown as Record<string, unknown>,
      })),
    [steps, selectedIds, caseStatuses, caseErrors, onErrorClick],
  );

  const layoutedEdges: Edge[] = useMemo(() => {
    const out: Edge[] = [];
    for (let i = 0; i < steps.length - 1; i++) {
      const s = steps[i];
      const n = steps[i + 1];
      const onPath = runningPath?.has(s.id) && runningPath?.has(n.id);
      const status = caseStatuses[s.id];
      const failed = status === 'failed';
      const color = failed ? '#ef4444' : onPath ? '#3b82f6' : statusEdgeColor(undefined);
      out.push({
        id: `e-${s.id}-${n.id}`,
        source: s.id,
        target: n.id,
        animated: !!onPath,
        style: { stroke: color, strokeWidth: 2, opacity: failed ? 0.9 : 0.6 },
        markerEnd: { type: MarkerType.ArrowClosed, color, width: 14, height: 14 },
      });
    }
    return out;
  }, [steps, caseStatuses, runningPath]);

  const [nodes, setNodes] = useNodesState(layoutedNodes);
  const [edges, setEdges] = useEdgesState(layoutedEdges);

  useEffect(() => {
    setNodes(layoutedNodes);
  }, [layoutedNodes, setNodes]);
  useEffect(() => {
    setEdges(layoutedEdges);
  }, [layoutedEdges, setEdges]);

  // Track in-progress drag positions; only emit save on drag end.
  const draggingPositions = useRef<Map<string, { x: number; y: number }>>(new Map());

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      setNodes((nds) => applyNodeChanges(changes, nds));
      const finalUpdates: Array<{ id: string; position: { x: number; y: number } }> = [];
      const selectionChanges: Array<{ id: string; selected: boolean }> = [];
      for (const ch of changes) {
        if (ch.type === 'position' && ch.position) {
          // Track but don't emit save on every tick
          draggingPositions.current.set(ch.id, ch.position);
          if (ch.dragging === false) {
            finalUpdates.push({ id: ch.id, position: ch.position });
            draggingPositions.current.delete(ch.id);
          }
        } else if (ch.type === 'select') {
          selectionChanges.push({ id: ch.id, selected: ch.selected });
        }
      }
      if (finalUpdates.length > 0) onPositionsChange(finalUpdates);
      if (selectionChanges.length > 0) {
        // Compute new selection set from current state
        // (use set difference based on changes)
        const next = new Set(selectedIds);
        for (const sc of selectionChanges) {
          if (sc.selected) next.add(sc.id);
          else next.delete(sc.id);
        }
        onSelectionChange(Array.from(next));
      }
    },
    [setNodes, onPositionsChange, onSelectionChange, selectedIds],
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => setEdges((es) => applyEdgeChanges(changes, es)),
    [setEdges],
  );

  // Drop handlers
  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      const raw = event.dataTransfer.getData('application/json');
      if (!raw) return;
      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch {
        return;
      }
      const flowPos = rf.screenToFlowPosition({ x: event.clientX, y: event.clientY });
      onDropTemplate(parsed, flowPos);
    },
    [rf, onDropTemplate],
  );

  const onNodeContextMenu = useCallback(
    (event: React.MouseEvent, node: Node) => {
      // Selecting node first so context menu acts on it
      if (!selectedIds.includes(node.id)) {
        onSelectionChange([node.id]);
      }
      // Radix ContextMenu auto-positions on right click; re-emit not needed.
      // event default not prevented so Radix handles.
    },
    [selectedIds, onSelectionChange],
  );

  // Right-click target id for the menu
  const rightClickedRef = useRef<string | null>(null);

  return (
    <div
      ref={wrapperRef}
      className="w-full h-full"
      onDragOver={onDragOver}
      onDrop={onDrop}
      data-testid="workflow-canvas"
    >
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div
            className="w-full h-full"
            onContextMenuCapture={(e) => {
              const target = (e.target as HTMLElement).closest('[data-testid^="step-node-"]');
              const id = target?.getAttribute('data-testid')?.replace('step-node-', '') ?? null;
              rightClickedRef.current = id;
              if (id && !selectedIds.includes(id)) onSelectionChange([id]);
            }}
          >
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onNodeContextMenu={onNodeContextMenu}
              onPaneClick={onPaneClick}
              nodeTypes={nodeTypes}
              fitView
              fitViewOptions={{ padding: 0.2 }}
              minZoom={0.3}
              maxZoom={2}
              proOptions={{ hideAttribution: true }}
              panOnDrag
              selectionOnDrag
              multiSelectionKeyCode={['Meta', 'Control']}
              deleteKeyCode={null /* handled by hotkeys hook */}
            >
              <Background gap={20} size={1} />
              <Controls />
              <MiniMap
                nodeColor={(n) => {
                  const data = n.data as { step?: WorkflowStep };
                  if (!data?.step) return '#94a3b8';
                  const t = data.step.type;
                  return t === 'human'
                    ? '#f59e0b'
                    : t === 'agent'
                    ? '#06b6d4'
                    : t === 'subflow'
                    ? '#8b5cf6'
                    : '#94a3b8';
                }}
              />
            </ReactFlow>
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem
            onSelect={() => rightClickedRef.current && onContextAction('edit', rightClickedRef.current)}
            data-testid="context-menu-edit"
          >
            <span>Edit</span> <ContextMenuShortcut>↵</ContextMenuShortcut>
          </ContextMenuItem>
          <ContextMenuItem
            onSelect={() => rightClickedRef.current && onContextAction('duplicate', rightClickedRef.current)}
            data-testid="context-menu-duplicate"
          >
            <span>Duplicate</span> <ContextMenuShortcut>⌘D</ContextMenuShortcut>
          </ContextMenuItem>
          <ContextMenuItem
            onSelect={() => rightClickedRef.current && onContextAction('copy', rightClickedRef.current)}
            data-testid="context-menu-copy"
          >
            <span>Copy</span> <ContextMenuShortcut>⌘C</ContextMenuShortcut>
          </ContextMenuItem>
          <ContextMenuItem
            onSelect={() => rightClickedRef.current && onContextAction('paste', rightClickedRef.current)}
            data-testid="context-menu-paste"
          >
            <span>Paste</span> <ContextMenuShortcut>⌘V</ContextMenuShortcut>
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem
            onSelect={() => rightClickedRef.current && onContextAction('toggle-disabled', rightClickedRef.current)}
            data-testid="context-menu-toggle-disabled"
          >
            Disable / Enable
          </ContextMenuItem>
          <ContextMenuItem
            onSelect={() => rightClickedRef.current && onContextAction('run-from-here', rightClickedRef.current)}
            data-testid="context-menu-run-from-here"
          >
            Run from here
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem
            onSelect={() => rightClickedRef.current && onContextAction('delete', rightClickedRef.current)}
            data-testid="context-menu-delete"
            className="text-destructive focus:text-destructive"
          >
            <span>Delete</span> <ContextMenuShortcut>⌫</ContextMenuShortcut>
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    </div>
  );
}
