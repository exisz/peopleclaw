import type { WorkflowStep } from '../../data/types';

export interface DetailPanelProps {
  step: WorkflowStep;
  status?: string;
  onClose: () => void;
  onUpdate: (updated: WorkflowStep) => void;
}

const typeConfig: Record<string, { badge: string; label: string; color: string }> = {
  human: { badge: '👤', label: 'Human', color: '#f0a500' },
  agent: { badge: '🤖', label: 'Agent', color: '#00d2ff' },
  subflow: { badge: '📂', label: 'Subflow', color: '#8b5cf6' },
  trigger: { badge: '⚡', label: 'Trigger', color: '#ff6b35' },
};

const statusColors: Record<string, { bg: string; text: string; label: string }> = {
  done: { bg: 'rgba(34,197,94,0.15)', text: '#22c55e', label: 'Done' },
  'in-progress': { bg: 'rgba(245,158,11,0.15)', text: '#f59e0b', label: 'In Progress' },
  blocked: { bg: 'rgba(239,68,68,0.15)', text: '#ef4444', label: 'Blocked' },
  pending: { bg: 'rgba(107,114,128,0.15)', text: '#6b7280', label: 'Pending' },
};

export default function DetailPanel({ step, status, onClose, onUpdate }: DetailPanelProps) {
  const cfg = typeConfig[step.type];
  const st = status ? statusColors[status] : null;

  return (
    <div className="detail-panel">
      <div className="detail-panel__header">
        <h3 className="detail-panel__title">{step.name}</h3>
        <button onClick={onClose} className="detail-panel__close">✕</button>
      </div>

      {/* Type & Status */}
      <div className="detail-panel__badges">
        <span className="detail-panel__type-badge" style={{ borderColor: cfg.color, color: cfg.color }}>
          {cfg.badge} {cfg.label}
        </span>
        {st && (
          <span className="detail-panel__status-badge" style={{ background: st.bg, color: st.text }}>
            {st.label}
          </span>
        )}
      </div>

      {/* Editable fields */}
      <div className="detail-panel__fields">
        <label className="detail-panel__label">
          Name
          <input
            className="detail-panel__input"
            value={step.name}
            onChange={(e) => onUpdate({ ...step, name: e.target.value })}
          />
        </label>

        <label className="detail-panel__label">
          Assignee
          <input
            className="detail-panel__input"
            value={step.assignee}
            onChange={(e) => onUpdate({ ...step, assignee: e.target.value })}
          />
        </label>

        <label className="detail-panel__label">
          Description
          <textarea
            className="detail-panel__textarea"
            value={step.description}
            onChange={(e) => onUpdate({ ...step, description: e.target.value })}
            rows={3}
          />
        </label>

        <label className="detail-panel__label">
          Estimated Time
          <input
            className="detail-panel__input"
            value={step.estimatedTime || ''}
            onChange={(e) => onUpdate({ ...step, estimatedTime: e.target.value })}
          />
        </label>

        <label className="detail-panel__label">
          Type
          <select
            className="detail-panel__input"
            value={step.type}
            onChange={(e) => onUpdate({ ...step, type: e.target.value as WorkflowStep['type'] })}
          >
            <option value="human">👤 Human</option>
            <option value="agent">🤖 Agent</option>
            <option value="subflow">📂 Subflow</option>
          </select>
        </label>
      </div>

      {/* Tools */}
      {step.tools && step.tools.length > 0 && (
        <div className="detail-panel__section">
          <h4 className="detail-panel__section-title">Tools</h4>
          <div className="detail-panel__tools">
            {step.tools.map(t => (
              <span key={t} className="detail-panel__tool-chip">{t}</span>
            ))}
          </div>
        </div>
      )}

      {/* Subflow info */}
      {step.subflow && (
        <div className="detail-panel__section">
          <h4 className="detail-panel__section-title">Subflow: {step.subflow.name}</h4>
          <p className="detail-panel__sub-text">{step.subflow.steps.length} nested steps</p>
        </div>
      )}
    </div>
  );
}
