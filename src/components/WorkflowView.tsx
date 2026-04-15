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
import type { Workflow, WorkflowStep, Case } from '../data/types';
import StepNode from './nodes/StepNode';
import type { StepNodeData } from './nodes/StepNode';
import DetailPanel from './panels/DetailPanel';
import AddStepModal from './panels/AddStepModal';

const NODE_WIDTH = 220;
const NODE_HEIGHT = 120;
const H_GAP = 80;
const V_GAP = 40;
const COLS = 5;

const nodeTypes = { stepNode: StepNode };

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

  // Layout main steps in rows
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
      data: nodeData as any,
      draggable: true,
    });

    // Edge to next step
    if (i < steps.length - 1) {
      const nextStep = steps[i + 1];
      const nextCol = (i + 1) % COLS;
      const isRowWrap = nextCol === 0;
      // Color edge based on source step type
      const edgeColor = step.type === 'human' ? '#f0a50080' : step.type === 'agent' ? '#00d2ff80' : '#8b5cf670';
      edges.push({
        id: `e-${step.id}-${nextStep.id}`,
        source: step.id,
        target: nextStep.id,
        type: isRowWrap ? 'smoothstep' : 'default',
        animated: true,
        style: { stroke: edgeColor, strokeWidth: 2 },
        markerEnd: { type: MarkerType.ArrowClosed, color: edgeColor, width: 14, height: 14 },
        label: isRowWrap ? '' : undefined,
      });
    }
  });

  // Layout expanded subflows
  const mainRows = Math.ceil(steps.length / COLS);
  yOffset += mainRows * (NODE_HEIGHT + V_GAP) + 40;

  steps.forEach((step) => {
    if (step.type === 'subflow' && step.subflow && expandedSubflows.has(step.id)) {
      const subSteps = step.subflow.steps;
      subSteps.forEach((ss, si) => {
        const x = si * (NODE_WIDTH + H_GAP) + 40;
        const y = yOffset;

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
          data: nodeData as any,
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

      // Edge from parent to subflow first step
      edges.push({
        id: `e-sub-${step.id}-${subSteps[0].id}`,
        source: step.id,
        target: subSteps[0].id,
        animated: true,
        style: { stroke: '#8b5cf6', strokeWidth: 2, strokeDasharray: '5 5' },
        markerEnd: { type: MarkerType.ArrowClosed, color: '#8b5cf6', width: 16, height: 16 },
      });

      yOffset += NODE_HEIGHT + V_GAP + 40;
    }
  });

  return { nodes, edges };
}

export default function WorkflowView({ workflow, selectedCase }: {
  workflow: Workflow;
  selectedCase: Case | null;
}) {
  const [selectedStep, setSelectedStep] = useState<WorkflowStep | null>(null);
  const [expandedSubflows, setExpandedSubflows] = useState<Set<string>>(new Set());
  const [showAddModal, setShowAddModal] = useState(false);
  const [localSteps, setLocalSteps] = useState<WorkflowStep[]>(workflow.steps);

  // Reset when workflow changes
  useEffect(() => {
    setLocalSteps(workflow.steps);
    setSelectedStep(null);
    setExpandedSubflows(new Set());
  }, [workflow.id]);

  const handleSelect = useCallback((step: WorkflowStep) => {
    setSelectedStep(prev => prev?.id === step.id ? null : step);
  }, []);

  const handleDelete = useCallback((stepId: string) => {
    if (!confirm('Delete this step?')) return;
    setLocalSteps(prev => prev.filter(s => s.id !== stepId));
    setSelectedStep(prev => prev?.id === stepId ? null : prev);
  }, []);

  const handleToggleSubflow = useCallback((stepId: string) => {
    setExpandedSubflows(prev => {
      const next = new Set(prev);
      if (next.has(stepId)) next.delete(stepId);
      else next.add(stepId);
      return next;
    });
  }, []);

  const handleUpdateStep = useCallback((updated: WorkflowStep) => {
    setLocalSteps(prev => prev.map(s => s.id === updated.id ? updated : s));
    setSelectedStep(updated);
  }, []);

  const handleAddStep = useCallback((step: WorkflowStep) => {
    setLocalSteps(prev => [...prev, step]);
    setShowAddModal(false);
  }, []);

  const { nodes: layoutedNodes, edges: layoutedEdges } = useMemo(
    () => layoutNodes(localSteps, selectedCase, expandedSubflows, {
      onSelect: handleSelect,
      onDelete: handleDelete,
      onToggleSubflow: handleToggleSubflow,
    }, null),
    [localSteps, selectedCase, expandedSubflows, handleSelect, handleDelete, handleToggleSubflow]
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(layoutedNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(layoutedEdges);

  // Sync layout when workflow structure changes (NOT on selection change)
  useEffect(() => {
    setNodes(layoutedNodes);
    setEdges(layoutedEdges);
  }, [layoutedNodes, layoutedEdges, setNodes, setEdges]);

  // Update selection highlighting in-place without resetting positions
  useEffect(() => {
    setNodes(nds => nds.map(n => {
      const data = n.data as any;
      return { ...n, data: { ...data, selected: selectedStep?.id === n.id } };
    }));
  }, [selectedStep?.id, setNodes]);

  const onPaneClick = useCallback(() => {
    setSelectedStep(null);
  }, []);

  // Find the latest version of selected step from localSteps
  const currentSelectedStep = selectedStep
    ? localSteps.find(s => s.id === selectedStep.id) ||
      localSteps.flatMap(s => s.subflow?.steps || []).find(s => s.id === selectedStep.id) ||
      selectedStep
    : null;

  return (
    <div className="workflow-container">
      {/* Case overlay banner */}
      {selectedCase && (() => {
        const totalSteps = localSteps.length;
        const doneSteps = Object.values(selectedCase.stepStatuses).filter(s => s === 'done').length;
        const blockedSteps = Object.values(selectedCase.stepStatuses).filter(s => s === 'blocked').length;
        const progress = Math.round((doneSteps / totalSteps) * 100);
        const currentStep = localSteps.find(s => s.id === selectedCase.currentStepId);
        return (
          <div className="workflow-case-banner">
            <span className={`workflow-case-dot ${selectedCase.status === 'active' ? 'workflow-case-dot--active' : selectedCase.status === 'completed' ? 'workflow-case-dot--done' : 'workflow-case-dot--paused'}`} />
            <div className="workflow-case-info">
              <div className="workflow-case-top">
                <span className="workflow-case-name">{selectedCase.name}</span>
                <span className="workflow-case-status">{selectedCase.status}</span>
              </div>
              <div className="workflow-case-bottom">
                <span className="workflow-case-progress-text">{doneSteps}/{totalSteps} steps · {progress}%</span>
                {blockedSteps > 0 && <span className="workflow-case-blocked">⚠ {blockedSteps} blocked</span>}
                {currentStep && <span className="workflow-case-current">→ {currentStep.name}</span>}
              </div>
              <div className="workflow-case-progress-bar">
                <div className="workflow-case-progress-fill" style={{ width: `${progress}%` }} />
              </div>
            </div>
            <button className="workflow-case-dismiss" onClick={() => { /* parent handles */ }}>✕</button>
          </div>
        );
      })()}

      <div className="workflow-flow-wrapper">
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
          <Background color="#1e293b" gap={20} size={1} />
          <Controls className="flow-controls" />
          <MiniMap
            nodeColor={(n) => {
              const data = n.data as any;
              if (!data?.step) return '#475569';
              const t = data.step.type;
              return t === 'human' ? '#f0a500' : t === 'agent' ? '#00d2ff' : t === 'trigger' ? '#ff6b35' : '#8b5cf6';
            }}
            maskColor="rgba(15,15,35,0.8)"
            style={{ background: '#0f0f23', border: '1px solid rgba(255,255,255,0.05)' }}
          />
          <Panel position="top-right">
            <button className="workflow-add-btn" onClick={() => setShowAddModal(true)}>
              ＋ Add Step
            </button>
          </Panel>
        </ReactFlow>
      </div>

      {/* Detail panel */}
      {currentSelectedStep && (
        <DetailPanel
          step={currentSelectedStep}
          status={selectedCase?.stepStatuses[currentSelectedStep.id]}
          onClose={() => setSelectedStep(null)}
          onUpdate={handleUpdateStep}
        />
      )}

      {/* Add step modal */}
      {showAddModal && (
        <AddStepModal onAdd={handleAddStep} onClose={() => setShowAddModal(false)} />
      )}
    </div>
  );
}
