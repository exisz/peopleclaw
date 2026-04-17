import { useState } from 'react';
import type { WorkflowStep, StepType } from '../../data/types';

interface AddStepModalProps {
  onAdd: (step: WorkflowStep) => void;
  onClose: () => void;
}

export default function AddStepModal({ onAdd, onClose }: AddStepModalProps) {
  const [name, setName] = useState('');
  const [type, setType] = useState<StepType>('human');
  const [assignee, setAssignee] = useState('');
  const [description, setDescription] = useState('');
  const [estimatedTime, setEstimatedTime] = useState('');

  const handleSubmit = () => {
    if (!name.trim()) return;
    onAdd({
      id: `step-${Date.now()}`,
      name: name.trim(),
      type,
      assignee: assignee.trim() || 'Unassigned',
      description: description.trim(),
      estimatedTime: estimatedTime.trim() || undefined,
    });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Add New Step</h3>
          <button onClick={onClose} className="modal-close">✕</button>
        </div>

        <div className="modal-body">
          <label className="modal-label">
            Name *
            <input className="modal-input" value={name} onChange={e => setName(e.target.value)} placeholder="Step name" autoFocus />
          </label>

          <label className="modal-label">
            Type
            <select className="modal-input" value={type} onChange={e => setType(e.target.value as StepType)}>
              <option value="human">👤 Human</option>
              <option value="agent">🤖 Agent</option>
              <option value="subflow">📂 Subflow</option>
              <option value="condition">🔀 Condition</option>
              <option value="input">📝 Data Input</option>
              <option value="notification">🔔 Notification</option>
            </select>
          </label>

          <label className="modal-label">
            Assignee
            <input className="modal-input" value={assignee} onChange={e => setAssignee(e.target.value)} placeholder="Who handles this?" />
          </label>

          <label className="modal-label">
            Description
            <textarea className="modal-input modal-textarea" value={description} onChange={e => setDescription(e.target.value)} placeholder="What does this step do?" rows={3} />
          </label>

          <label className="modal-label">
            Estimated Time
            <input className="modal-input" value={estimatedTime} onChange={e => setEstimatedTime(e.target.value)} placeholder="e.g. 2h, 1d" />
          </label>
        </div>

        <div className="modal-footer">
          <button onClick={onClose} className="modal-btn modal-btn--cancel">Cancel</button>
          <button onClick={handleSubmit} className="modal-btn modal-btn--submit" disabled={!name.trim()}>Add Step</button>
        </div>
      </div>
    </div>
  );
}
