import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { WorkflowStep } from '../../data/types';

const typeConfig = {
  human: { badge: '👤', label: 'Human', border: '#f0a500', bg: 'linear-gradient(145deg, rgba(240,165,0,0.12) 0%, rgba(240,165,0,0.04) 100%)', bgFlat: 'rgba(240,165,0,0.08)', glow: 'rgba(240,165,0,0.25)', accent: '#f0a500' },
  agent: { badge: '🤖', label: 'Agent', border: '#00d2ff', bg: 'linear-gradient(145deg, rgba(0,210,255,0.12) 0%, rgba(0,210,255,0.04) 100%)', bgFlat: 'rgba(0,210,255,0.08)', glow: 'rgba(0,210,255,0.25)', accent: '#00d2ff' },
  subflow: { badge: '📂', label: 'Subflow', border: '#8b5cf6', bg: 'linear-gradient(145deg, rgba(139,92,246,0.12) 0%, rgba(139,92,246,0.04) 100%)', bgFlat: 'rgba(139,92,246,0.08)', glow: 'rgba(139,92,246,0.25)', accent: '#8b5cf6' },
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
  stepIndex?: number;
  totalSteps?: number;
};

function StepNode({ data }: NodeProps) {
  const { step, status, isExpanded, onToggleSubflow, onSelect, onDelete, selected, stepIndex, totalSteps } = data as unknown as StepNodeData;
  const cfg = typeConfig[step.type];
  const borderColor = status ? statusColors[status] || cfg.border : cfg.border;
  const isInProgress = status === 'in-progress';
  const isDone = status === 'done';

  return (
    <div
      className={`step-node ${isInProgress ? 'step-node--pulse' : ''} ${selected ? 'step-node--selected' : ''} ${isDone ? 'step-node--done' : ''}`}
      style={{
        background: cfg.bg,
        borderColor,
        boxShadow: selected
          ? `0 0 0 2px ${cfg.border}, 0 0 24px ${cfg.glow}, 0 8px 32px rgba(0,0,0,0.4)`
          : isInProgress
          ? `0 0 16px ${statusColors['in-progress']}50, 0 4px 16px rgba(0,0,0,0.3)`
          : `0 4px 16px rgba(0,0,0,0.3), 0 1px 3px rgba(0,0,0,0.2)`,
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

      {/* Top accent line */}
      <div className="step-node__accent" style={{ background: `linear-gradient(90deg, ${cfg.accent}, transparent)` }} />

      {/* Status indicator */}
      {status && (
        <div className="step-node__status" style={{ background: statusColors[status], boxShadow: `0 0 8px ${statusColors[status]}60` }}>
          {statusIcons[status]}
        </div>
      )}

      {/* Header */}
      <div className="step-node__header">
        <span className="step-node__badge" style={{ borderLeft: `2px solid ${cfg.accent}` }}>{cfg.badge} {cfg.label}</span>
        <div className="step-node__meta">
          {stepIndex !== undefined && totalSteps !== undefined && (
            <span className="step-node__index">{stepIndex + 1}/{totalSteps}</span>
          )}
          {step.estimatedTime && <span className="step-node__time">⏱ {step.estimatedTime}</span>}
        </div>
      </div>

      {/* Name */}
      <h3 className="step-node__name">{step.name}</h3>

      {/* Assignee */}
      <p className="step-node__assignee">
        <span className="step-node__assignee-icon">→</span>
        {step.assignee}
      </p>

      {/* Tools */}
      {step.tools && step.tools.length > 0 && (
        <div className="step-node__tools">
          {step.tools.slice(0, 3).map(t => (
            <span key={t} className="step-node__tool">{t}</span>
          ))}
          {step.tools.length > 3 && <span className="step-node__tool step-node__tool--more">+{step.tools.length - 3}</span>}
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
