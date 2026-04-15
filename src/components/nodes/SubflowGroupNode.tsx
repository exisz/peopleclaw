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
      className="subflow-group"
      style={{ width, height }}
    >
      <div className="subflow-group__header">
        <div className="subflow-group__title">
          <span className="subflow-group__icon">📂</span>
          <span className="subflow-group__label">{label}</span>
          <span className="subflow-group__count">{stepCount} steps</span>
        </div>
        <button
          className="subflow-group__collapse"
          onClick={(e) => { e.stopPropagation(); onCollapse(); }}
        >
          ▼ collapse
        </button>
      </div>
    </div>
  );
}

export default memo(SubflowGroupNode);
