import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import type { Workflow } from '../../types';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { ScrollArea } from '../ui/scroll-area';
import { apiClient } from '../../lib/api';
import { cn } from '../../lib/utils';
import { Plus } from 'lucide-react';

interface ServerCase {
  id: string;
  workflowId: string;
  title: string;
  status: string;
  currentStepId: string | null;
  payload: string;
  createdAt: string;
  updatedAt: string;
}

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'running', label: 'Running' },
  { key: 'waiting_human', label: 'Waiting Human' },
  { key: 'done', label: 'Done' },
  { key: 'failed', label: 'Failed' },
] as const;
type FilterKey = (typeof FILTERS)[number]['key'];

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  running: 'default',
  waiting_human: 'secondary',
  done: 'outline',
  failed: 'destructive',
  cancelled: 'outline',
};

function relTime(iso: string): string {
  const d = Date.parse(iso);
  if (Number.isNaN(d)) return iso;
  const diff = Date.now() - d;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export default function CasesPanel({
  workflow,
  selectedCaseId,
}: {
  workflow: Workflow;
  selectedCaseId?: string | null;
}) {
  const { t } = useTranslation('workflow');
  const navigate = useNavigate();
  const [cases, setCases] = useState<ServerCase[] | null>(null);
  const [filter, setFilter] = useState<FilterKey>('all');
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState('');

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const tick = async () => {
      try {
        const d = await apiClient.get<{ cases: ServerCase[] }>('/api/cases');
        if (!cancelled) setCases(d.cases.filter((c) => c.workflowId === workflow.id));
      } catch {
        /* ignore polling errors */
      } finally {
        if (!cancelled) timer = setTimeout(tick, 5000);
      }
    };
    tick();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [workflow.id]);

  const filtered = useMemo(() => {
    if (!cases) return null;
    if (filter === 'all') return cases;
    return cases.filter((c) => c.status === filter);
  }, [cases, filter]);

  const createCase = async () => {
    if (!newTitle.trim()) return;
    setCreating(true);
    try {
      const { case: c } = await apiClient.post<{ case: ServerCase }>('/api/cases', {
        workflowId: workflow.id,
        title: newTitle.trim(),
        payload: {},
      });
      setNewTitle('');
      toast.success(t('cases.created', { defaultValue: 'Case created' }));
      navigate(`/workflows/${workflow.id}/cases/${c.id}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(t('cases.createFailed', { defaultValue: 'Create failed' }), { description: msg });
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-4 py-3 border-b space-y-2">
        <div className="flex gap-2">
          <Input
            placeholder={t('cases.newCasePlaceholder', { defaultValue: 'New case title' })}
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void createCase();
            }}
            className="h-8 text-xs"
            data-testid="cases-new-title"
          />
          <Button
            size="sm"
            onClick={createCase}
            disabled={creating || !newTitle.trim()}
            data-testid="cases-new-submit"
          >
            <Plus className="h-3.5 w-3.5 mr-1" />
            {t('cases.new', { defaultValue: 'New case' })}
          </Button>
        </div>
        <div className="flex flex-wrap gap-1">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              data-testid={`cases-filter-${f.key}`}
              className={cn(
                'px-2 py-0.5 rounded text-[10px] font-mono uppercase tracking-wider border',
                filter === f.key
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background text-muted-foreground border-border hover:text-foreground',
              )}
            >
              {t(`cases.filter.${f.key}`, { defaultValue: f.label })}
            </button>
          ))}
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-3 space-y-2">
          {!filtered ? (
            <p className="text-xs text-muted-foreground p-2">Loading…</p>
          ) : filtered.length === 0 ? (
            <p className="text-xs text-muted-foreground p-2 text-center">
              {t('cases.empty', { defaultValue: 'No cases for this filter.' })}
            </p>
          ) : (
            filtered.map((c) => {
              let stepCount = 0;
              try {
                const p = JSON.parse(c.payload || '{}');
                stepCount = Array.isArray(p.stepResults) ? p.stepResults.length : 0;
              } catch {
                /* */
              }
              return (
                <button
                  key={c.id}
                  type="button"
                  data-testid={`case-card-${c.id}`}
                  onClick={() => navigate(`/workflows/${workflow.id}/cases/${c.id}`)}
                  className={cn(
                    'w-full text-left p-3 rounded-lg border transition-all hover:shadow-md hover:border-primary/40',
                    selectedCaseId === c.id ? 'border-primary ring-2 ring-primary/30' : 'border-border bg-card',
                  )}
                >
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <h4 className="text-xs font-semibold truncate">{c.title}</h4>
                    <Badge variant={STATUS_VARIANT[c.status] ?? 'default'} className="text-[9px] uppercase">
                      {c.status}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between text-[10px] font-mono text-muted-foreground">
                    <span>{relTime(c.updatedAt)}</span>
                    <span>{stepCount} steps</span>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
