import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { WorkflowStep } from '../../data/types';

const typeConfig = {
  human: { badge: '👤', label: 'Human', border: '#f0a500', bg: 'rgba(240,165,0,0.08)', glow: 'rgba(240,165,0,0.25)' },
  agent: { badge: '🤖', label: 'Agent', border: '#00d2ff', bg: 'rgba(0,210,255,0.08)', glow: 'rgba(0,210,255,0.25)' },
  subflow: { badge: '📂', label: 'Subflow', border: '#8b5cf6', bg: 'rgba(139,92,246,0.08)', glow: 'rgba(139,92,246,0.25)' },
};

const statusColors: Record<string, string> = {
  done: '#22c55e',
  'in-progress': '#f59e0b',
  blocked: '#ef4444',
  pending: '#4b5563',
};

const statusIcons: Record<string, string> = {
  done: '✓',
  'in-progress': '●',
  blocked: '✕',
  pending: '○',
};

export type StepNodeData = {
  step: WorkflowStep;
  status?: string;
  isExpanded?: boolean;
  onToggleSubflow?: () => void;
  onSelect?: () => void;
  onDelete?: () => void;
  selected?: boolean;
};

function StepNode({ data }: NodeProps) {
  const { step, status, isExpanded, onToggleSubflow, onSelect, onDelete, selected } = data as unknown as StepNodeData;
  const cfg = typeConfig[step.type];
  const borderColor = status ? statusColors[status] || cfg.border : cfg.border;
  const isInProgress = status === 'in-progress';

  return (
    <div
      className={`step-node ${isInProgress ? 'step-node--pulse' : ''} ${selected ? 'step-node--selected' : ''}`}
      style={{
        background: cfg.bg,
        borderColor,
        boxShadow: selected
          ? `0 0 0 2px ${cfg.border}, 0 0 20px ${cfg.glow}`
          : isInProgress
          ? `0 0 12px ${statusColors['in-progress']}40`
          : `0 2px 8px rgba(0,0,0,0.3)`,
      }}
      onClick={(e) => {
        e.stopPropagation();
        if (step.type === 'subflow' && e.detail === 2) {
          onToggleSubflow?.();
        } else {
          onSelect?.();
        }
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onDelete?.();
      }}
    >
      <Handle type="target" position={Position.Left} className="step-handle" />
      <Handle type="source" position={Position.Right} className="step-handle" />

      {/* Status indicator */}
      {status && (
        <div className="step-node__status" style={{ background: statusColors[status] }}>
          {statusIcons[status]}
        </div>
      )}

      {/* Header */}
      <div className="step-node__header">
        <span className="step-node__badge">{cfg.badge} {cfg.label}</span>
        {step.estimatedTime && <span className="step-node__time">{step.estimatedTime}</span>}
      </div>

      {/* Name */}
      <h3 className="step-node__name">{step.name}</h3>

      {/* Assignee */}
      <p className="step-node__assignee">{step.assignee}</p>

      {/* Tools */}
      {step.tools && step.tools.length > 0 && (
        <div className="step-node__tools">
          {step.tools.slice(0, 3).map(t => (
            <span key={t} className="step-node__tool">{t}</span>
          ))}
          {step.tools.length > 3 && <span className="step-node__tool">+{step.tools.length - 3}</span>}
        </div>
      )}

      {/* Subflow indicator */}
      {step.type === 'subflow' && (
        <button
          className="step-node__subflow-btn"
          onClick={(e) => { e.stopPropagation(); onToggleSubflow?.(); }}
        >
          {isExpanded ? '▼ collapse' : '▶ expand'} · {step.subflow?.steps.length} steps
        </button>
      )}
    </div>
  );
}

export default memo(StepNode);
