import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { WorkflowStep } from '../../../data/types';
import { cn } from '../../../lib/utils';

const typeConfig: Record<
  string,
  { badge: string; label: string; ring: string; tint: string; accent: string }
> = {
  human:        { badge: '👤', label: 'Human',     ring: 'ring-amber-500/40',   tint: 'bg-amber-500/5',   accent: 'from-amber-500' },
  agent:        { badge: '🤖', label: 'Agent',     ring: 'ring-cyan-500/40',    tint: 'bg-cyan-500/5',    accent: 'from-cyan-500' },
  subflow:      { badge: '📂', label: 'Subflow',   ring: 'ring-violet-500/40',  tint: 'bg-violet-500/5',  accent: 'from-violet-500' },
  trigger:      { badge: '⚡', label: 'Trigger',   ring: 'ring-orange-500/40',  tint: 'bg-orange-500/5',  accent: 'from-orange-500' },
  condition:    { badge: '🔀', label: 'Condition', ring: 'ring-pink-500/40',    tint: 'bg-pink-500/5',    accent: 'from-pink-500' },
  input:        { badge: '📝', label: 'Data Input',ring: 'ring-teal-500/40',    tint: 'bg-teal-500/5',    accent: 'from-teal-500' },
  notification: { badge: '🔔', label: 'Notify',    ring: 'ring-yellow-400/40',  tint: 'bg-yellow-400/5',  accent: 'from-yellow-400' },
};

const statusBg: Record<string, string> = {
  done: 'bg-emerald-500',
  'in-progress': 'bg-amber-500',
  blocked: 'bg-red-500',
  pending: 'bg-muted-foreground/40',
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
  const {
    step,
    status,
    isExpanded,
    onToggleSubflow,
    onSelect,
    onDelete,
    selected,
    stepIndex,
    totalSteps,
  } = data as unknown as StepNodeData;
  const cfg = typeConfig[step.type] || typeConfig.human;
  const isInProgress = status === 'in-progress';

  return (
    <div
      data-testid={`step-node-${step.id}`}
      className={cn(
        'relative w-[220px] min-h-[120px] rounded-xl border bg-card text-card-foreground p-3 shadow-md transition-all cursor-pointer overflow-hidden',
        cfg.tint,
        selected ? `ring-2 ${cfg.ring} shadow-xl` : 'border-border hover:border-foreground/20',
        isInProgress && 'animate-pulse',
      )}
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
      <Handle
        type="target"
        position={Position.Left}
        className="!w-2 !h-2 !bg-border !border-card"
      />
      <Handle
        type="source"
        position={Position.Right}
        className="!w-2 !h-2 !bg-border !border-card"
      />

      {/* Top accent line */}
      <div className={cn('absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r to-transparent', cfg.accent)} />

      {/* Status indicator */}
      {status && (
        <div
          data-testid={`step-status-${step.id}`}
          className={cn(
            'absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center text-[10px] text-white font-bold',
            statusBg[status],
          )}
        >
          {statusIcons[status]}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-1.5 pt-1">
        <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground border-l-2 border-current pl-1.5">
          {cfg.badge} {cfg.label}
        </span>
        <div className="flex items-center gap-1.5 text-[9px] font-mono text-muted-foreground">
          {stepIndex !== undefined && totalSteps !== undefined && (
            <span>
              {stepIndex + 1}/{totalSteps}
            </span>
          )}
          {step.estimatedTime && <span>⏱ {step.estimatedTime}</span>}
        </div>
      </div>

      <h3 className="text-sm font-semibold leading-snug mb-1">{step.name}</h3>

      <p className="text-xs text-muted-foreground flex items-center gap-1">
        <span className="text-[10px]">→</span>
        {step.assignee}
      </p>

      {step.tools && step.tools.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {step.tools.slice(0, 3).map(t => (
            <span
              key={t}
              className="text-[9px] font-mono px-1.5 py-0.5 rounded border border-border bg-background/60"
            >
              {t}
            </span>
          ))}
          {step.tools.length > 3 && (
            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded border border-border bg-background/60 text-muted-foreground">
              +{step.tools.length - 3}
            </span>
          )}
        </div>
      )}

      {step.type === 'subflow' && (
        <button
          type="button"
          data-testid={`step-action-toggle-${step.id}`}
          className="mt-2 w-full text-[10px] font-mono text-muted-foreground hover:text-foreground py-1 border border-dashed border-border rounded transition-colors"
          onClick={(e) => {
            e.stopPropagation();
            onToggleSubflow?.();
          }}
        >
          {isExpanded ? '▼ collapse' : '▶ expand'} · {step.subflow?.steps.length} steps
        </button>
      )}
    </div>
  );
}

export default memo(StepNode);
