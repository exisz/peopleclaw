import { useCallback, useMemo, useState, useEffect } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  MarkerType,
  Panel,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import type { Workflow, WorkflowStep, Case } from '../../data/types';
import StepNode, { type StepNodeData } from './nodes/StepNode';
import SubflowGroupNode from './nodes/SubflowGroupNode';
import DetailPanel from './panels/DetailPanel';
import AddStepModal from './panels/AddStepModal';
import { Button } from '../ui/button';
import { Plus } from 'lucide-react';

const NODE_WIDTH = 220;
const NODE_HEIGHT = 120;
const H_GAP = 80;
const V_GAP = 40;
const COLS = 5;

const nodeTypes = { stepNode: StepNode, subflowGroup: SubflowGroupNode };

function layoutNodes(
  steps: WorkflowStep[],
  selectedCase: Case | null,
  expandedSubflows: Set<string>,
  callbacks: {
    onSelect: (step: WorkflowStep) => void;
    onDelete: (stepId: string) => void;
    onToggleSubflow: (stepId: string) => void;
  },
  selectedStepId: string | null,
): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = [];
  const edges: Edge[] = [];
  let yOffset = 0;

  steps.forEach((step, i) => {
    const col = i % COLS;
    const row = Math.floor(i / COLS);
    const x = col * (NODE_WIDTH + H_GAP);
    const y = yOffset + row * (NODE_HEIGHT + V_GAP);

    const nodeData: StepNodeData = {
      step,
      status: selectedCase?.stepStatuses[step.id],
      isExpanded: expandedSubflows.has(step.id),
      onToggleSubflow: () => callbacks.onToggleSubflow(step.id),
      onSelect: () => callbacks.onSelect(step),
      onDelete: () => callbacks.onDelete(step.id),
      selected: selectedStepId === step.id,
      stepIndex: i,
      totalSteps: steps.length,
    };

    nodes.push({
      id: step.id,
      type: 'stepNode',
      position: { x, y },
      data: nodeData as unknown as Record<string, unknown>,
      draggable: true,
    });

    if (i < steps.length - 1) {
      const nextStep = steps[i + 1];
      const nextCol = (i + 1) % COLS;
      const isRowWrap = nextCol === 0;
      const edgeColor =
        step.type === 'human' ? '#f59e0b' : step.type === 'agent' ? '#06b6d4' : '#8b5cf6';
      edges.push({
        id: `e-${step.id}-${nextStep.id}`,
        source: step.id,
        target: nextStep.id,
        type: isRowWrap ? 'smoothstep' : 'default',
        animated: true,
        style: { stroke: edgeColor, strokeWidth: 2, opacity: 0.6 },
        markerEnd: { type: MarkerType.ArrowClosed, color: edgeColor, width: 14, height: 14 },
      });
    }
  });

  const mainRows = Math.ceil(steps.length / COLS);
  yOffset += mainRows * (NODE_HEIGHT + V_GAP) + 40;

  const GROUP_PADDING_X = 32;
  const GROUP_PADDING_TOP = 56;
  const GROUP_PADDING_BOTTOM = 28;

  steps.forEach((step) => {
    if (step.type === 'subflow' && step.subflow && expandedSubflows.has(step.id)) {
      const subSteps = step.subflow.steps;
      const groupId = `group-${step.id}`;
      const groupWidth =
        subSteps.length * (NODE_WIDTH + H_GAP) - H_GAP + GROUP_PADDING_X * 2;
      const groupHeight = NODE_HEIGHT + GROUP_PADDING_TOP + GROUP_PADDING_BOTTOM;

      nodes.push({
        id: groupId,
        type: 'subflowGroup',
        position: { x: 20, y: yOffset },
        data: {
          label: step.subflow.name || step.name,
          stepCount: subSteps.length,
          onCollapse: () => callbacks.onToggleSubflow(step.id),
          width: groupWidth,
          height: groupHeight,
        } as unknown as Record<string, unknown>,
        draggable: true,
        style: { width: groupWidth, height: groupHeight, zIndex: -1 },
      });

      subSteps.forEach((ss, si) => {
        const x = GROUP_PADDING_X + si * (NODE_WIDTH + H_GAP);
        const y = GROUP_PADDING_TOP;

        const nodeData: StepNodeData = {
          step: ss,
          status: selectedCase?.stepStatuses[ss.id],
          onSelect: () => callbacks.onSelect(ss),
          onDelete: () => callbacks.onDelete(ss.id),
        };

        nodes.push({
          id: ss.id,
          type: 'stepNode',
          position: { x, y },
          parentId: groupId,
          extent: 'parent' as const,
          data: nodeData as unknown as Record<string, unknown>,
          draggable: true,
        });

        if (si < subSteps.length - 1) {
          edges.push({
            id: `e-${ss.id}-${subSteps[si + 1].id}`,
            source: ss.id,
            target: subSteps[si + 1].id,
            animated: true,
            style: { stroke: '#8b5cf6', strokeWidth: 2 },
            markerEnd: { type: MarkerType.ArrowClosed, color: '#8b5cf6', width: 16, height: 16 },
          });
        }
      });

      edges.push({
        id: `e-sub-${step.id}-${groupId}`,
        source: step.id,
        target: groupId,
        animated: true,
        style: { stroke: '#8b5cf6', strokeWidth: 2, strokeDasharray: '5 5' },
        markerEnd: { type: MarkerType.ArrowClosed, color: '#8b5cf6', width: 16, height: 16 },
      });

      yOffset += groupHeight + V_GAP;
    }
  });

  return { nodes, edges };
}

