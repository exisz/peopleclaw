import { useEffect, useMemo, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import type { Workflow } from '../../types';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { ScrollArea } from '../ui/scroll-area';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../ui/alert-dialog';
import { apiClient } from '../../lib/api';
import { cn } from '../../lib/utils';
import { Plus, Trash2, CheckCircle, Upload, ChevronDown, ChevronRight, AlertCircle, RotateCcw, RefreshCw, Save } from 'lucide-react';
import BatchImportDialog from './BatchImportDialog';

interface ServerCase {
  id: string;
  workflowId: string;
  title: string;
  status: string;
  currentStepId: string | null;
  payload: string;
  batchId?: string | null;
  createdAt: string;
  updatedAt: string;
}

interface DetailCase extends ServerCase {
  steps?: Array<{ id: string; stepId: string; status: string; error: string | null }>;
  workflow?: { name: string; definition?: string };
  stepModeOverrides?: string;
}

// PLANET-1253/1254/1255: Selected case action panel shown in the cases sidebar
function SelectedCaseActions({ caseId, onUpdate }: { caseId: string; onUpdate: () => void }) {
  const [detail, setDetail] = useState<DetailCase | null>(null);
  const [payloadFields, setPayloadFields] = useState<Record<string, unknown>>({});
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const d = await apiClient.get<{ case: DetailCase }>(`/api/cases/${caseId}`);
      setDetail(d.case);
      try { setPayloadFields(JSON.parse(d.case.payload || '{}')); } catch { setPayloadFields({}); }
    } catch { /* */ }
  }, [caseId]);

  useEffect(() => { load(); }, [load]);

  // Auto-poll while running
  useEffect(() => {
    if (!detail || detail.status !== 'running') return;
    const t = setInterval(load, 3000);
    return () => clearInterval(t);
  }, [detail, load]);

  if (!detail) return null;

  const handleSavePayload = async () => {
    setSaving(true);
    try {
      await apiClient.patch(`/api/cases/${caseId}/payload`, { fields: payloadFields });
      toast.success('\u6848\u4f8b\u6570\u636e\u5df2\u4fdd\u5b58');
      onUpdate();
      await load();
    } catch (e) {
      toast.error('\u4fdd\u5b58\u5931\u8d25', { description: e instanceof Error ? e.message : String(e) });
    } finally {
      setSaving(false);
    }
  };

  const highlight = ['product_name', 'title', 'price', 'stock', 'image_url', 'description'];
  const editableKeys = Object.keys(payloadFields)
    .filter((k) => !k.startsWith('_') && typeof payloadFields[k] !== 'object')
    .sort((a, b) => {
      const aH = highlight.includes(a) ? 0 : 1;
      const bH = highlight.includes(b) ? 0 : 1;
      return aH - bH || a.localeCompare(b);
    });

  // Retreat/Retry logic
  let def: { edges?: Array<{ source: string; target: string }> } | null = null;
  try { if (detail.workflow?.definition) def = JSON.parse(detail.workflow.definition); } catch {}
  const isAtFirst = !def?.edges?.some((e) => e.target === detail.currentStepId);
  const canRetreat = !isAtFirst && ['waiting_human', 'failed', 'done'].includes(detail.status);
  const canRetry = detail.status === 'failed';
  const failedStep = detail.steps?.find((s) => s.status === 'failed');

  return (
    <div className="px-3 py-2 border-b space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold truncate">{detail.title}</span>
        <Badge variant={STATUS_VARIANT[detail.status] ?? 'default'} className="text-[9px] uppercase shrink-0">
          {detail.status}
        </Badge>
      </div>

      {/* Error message for failed cases */}
      {failedStep?.error && (
        <div className="text-[10px] text-red-600 bg-red-50 dark:bg-red-950 dark:text-red-400 p-2 rounded">
          <span className="font-medium">\u9519\u8bef:</span> {failedStep.error}
        </div>
      )}

      {/* Retreat + Retry */}
      {(canRetreat || canRetry) && (
        <div className="flex gap-1.5">
          {canRetreat && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs gap-1"
              disabled={detail.status === 'running'}
              onClick={async () => {
                try {
                  await apiClient.post(`/api/cases/${caseId}/retreat`);
                  toast.success('\u5df2\u56de\u9000\u4e00\u6b65');
                  onUpdate();
                  await load();
                } catch (e) {
                  toast.error('\u56de\u9000\u5931\u8d25', { description: e instanceof Error ? e.message : String(e) });
                }
              }}
              data-testid="case-retreat-btn"
            >
              <RotateCcw className="h-3 w-3" />
              \u56de\u9000
            </Button>
          )}
          {canRetry && (
            <Button
              size="sm"
              variant="default"
              className="h-7 text-xs gap-1"
              onClick={async () => {
                try {
                  await apiClient.post(`/api/cases/${caseId}/retry`);
                  toast.success('\u6b63\u5728\u91cd\u8bd5...');
                  onUpdate();
                  await load();
                } catch (e) {
                  toast.error('\u91cd\u8bd5\u5931\u8d25', { description: e instanceof Error ? e.message : String(e) });
                }
              }}
              data-testid="case-retry-btn"
            >
              <RefreshCw className="h-3 w-3" />
              \u91cd\u8bd5
            </Button>
          )}
        </div>
      )}

      {/* Payload editor */}
      {editableKeys.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] font-medium text-muted-foreground">\u7f16\u8f91\u6848\u4f8b\u6570\u636e</p>
          {editableKeys.slice(0, 8).map((key) => {
            const val = payloadFields[key];
            const isImage = key === 'image_url' || (typeof val === 'string' && /^https?:\/\/.+\.(jpg|jpeg|png|gif|webp)/i.test(val));
            const isNumber = typeof val === 'number';
            return (
              <div key={key} className="space-y-0.5">
                <label className="text-[9px] text-muted-foreground">{key}</label>
                <div className="flex items-center gap-1">
                  <Input
                    type={isNumber ? 'number' : 'text'}
                    value={String(val ?? '')}
                    onChange={(e) => setPayloadFields((prev) => ({ ...prev, [key]: isNumber ? Number(e.target.value) || 0 : e.target.value }))}
                    className="h-6 text-[10px]"
                  />
                  {isImage && typeof val === 'string' && val && (
                    <img src={val} alt={key} className="h-6 w-6 rounded border object-cover shrink-0" />
                  )}
                </div>
              </div>
            );
          })}
          <Button size="sm" variant="outline" className="h-6 text-[10px] gap-1" onClick={handleSavePayload} disabled={saving}>
            <Save className="h-3 w-3" />
            {saving ? '\u4fdd\u5b58\u4e2d...' : '\u4fdd\u5b58'}
          </Button>
        </div>
      )}
    </div>
  );
}

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'running', label: 'Running' },
  { key: 'waiting_human', label: 'Waiting Human' },
  { key: 'awaiting_fix', label: 'Awaiting Fix' },
  { key: 'done', label: 'Done' },
  { key: 'failed', label: 'Failed' },
] as const;
type FilterKey = (typeof FILTERS)[number]['key'];

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  running: 'default',
  waiting_human: 'secondary',
  awaiting_fix: 'destructive',
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

