import { memo } from 'react';
import { type NodeProps } from '@xyflow/react';

export type SubflowGroupNodeData = {
  label: string;
  stepCount: number;
  onCollapse: () => void;
  width: number;
  height: number;
};

function SubflowGroupNode({ data }: NodeProps) {
  const { label, stepCount, onCollapse, width, height } = data as unknown as SubflowGroupNodeData;

  return (
    <div
      data-testid={`subflow-group-${label}`}
      className="rounded-xl border-2 border-dashed border-violet-500/40 bg-violet-500/5"
      style={{ width, height }}
    >
      <div className="flex items-center justify-between px-4 py-2 border-b border-dashed border-violet-500/30">
        <div className="flex items-center gap-2">
          <span>📂</span>
          <span className="text-xs font-semibold">{label}</span>
          <span className="font-mono text-[10px] text-muted-foreground">{stepCount} steps</span>
        </div>
        <button
          type="button"
          data-testid="subflow-collapse"
          className="text-[10px] font-mono text-muted-foreground hover:text-foreground"
          onClick={(e) => {
            e.stopPropagation();
            onCollapse();
          }}
        >
          ▼ collapse
        </button>
      </div>
    </div>
  );
}

export default memo(SubflowGroupNode);
