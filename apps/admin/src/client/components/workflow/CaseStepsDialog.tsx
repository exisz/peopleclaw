import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Badge } from '../ui/badge';
import { ScrollArea } from '../ui/scroll-area';
import { cn } from '../../lib/utils';

interface CaseStep {
  id: string;
  stepId: string;
  stepType?: string;
  kind?: string;
  status: string;
  error?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  createdAt?: string;
}

interface CaseStepsDialogProps {
  open: boolean;
  onClose: () => void;
  caseTitle: string;
  steps: CaseStep[];
}

const STATUS_COLOR: Record<string, string> = {
  done: 'bg-green-500',
  success: 'bg-green-500',
  completed: 'bg-green-500',
  running: 'bg-blue-500',
  'in-progress': 'bg-blue-500',
  failed: 'bg-red-500',
  error: 'bg-red-500',
  waiting_human: 'bg-amber-500',
  pending: 'bg-gray-400',
};

const STATUS_BADGE: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  done: 'outline',
  success: 'outline',
  completed: 'outline',
  running: 'default',
  'in-progress': 'default',
  failed: 'destructive',
  error: 'destructive',
  waiting_human: 'secondary',
  pending: 'secondary',
};

function fmtTime(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function durationStr(start?: string | null, end?: string | null): string {
  if (!start || !end) return '';
  const ms = new Date(end).getTime() - new Date(start).getTime();
  if (Number.isNaN(ms) || ms < 0) return '';
  if (ms < 1000) return `${ms}ms`;
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m${s % 60}s`;
}

export default function CaseStepsDialog({
  open,
  onClose,
  caseTitle,
  steps,
}: CaseStepsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-sm">📜 运行记录 — {caseTitle}</DialogTitle>
        </DialogHeader>
        <ScrollArea className="flex-1 pr-2 -mr-2">
          {steps.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-8">暂无运行记录</p>
          ) : (
            <div className="relative py-2">
              {/* Timeline line */}
              <div className="absolute left-[11px] top-4 bottom-4 w-0.5 bg-border" />

              {steps.map((step, i) => {
                const color = STATUS_COLOR[step.status] ?? 'bg-gray-400';
                const dur = durationStr(step.startedAt ?? step.createdAt, step.completedAt);

                return (
                  <div key={step.id} className="relative flex gap-3 pb-4 last:pb-0">
                    {/* Timeline dot */}
                    <div className="relative z-10 flex-shrink-0 mt-1">
                      <div
                        className={cn(
                          'h-[22px] w-[22px] rounded-full border-2 border-background flex items-center justify-center',
                          color,
                        )}
                      >
                        <span className="text-[9px] font-bold text-white">{i + 1}</span>
                      </div>
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0 rounded-lg border bg-card p-2.5 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold truncate">
                          {step.stepId}
                        </span>
                        <Badge
                          variant={STATUS_BADGE[step.status] ?? 'secondary'}
                          className="text-[9px] uppercase shrink-0"
                        >
                          {step.status}
                        </Badge>
                      </div>

                      <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-muted-foreground">
                        {step.stepType && <span>类型: {step.stepType}</span>}
                        {step.kind && <span>执行: {step.kind}</span>}
                        {dur && <span>耗时: {dur}</span>}
                      </div>

                      <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-muted-foreground">
                        <span>开始: {fmtTime(step.startedAt ?? step.createdAt)}</span>
                        {step.completedAt && <span>完成: {fmtTime(step.completedAt)}</span>}
                      </div>

                      {step.error && (
                        <p className="text-[10px] text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 rounded px-2 py-1 mt-1 break-words">
                          {step.error}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