interface BatchGroup {
  batchId: string;
  cases: ServerCase[];
  done: number;
  total: number;
  hasErrors: boolean;
}

function BatchGroupRow({
  group,
  workflow,
  selectedCaseId,
  completing,
  onComplete,
  onDelete,
}: {
  group: BatchGroup;
  workflow: Workflow;
  selectedCaseId?: string | null;
  completing: string | null;
  onComplete: (c: ServerCase) => void;
  onDelete: (c: ServerCase) => void;
}) {
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50/30 dark:bg-blue-950/30">
      {/* Batch header row */}
      <button
        type="button"
        className="w-full text-left p-3 flex items-center gap-2 hover:bg-blue-50/60 dark:hover:bg-blue-950/60 transition-colors rounded-t-lg"
        onClick={() => setExpanded((v) => !v)}
        data-testid={`batch-row-${group.batchId}`}
      >
        {expanded ? <ChevronDown className="h-3.5 w-3.5 text-blue-600 shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 text-blue-600 shrink-0" />}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-blue-800 dark:text-blue-200 truncate">
              📦 批次导入 · {group.total} 行
            </span>
            <Badge
              variant="outline"
              className={cn(
                'text-[9px] shrink-0',
                group.done === group.total
                  ? 'border-green-500 text-green-700 dark:text-green-400'
                  : group.hasErrors
                  ? 'border-amber-500 text-amber-700 dark:text-amber-400'
                  : 'border-blue-500 text-blue-700 dark:text-blue-400',
              )}
            >
              {group.done}/{group.total} 完成
            </Badge>
          </div>
          <p className="text-[10px] font-mono text-blue-600/70 dark:text-blue-400/70 truncate mt-0.5">
            {group.batchId}
          </p>
        </div>
        {group.hasErrors && (
          <AlertCircle className="h-3.5 w-3.5 text-amber-500 shrink-0" aria-label="有行待修复" />
        )}
      </button>

      {/* Expanded sub-cases */}
      {expanded && (
        <div className="border-t border-blue-200/50 dark:border-blue-800/50 p-2 space-y-1.5">
          {group.cases.map((c) => (
            <CaseCard
              key={c.id}
              c={c}
              workflow={workflow}
              selectedCaseId={selectedCaseId}
              completing={completing}
              onComplete={onComplete}
              onDelete={onDelete}
              indent
            />
          ))}
        </div>
      )}
    </div>
  );
}

