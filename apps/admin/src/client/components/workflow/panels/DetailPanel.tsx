import type { WorkflowStep } from '../../../data/types';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Textarea } from '../../ui/textarea';
import { Label } from '../../ui/label';
import { Badge } from '../../ui/badge';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '../../ui/select';
import { X } from 'lucide-react';

export interface DetailPanelProps {
  step: WorkflowStep;
  status?: string;
  onClose: () => void;
  onUpdate: (updated: WorkflowStep) => void;
  onDelete?: (stepId: string) => void;
}

const typeLabels: Record<string, { badge: string; label: string }> = {
  human: { badge: '👤', label: 'Human' },
  agent: { badge: '🤖', label: 'Agent' },
  subflow: { badge: '📂', label: 'Subflow' },
  trigger: { badge: '⚡', label: 'Trigger' },
  condition: { badge: '🔀', label: 'Condition' },
  input: { badge: '📝', label: 'Data Input' },
  notification: { badge: '🔔', label: 'Notification' },
};

const statusLabels: Record<string, string> = {
  done: 'Done',
  'in-progress': 'In Progress',
  blocked: 'Blocked',
  pending: 'Pending',
};

export default function DetailPanel({ step, status, onClose, onUpdate, onDelete }: DetailPanelProps) {
  const cfg = typeLabels[step.type] ?? typeLabels.human;

  return (
    <aside
      className="fixed right-0 top-0 h-screen w-[380px] z-40 bg-card border-l border-border shadow-2xl flex flex-col"
      data-testid="detail-panel"
    >
      <header className="flex items-center justify-between px-5 py-4 border-b border-border">
        <h3 className="text-base font-semibold truncate pr-2">{step.name}</h3>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          data-testid="action-cancel"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </Button>
      </header>

      <div className="px-5 py-3 border-b border-border flex items-center gap-2 flex-wrap">
        <Badge variant="outline">
          {cfg.badge} {cfg.label}
        </Badge>
        {status && <Badge variant="secondary">{statusLabels[status] ?? status}</Badge>}
      </div>

      <div className="flex-1 overflow-auto px-5 py-4 space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="step-name">Name</Label>
          <Input
            id="step-name"
            data-testid="step-detail-name"
            value={step.name}
            onChange={(e) => onUpdate({ ...step, name: e.target.value })}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="step-assignee">Assignee</Label>
          <Input
            id="step-assignee"
            data-testid="step-detail-assignee"
            value={step.assignee}
            onChange={(e) => onUpdate({ ...step, assignee: e.target.value })}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="step-description">Description</Label>
          <Textarea
            id="step-description"
            data-testid="step-detail-description"
            rows={3}
            value={step.description}
            onChange={(e) => onUpdate({ ...step, description: e.target.value })}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="step-time">Estimated Time</Label>
          <Input
            id="step-time"
            data-testid="step-detail-estimatedTime"
            value={step.estimatedTime || ''}
            onChange={(e) => onUpdate({ ...step, estimatedTime: e.target.value })}
            placeholder="e.g. 2h, 1d"
          />
        </div>

        <div className="space-y-1.5">
          <Label>Type</Label>
          <Select
            value={step.type}
            onValueChange={(v) => onUpdate({ ...step, type: v as WorkflowStep['type'] })}
          >
            <SelectTrigger data-testid="step-detail-type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(typeLabels).map(([k, v]) => (
                <SelectItem key={k} value={k}>
                  {v.badge} {v.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {step.tools && step.tools.length > 0 && (
          <div className="space-y-1.5">
            <Label>Tools</Label>
            <div className="flex flex-wrap gap-1.5">
              {step.tools.map(t => (
                <Badge key={t} variant="outline" className="font-mono text-[10px]">
                  {t}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {step.subflow && (
          <div className="space-y-1.5">
            <Label>Subflow: {step.subflow.name}</Label>
            <p className="text-xs text-muted-foreground">{step.subflow.steps.length} nested steps</p>
          </div>
        )}
      </div>

      <footer className="px-5 py-3 border-t border-border flex items-center justify-between gap-2">
        <Button
          variant="destructive"
          size="sm"
          data-testid="action-delete"
          onClick={() => onDelete?.(step.id)}
          disabled={!onDelete}
        >
          Delete
        </Button>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" data-testid="action-cancel-footer" onClick={onClose}>
            Close
          </Button>
          <Button size="sm" data-testid="action-save" onClick={onClose}>
            Save
          </Button>
        </div>
      </footer>
    </aside>
  );
}
