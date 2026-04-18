import type { Case, Workflow } from '../../types';
import { Badge } from '../ui/badge';
import { cn } from '../../lib/utils';

const statusVariant: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  active: 'default',
  completed: 'secondary',
  paused: 'outline',
};

export default function CasesView({
  cases,
  workflow,
  selectedCase,
  onSelectCase,
}: {
  cases: Case[];
  workflow: Workflow;
  selectedCase: Case | null;
  onSelectCase: (c: Case) => void;
}) {
  if (cases.length === 0) {
    return (
      <div
        className="flex items-center justify-center h-full text-muted-foreground p-8"
        data-testid="cases-empty"
      >
        <div className="text-center">
          <div className="text-6xl mb-6 opacity-60">📭</div>
          <p className="text-lg font-semibold mb-2">No cases yet</p>
          <p className="text-sm max-w-xs">
            Start a case from this workflow to track real work through these steps.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 p-6 overflow-auto h-full"
      data-testid="cases-table"
    >
      {cases.map(c => {
        const totalSteps = workflow.steps.length;
        const doneSteps = Object.values(c.stepStatuses).filter(s => s === 'done').length;
        const progress = Math.round((doneSteps / totalSteps) * 100);
        const currentStep = workflow.steps.find(s => s.id === c.currentStepId);
        const isSelected = selectedCase?.id === c.id;

        return (
          <button
            key={c.id}
            type="button"
            onClick={() => onSelectCase(c)}
            data-testid={`case-row-${c.id}`}
            className={cn(
              'text-left p-5 rounded-xl border bg-card transition-all hover:shadow-md',
              isSelected
                ? 'border-primary ring-2 ring-primary/30'
                : 'border-border hover:border-primary/40',
            )}
          >
            <div className="flex items-start justify-between mb-4 gap-3">
              <h3 className="text-sm font-semibold pr-2 leading-snug">{c.name}</h3>
              <Badge variant={statusVariant[c.status] ?? 'default'} className="uppercase text-[10px]">
                {c.status}
              </Badge>
            </div>

            <div className="mb-4">
              <div className="flex justify-between text-[10px] font-mono text-muted-foreground mb-1.5">
                <span>
                  {doneSteps}/{totalSteps} steps
                </span>
                <span>{progress}%</span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className={cn(
                    'h-full rounded-full transition-all duration-500',
                    progress === 100 ? 'bg-emerald-500' : 'bg-gradient-to-r from-primary to-accent',
                  )}
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>

            {currentStep && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
                <span
                  className={cn(
                    'w-2 h-2 rounded-full flex-shrink-0',
                    c.status === 'completed' ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse',
                  )}
                />
                <span className="truncate">Current: {currentStep.name}</span>
              </div>
            )}

            <p className="font-mono text-[10px] text-muted-foreground mb-3">Started {c.startedAt}</p>

            <div className="flex gap-1.5 flex-wrap">
              {workflow.steps.map(step => {
                const st = c.stepStatuses[step.id] || 'pending';
                const col: Record<string, string> = {
                  done: 'bg-emerald-500',
                  'in-progress': 'bg-amber-500',
                  blocked: 'bg-red-500',
                  pending: 'bg-muted-foreground/30',
                };
                return (
                  <div
                    key={step.id}
                    className={cn('w-2.5 h-2.5 rounded-full transition-colors', col[st])}
                    title={`${step.name}: ${st}`}
                  />
                );
              })}
            </div>
          </button>
        );
      })}
    </div>
  );
}