function CaseCard({
  c,
  workflow,
  selectedCaseId,
  completing,
  onComplete,
  onDelete,
  indent = false,
}: {
  c: ServerCase;
  workflow: Workflow;
  selectedCaseId?: string | null;
  completing: string | null;
  onComplete: (c: ServerCase) => void;
  onDelete: (c: ServerCase) => void;
  indent?: boolean;
}) {
  const { t } = useTranslation('workflow');
  const navigate = useNavigate();

  let stepCount = 0;
  let errorInfo: { column?: string; reason?: string } | null = null;
  let productPublicUrl: string | null = null;
  try {
    const p = JSON.parse(c.payload || '{}');
    stepCount = Array.isArray(p.stepResults) ? p.stepResults.length : 0;
    if (p._error) errorInfo = p._error as { column?: string; reason?: string };
    // PLANET-1200: product URL written back by publish_shopify handler
    if (p.productPublicUrl) productPublicUrl = p.productPublicUrl as string;
  } catch { /* */ }

  return (
    <div className={cn(
      'rounded-lg border transition-all',
      indent ? 'ml-2' : '',
      selectedCaseId === c.id ? 'border-primary ring-2 ring-primary/30' : 'border-border bg-card',
    )}>
      <button
        type="button"
        data-testid={`case-card-${c.id}`}
        onClick={() => navigate(`/workflows/${workflow.id}/cases/${c.id}`)}
        className="w-full text-left p-3 hover:bg-accent/30 rounded-t-lg transition-colors"
      >
        <div className="flex items-start justify-between gap-2 mb-1">
          <h4 className="text-xs font-semibold truncate">{c.title}</h4>
          <Badge variant={STATUS_VARIANT[c.status] ?? 'default'} className="text-[9px] uppercase shrink-0">
            {c.status === 'awaiting_fix' ? '待修复' : c.status}
          </Badge>
        </div>
        {errorInfo && (
          <p className="text-[10px] text-red-600 dark:text-red-400 truncate">
            {errorInfo.column}: {errorInfo.reason}
          </p>
        )}
        <div className="flex items-center justify-between text-[10px] font-mono text-muted-foreground mt-0.5">
          <span>{relTime(c.updatedAt)}</span>
          <span>{stepCount} steps</span>
        </div>
      </button>
      <div className="flex items-center justify-end gap-1 px-2 py-1 border-t border-border/40">
        {/* PLANET-1200: "查看商品" button for done cases with Shopify URL */}
        {c.status === 'done' && productPublicUrl && (
          <a
            href={productPublicUrl}
            target="_blank"
            rel="noreferrer"
            className="h-6 text-[10px] px-2 inline-flex items-center gap-1 rounded text-green-700 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-950 border border-green-300 dark:border-green-700"
            data-testid={`case-shopify-url-${c.id}`}
            onClick={(e) => e.stopPropagation()}
          >
            🛍️ 查看商品
          </a>
        )}
        {c.status === 'waiting_human' && (
          <Button
            size="sm"
            variant="ghost"
            className="h-6 text-[10px] text-green-600 hover:text-green-700 px-2"
            disabled={completing === c.id}
            onClick={(e) => { e.stopPropagation(); onComplete(c); }}
            data-testid={`case-complete-${c.id}`}
          >
            <CheckCircle className="h-3 w-3 mr-1" />
            {t('case:actions.complete', { defaultValue: '完成' })}
          </Button>
        )}
        <Button
          size="sm"
          variant="ghost"
          className="h-6 text-[10px] text-destructive hover:text-destructive px-2"
          onClick={(e) => { e.stopPropagation(); onDelete(c); }}
          data-testid={`case-delete-${c.id}`}
        >
          <Trash2 className="h-3 w-3 mr-1" />
          {t('common:buttons.delete', { defaultValue: 'Delete' })}
        </Button>
      </div>
    </div>
  );
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
  const [deleteTarget, setDeleteTarget] = useState<ServerCase | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [completing, setCompleting] = useState<string | null>(null);
  const [batchDialogOpen, setBatchDialogOpen] = useState(false);

  const loadCases = async (cancelled = false) => {
    try {
      const d = await apiClient.get<{ cases: ServerCase[] }>('/api/cases');
      if (!cancelled) setCases(d.cases.filter((c) => c.workflowId === workflow.id));
    } catch { /* ignore polling errors */ }
  };

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const tick = async () => {
      await loadCases(cancelled);
      if (!cancelled) timer = setTimeout(tick, 5000);
    };
    tick();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workflow.id]);

  // Separate batch cases from standalone cases
  const { standaloneFiltered, batchGroups } = useMemo(() => {
    if (!cases) return { standaloneFiltered: null, batchGroups: [] };

    const filtered = filter === 'all' ? cases : cases.filter((c) => c.status === filter);

    const batchMap = new Map<string, ServerCase[]>();
    const standalone: ServerCase[] = [];

    for (const c of filtered) {
      if (c.batchId) {
        const arr = batchMap.get(c.batchId) ?? [];
        arr.push(c);
        batchMap.set(c.batchId, arr);
      } else {
        standalone.push(c);
      }
    }

    // Build batch groups — sorted by most-recent updatedAt
    const groups: BatchGroup[] = [];
    for (const [batchId, bCases] of batchMap.entries()) {
      const allCases = cases.filter((c) => c.batchId === batchId);
      groups.push({
        batchId,
        cases: bCases,
        done: allCases.filter((c) => c.status === 'done').length,
        total: allCases.length,
        hasErrors: allCases.some((c) => c.status === 'awaiting_fix'),
      });
    }
    groups.sort((a, b) => {
      const aTime = Math.max(...a.cases.map((c) => Date.parse(c.updatedAt)));
      const bTime = Math.max(...b.cases.map((c) => Date.parse(c.updatedAt)));
      return bTime - aTime;
    });

    return { standaloneFiltered: standalone, batchGroups: groups };
  }, [cases, filter]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    const target = deleteTarget;
    setDeleteTarget(null);
    try {
      await apiClient.delete(`/api/cases/${target.id}`);
      setCases((prev) => prev ? prev.filter((c) => c.id !== target.id) : prev);
      toast.success(t('cases.deleted', { defaultValue: 'Case deleted' }));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(t('cases.deleteFailed', { defaultValue: 'Delete failed' }), { description: msg });
    } finally {
      setDeleting(false);
    }
  };

  const handleComplete = async (c: ServerCase) => {
    setCompleting(c.id);
    try {
      const { case: detail } = await apiClient.get<{ case: ServerCase & { steps?: Array<{ id: string; stepId: string; status: string }> } }>(`/api/cases/${c.id}`);
      const waitingStep = detail.steps?.find((s) => s.status === 'waiting_human');
      if (!waitingStep) {
        toast.error(t('cases.noWaitingStep', { defaultValue: 'No waiting step found' }));
        return;
      }
      await apiClient.post(`/api/cases/${c.id}/advance`, {
        stepId: waitingStep.stepId,
        output: { approved: true },
        action: 'approve',
      });
      toast.success(t('cases.completed', { defaultValue: 'Case advanced' }));
      await loadCases();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(t('cases.completeFailed', { defaultValue: 'Complete failed' }), { description: msg });
    } finally {
      setCompleting(null);
    }
  };

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

  const hasAny = (standaloneFiltered?.length ?? 0) + batchGroups.length > 0;

  return (
    <>
      <div className="flex flex-col h-full overflow-hidden">
        {/* PLANET-1253/1254/1255: selected case action panel */}
        {selectedCaseId && (
          <SelectedCaseActions caseId={selectedCaseId} onUpdate={() => void loadCases()} />
        )}
        <div className="px-4 py-3 border-b space-y-2">
          <div className="flex gap-2">
            <Input
              placeholder={t('cases.newCasePlaceholder', { defaultValue: 'New case title' })}
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') void createCase(); }}
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
          <Button
            size="sm"
            variant="outline"
            className="w-full h-7 text-xs gap-1.5 border-dashed"
            onClick={() => setBatchDialogOpen(true)}
            data-testid="cases-batch-import-btn"
          >
            <Upload className="h-3 w-3" />
            批量导入 Excel / CSV
          </Button>
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
            {!standaloneFiltered ? (
              <p className="text-xs text-muted-foreground p-2">Loading…</p>
            ) : !hasAny ? (
              <p className="text-xs text-muted-foreground p-2 text-center">
                {t('cases.empty', { defaultValue: 'No cases for this filter.' })}
              </p>
            ) : (
              <>
                {/* Batch group rows (collapsed by default, 1 row per batch) */}
                {batchGroups.map((group) => (
                  <BatchGroupRow
                    key={group.batchId}
                    group={group}
                    workflow={workflow}
                    selectedCaseId={selectedCaseId}
                    completing={completing}
                    onComplete={handleComplete}
                    onDelete={(c) => setDeleteTarget(c)}
                  />
                ))}

                {/* Standalone (non-batch) cases */}
                {standaloneFiltered.map((c) => (
                  <CaseCard
                    key={c.id}
                    c={c}
                    workflow={workflow}
                    selectedCaseId={selectedCaseId}
                    completing={completing}
                    onComplete={handleComplete}
                    onDelete={(c) => setDeleteTarget(c)}
                  />
                ))}
              </>
            )}
          </div>
        </ScrollArea>
      </div>

      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => { if (!v) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('cases.deleteConfirmTitle', { defaultValue: 'Delete case?' })}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('cases.deleteConfirmDesc', {
                defaultValue: 'This will permanently delete "{{title}}" and all its steps.',
                title: deleteTarget?.title ?? '',
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>{t('common:buttons.cancel', { defaultValue: 'Cancel' })}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t('common:buttons.delete', { defaultValue: 'Delete' })}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <BatchImportDialog
        open={batchDialogOpen}
        onClose={() => setBatchDialogOpen(false)}
        workflowId={workflow.id}
        onSuccess={() => void loadCases()}
      />
    </>
  );
}
