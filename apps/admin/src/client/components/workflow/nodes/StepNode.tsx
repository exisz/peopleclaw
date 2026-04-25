import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import * as LucideIcons from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Check, X as XIcon, Loader2, Hand, Circle, Ban } from 'lucide-react';
import type { WorkflowStep } from '../../../types';
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
  create_case:  { badge: '🆕', label: 'Create Case', ring: 'ring-blue-500/40',   tint: 'bg-blue-500/5',    accent: 'from-blue-500' },
};

// Per-status visual mapping (case execution states)
// pending | running | done | failed | waiting_human
const statusBorderClass: Record<string, string> = {
  pending: 'border-muted-foreground/30',
  running: 'border-blue-500 animate-pulse',
  done: 'border-emerald-500',
  failed: 'border-red-500',
  waiting_human: 'border-amber-500',
  // legacy synonyms
  'in-progress': 'border-blue-500 animate-pulse',
  blocked: 'border-red-500',
};

export type StepNodeData = {
  step: WorkflowStep;
  iconName?: string; // lucide-react name from template
  status?: string;
  errorMessage?: string;
  disabled?: boolean;
  selected?: boolean;
  stepIndex?: number;
  totalSteps?: number;
  onErrorClick?: (msg: string) => void;
  modeOverride?: 'auto' | 'human'; // PLANET-1251: per-case mode override
};

function StepNode({ data, selected }: NodeProps) {
  const {
    step,
    iconName,
    status,
    errorMessage,
    disabled,
    stepIndex,
    totalSteps,
    onErrorClick,
    modeOverride,
  } = data as unknown as StepNodeData;
  const cfg = typeConfig[step.type] || typeConfig.human;

  // Resolve icon: template iconName > type-based fallback
  const Icon: LucideIcon | null = iconName
    ? ((LucideIcons as unknown as Record<string, LucideIcon>)[iconName] ?? null)
    : null;

  const statusBorder = status ? statusBorderClass[status] : null;

  return (
    <div
      data-testid={`step-node-${step.id}`}
      data-status={status ?? ''}
      data-disabled={disabled ? 'true' : 'false'}
      className={cn(
        'relative w-[220px] min-h-[110px] rounded-xl border-2 bg-card text-card-foreground p-3 shadow-md transition-all overflow-hidden',
        cfg.tint,
        statusBorder ?? 'border-border',
        selected && `ring-2 ${cfg.ring} shadow-xl scale-[1.02]`,
        disabled && 'opacity-50',
      )}
      style={
        disabled
          ? {
              backgroundImage:
                'repeating-linear-gradient(45deg, transparent, transparent 6px, rgba(127,127,127,0.10) 6px, rgba(127,127,127,0.10) 12px)',
            }
          : undefined
      }
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

      <div className={cn('absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r to-transparent', cfg.accent)} />

      {/* Status badge (top-right) */}
      {status && (
        <button
          type="button"
          data-testid={`step-status-${step.id}`}
          data-status={status}
          onClick={(e) => {
            e.stopPropagation();
            if (status === 'failed' && errorMessage) onErrorClick?.(errorMessage);
          }}
          className={cn(
            'absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center text-white',
            status === 'done' && 'bg-emerald-500',
            status === 'running' && 'bg-blue-500',
            (status === 'failed' || status === 'blocked') && 'bg-red-500 cursor-pointer',
            status === 'waiting_human' && 'bg-amber-500',
            status === 'pending' && 'bg-muted-foreground/40',
            status === 'in-progress' && 'bg-blue-500',
          )}
        >
          {status === 'done' && <Check className="w-3 h-3" />}
          {status === 'running' && <Loader2 className="w-3 h-3 animate-spin" />}
          {(status === 'failed' || status === 'blocked') && <XIcon className="w-3 h-3" />}
          {status === 'waiting_human' && <Hand className="w-3 h-3" />}
          {status === 'pending' && <Circle className="w-3 h-3" />}
          {status === 'in-progress' && <Loader2 className="w-3 h-3 animate-spin" />}
        </button>
      )}

      <div className="flex items-center justify-between mb-1.5 pt-1">
        <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground border-l-2 border-current pl-1.5 flex items-center gap-1">
          {Icon ? <Icon className="h-3 w-3" /> : <span>{cfg.badge}</span>}
          {cfg.label}
        </span>
        <div className="flex items-center gap-1.5 text-[9px] font-mono text-muted-foreground pr-6">
          {disabled && <Ban className="h-3 w-3" />}
          {stepIndex !== undefined && totalSteps !== undefined && (
            <span>
              {stepIndex + 1}/{totalSteps}
            </span>
          )}
        </div>
      </div>

      <h3 className="text-sm font-semibold leading-snug mb-1 pr-6">{step.name}</h3>

      {step.assignee && (
        <p className="text-xs text-muted-foreground flex items-center gap-1 truncate">
          <span className="text-[10px]">→</span>
          <span className="truncate">{step.assignee}</span>
        </p>
      )}

      {step.tools && step.tools.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {step.tools.slice(0, 3).map((t) => (
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

      {/* PLANET-1251: mode override indicator */}
      {modeOverride && (
        <div className="mt-2 flex items-center gap-1">
          <span className={cn(
            'text-[9px] font-mono px-1.5 py-0.5 rounded border',
            modeOverride === 'auto'
              ? 'border-cyan-400 bg-cyan-50 text-cyan-700 dark:bg-cyan-950 dark:text-cyan-300 dark:border-cyan-700'
              : 'border-amber-400 bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-700',
          )}>
            {modeOverride === 'auto' ? '\uD83E\uDD16 AI' : '\u270B \u4EBA\u5DE5'} (\u5DF2\u5207\u6362)
          </span>
        </div>
      )}
    </div>
  );
}

export default memo(StepNode);
