import type { WorkflowStep } from '../data/types';

const typeConfig = {
  human: { badge: '👤', label: 'Human', border: '#f0a500', bg: 'rgba(240,165,0,0.08)' },
  agent: { badge: '🤖', label: 'Agent', border: '#00d2ff', bg: 'rgba(0,210,255,0.08)' },
  subflow: { badge: '📂', label: 'Subflow', border: '#8b5cf6', bg: 'rgba(139,92,246,0.08)' },
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

export default function StepCard({ step, status, isExpanded, onToggleSubflow }: {
  step: WorkflowStep;
  status?: string;
  isExpanded?: boolean;
  onToggleSubflow?: () => void;
}) {
  const cfg = typeConfig[step.type];

  return (
    <div
      className={`relative group w-44 rounded-xl p-3 transition-all hover:scale-[1.03] cursor-default ${step.type === 'subflow' ? 'cursor-pointer' : ''} ${status === 'in-progress' ? 'animate-pulse-status' : ''}`}
      style={{
        background: cfg.bg,
        border: `1.5px solid ${status ? statusColors[status] || cfg.border : cfg.border}`,
        boxShadow: status === 'in-progress' ? `0 0 12px ${statusColors['in-progress']}40` : undefined,
      }}
      onClick={step.type === 'subflow' ? onToggleSubflow : undefined}
    >
      {/* Status indicator */}
      {status && (
        <div className="absolute -top-2 -right-2 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white" style={{ background: statusColors[status] }}>
          {statusIcons[status]}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <span className="font-mono text-[9px] px-1.5 py-0.5 rounded text-gray-300 bg-white/5 uppercase">{cfg.badge} {cfg.label}</span>
        {step.estimatedTime && <span className="font-mono text-[9px] text-gray-500">{step.estimatedTime}</span>}
      </div>

      {/* Name */}
      <h3 className="text-sm font-semibold text-white mb-1 leading-tight">{step.name}</h3>

      {/* Assignee */}
      <p className="text-[11px] text-gray-400 mb-1.5">{step.assignee}</p>

      {/* Tools */}
      {step.tools && step.tools.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {step.tools.map(t => (
            <span key={t} className="font-mono text-[8px] px-1 py-0.5 rounded bg-white/5 text-gray-500">{t}</span>
          ))}
        </div>
      )}

      {/* Subflow indicator */}
      {step.type === 'subflow' && (
        <div className="mt-2 text-[10px] text-purple-400 font-mono">
          {isExpanded ? '▼ collapse' : '▶ expand'} · {step.subflow?.steps.length} steps
        </div>
      )}

      {/* Tooltip */}
      <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-52 p-2.5 rounded-lg bg-gray-900 border border-white/10 text-xs text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-xl">
        {step.description}
      </div>
    </div>
  );
}
