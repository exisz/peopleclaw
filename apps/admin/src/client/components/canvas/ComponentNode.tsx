/**
 * Custom xyflow node: icon + name + type badge + status light + Run button
 * (PLANET-1421)
 */
import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';

export interface ComponentNodeData {
  label: string;
  name: string;
  type: string; // FRONTEND | BACKEND | FULLSTACK
  icon?: string;
  status: 'idle' | 'running' | 'done' | 'error';
  onRun?: () => void;
}

const STATUS_COLORS: Record<string, string> = {
  idle: 'bg-gray-400',
  running: 'bg-yellow-400 animate-pulse',
  done: 'bg-green-500',
  error: 'bg-red-500',
};

const TYPE_COLORS: Record<string, string> = {
  BACKEND: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  FULLSTACK: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300',
  FRONTEND: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300',
};

function ComponentNode({ data }: NodeProps) {
  const d = data as unknown as ComponentNodeData;
  const canRun = d.type !== 'FRONTEND';

  return (
    <div className="bg-card border border-border rounded-lg shadow-sm px-3 py-2 min-w-[160px] select-none">
      <Handle type="target" position={Position.Left} className="!w-2 !h-2" />

      {/* Header: icon + name + status */}
      <div className="flex items-center gap-2 mb-1">
        <span className="text-base">{d.icon || '📦'}</span>
        <span className="text-sm font-medium truncate flex-1">{d.name}</span>
        <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${STATUS_COLORS[d.status] || STATUS_COLORS.idle}`} />
      </div>

      {/* Type badge */}
      <div className="flex items-center justify-between">
        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${TYPE_COLORS[d.type] || 'bg-muted text-muted-foreground'}`}>
          {d.type}
        </span>

        {/* Run button */}
        <button
          onClick={e => { e.stopPropagation(); d.onRun?.(); }}
          disabled={!canRun || d.status === 'running'}
          className="text-xs px-1.5 py-0.5 rounded bg-primary/10 hover:bg-primary/20 text-primary disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          title={canRun ? 'Run' : 'Frontend — cannot run directly'}
        >
          ▶
        </button>
      </div>

      <Handle type="source" position={Position.Right} className="!w-2 !h-2" />
    </div>
  );
}

export default memo(ComponentNode);
