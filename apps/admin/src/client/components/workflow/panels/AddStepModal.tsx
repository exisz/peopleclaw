import { useState } from 'react';
import type { WorkflowStep, StepType } from '../../../data/types';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../../ui/dialog';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Textarea } from '../../ui/textarea';
import { Label } from '../../ui/label';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '../../ui/select';

interface AddStepModalProps {
  open: boolean;
  onAdd: (step: WorkflowStep) => void;
  onClose: () => void;
}

const stepTypes: { value: StepType; label: string }[] = [
  { value: 'human', label: '👤 Human' },
  { value: 'agent', label: '🤖 Agent' },
  { value: 'subflow', label: '📂 Subflow' },
  { value: 'condition', label: '🔀 Condition' },
  { value: 'input', label: '📝 Data Input' },
  { value: 'notification', label: '🔔 Notification' },
];

export default function AddStepModal({ open, onAdd, onClose }: AddStepModalProps) {
  const [name, setName] = useState('');
  const [type, setType] = useState<StepType>('human');
  const [assignee, setAssignee] = useState('');
  const [description, setDescription] = useState('');
  const [estimatedTime, setEstimatedTime] = useState('');

  const reset = () => {
    setName('');
    setType('human');
    setAssignee('');
    setDescription('');
    setEstimatedTime('');
  };

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
    reset();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          reset();
          onClose();
        }
      }}
    >
      <DialogContent data-testid="add-step-modal">
        <DialogHeader>
          <DialogTitle>Add New Step</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="add-name">Name *</Label>
            <Input
              id="add-name"
              data-testid="step-detail-name"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Step name"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Type</Label>
            <Select value={type} onValueChange={(v) => setType(v as StepType)}>
              <SelectTrigger data-testid="step-detail-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {stepTypes.map((t) => (
                  <SelectItem key={t.value} value={t.value} data-testid={`step-type-${t.value}`}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="add-assignee">Assignee</Label>
            <Input
              id="add-assignee"
              data-testid="step-detail-assignee"
              value={assignee}
              onChange={(e) => setAssignee(e.target.value)}
              placeholder="Who handles this?"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="add-description">Description</Label>
            <Textarea
              id="add-description"
              data-testid="step-detail-description"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What does this step do?"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="add-time">Estimated Time</Label>
            <Input
              id="add-time"
              data-testid="step-detail-estimatedTime"
              value={estimatedTime}
              onChange={(e) => setEstimatedTime(e.target.value)}
              placeholder="e.g. 2h, 1d"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" data-testid="action-cancel" onClick={onClose}>
            Cancel
          </Button>
          <Button data-testid="action-save" onClick={handleSubmit} disabled={!name.trim()}>
            Add Step
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