export default function WorkflowView({
  workflow,
  selectedCase,
  onWorkflowUpdate,
}: {
  workflow: Workflow;
  selectedCase: Case | null;
  onWorkflowUpdate?: (updated: Workflow) => void;
}) {
  const [selectedStep, setSelectedStep] = useState<WorkflowStep | null>(null);
  const [expandedSubflows, setExpandedSubflows] = useState<Set<string>>(new Set());
  const [showAddModal, setShowAddModal] = useState(false);
  const [localSteps, setLocalSteps] = useState<WorkflowStep[]>(workflow.steps);

  useEffect(() => {
    setLocalSteps(workflow.steps);
    setSelectedStep(null);
    setExpandedSubflows(new Set());
  }, [workflow.id]);

  const handleSelect = useCallback((step: WorkflowStep) => {
    setSelectedStep((prev) => (prev?.id === step.id ? null : step));
  }, []);

  const handleDelete = useCallback((stepId: string) => {
    if (!confirm('Delete this step?')) return;
    setLocalSteps((prev) => prev.filter((s) => s.id !== stepId));
    setSelectedStep((prev) => (prev?.id === stepId ? null : prev));
  }, []);

  const handleToggleSubflow = useCallback((stepId: string) => {
    setExpandedSubflows((prev) => {
      const next = new Set(prev);
      if (next.has(stepId)) next.delete(stepId);
      else next.add(stepId);
      return next;
    });
  }, []);

  const handleUpdateStep = useCallback((updated: WorkflowStep) => {
    setLocalSteps((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
    setSelectedStep(updated);
  }, []);

  const handleAddStep = useCallback((step: WorkflowStep) => {
    setLocalSteps((prev) => [...prev, step]);
    setShowAddModal(false);
  }, []);

  useEffect(() => {
    if (localSteps !== workflow.steps) {
      onWorkflowUpdate?.({ ...workflow, steps: localSteps });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localSteps]);

  const { nodes: layoutedNodes, edges: layoutedEdges } = useMemo(
    () =>
      layoutNodes(
        localSteps,
        selectedCase,
        expandedSubflows,
        {
          onSelect: handleSelect,
          onDelete: handleDelete,
          onToggleSubflow: handleToggleSubflow,
        },
        null,
      ),
    [localSteps, selectedCase, expandedSubflows, handleSelect, handleDelete, handleToggleSubflow],
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(layoutedNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(layoutedEdges);

  useEffect(() => {
    setNodes(layoutedNodes);
    setEdges(layoutedEdges);
  }, [layoutedNodes, layoutedEdges, setNodes, setEdges]);

  useEffect(() => {
    setNodes((nds) =>
      nds.map((n) => {
        const data = n.data as Record<string, unknown>;
        return { ...n, data: { ...data, selected: selectedStep?.id === n.id } };
      }),
    );
  }, [selectedStep?.id, setNodes]);

  const onPaneClick = useCallback(() => {
    setSelectedStep(null);
  }, []);

  const currentSelectedStep = selectedStep
    ? localSteps.find((s) => s.id === selectedStep.id) ||
      localSteps.flatMap((s) => s.subflow?.steps || []).find((s) => s.id === selectedStep.id) ||
      selectedStep
    : null;

  return (
    <div className="relative w-full h-full">
      {selectedCase && (() => {
        const totalSteps = localSteps.length;
        const doneSteps = Object.values(selectedCase.stepStatuses).filter((s) => s === 'done').length;
        const progress = Math.round((doneSteps / totalSteps) * 100);
        const currentStep = localSteps.find((s) => s.id === selectedCase.currentStepId);
        return (
          <div
            className="absolute top-3 left-3 z-10 max-w-md bg-card border border-border rounded-lg shadow-lg p-3 flex items-center gap-3"
            data-testid="case-banner"
          >
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 text-xs">
                <span className="font-semibold truncate">{selectedCase.name}</span>
                <span className="font-mono text-[10px] text-muted-foreground uppercase">
                  {selectedCase.status}
                </span>
              </div>
              <div className="text-[10px] font-mono text-muted-foreground mt-0.5">
                {doneSteps}/{totalSteps} · {progress}%{currentStep && ` · → ${currentStep.name}`}
              </div>
            </div>
          </div>
        );
      })()}

      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        onPaneClick={onPaneClick}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.3}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
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
              : t === 'trigger'
              ? '#f97316'
              : t === 'condition'
              ? '#ec4899'
              : t === 'input'
              ? '#14b8a6'
              : t === 'notification'
              ? '#facc15'
              : '#8b5cf6';
          }}
        />
        <Panel position="top-right">
          <Button
            size="sm"
            data-testid="add-step-button"
            onClick={() => setShowAddModal(true)}
          >
            <Plus className="h-4 w-4" /> Add Step
          </Button>
        </Panel>
      </ReactFlow>

      {currentSelectedStep && (
        <DetailPanel
          step={currentSelectedStep}
          status={selectedCase?.stepStatuses[currentSelectedStep.id]}
          onClose={() => setSelectedStep(null)}
          onUpdate={handleUpdateStep}
          onDelete={handleDelete}
        />
      )}

      <AddStepModal open={showAddModal} onAdd={handleAddStep} onClose={() => setShowAddModal(false)} />
    </div>
  );
}
