import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import type { Workflow } from '../../types';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { ScrollArea } from '../ui/scroll-area';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
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
import {
  Plus,
  Trash2,
  CheckCircle,
  Upload,
  MoreHorizontal,
  ClipboardList,
  ScrollText,
  Play,
  Loader2,
  Bot,
  Pencil,
  FastForward,
} from 'lucide-react';
import BatchImportDialog from './BatchImportDialog';
import CasePayloadDialog from './CasePayloadDialog';
import CaseStepsDialog from './CaseStepsDialog';

/* ────────────── Types ────────────── */

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

interface CaseStepRecord {
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

/* ────────────── Constants ────────────── */

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'running', label: 'Running' },
  { key: 'waiting_review', label: 'Review' },
  { key: 'waiting_human', label: 'Waiting' },
  { key: 'awaiting_fix', label: 'Fix' },
  { key: 'done', label: 'Done' },
  { key: 'failed', label: 'Failed' },
] as const;
type FilterKey = (typeof FILTERS)[number]['key'];

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  running: 'default',
  waiting_review: 'secondary',
  waiting_human: 'secondary',
  awaiting_fix: 'destructive',
  done: 'outline',
  failed: 'destructive',
  cancelled: 'outline',
};

const STATUS_LABEL: Record<string, string> = {
  running: '运行中',
  waiting_review: '待审核',
  waiting_human: '等待人工',
  awaiting_fix: '待修复',
  done: '完成',
  failed: '失败',
  cancelled: '已取消',
};

/* ────────────── Helpers ────────────── */

function relTime(iso: string): string {
  const d = Date.parse(iso);
  if (Number.isNaN(d)) return iso;
  const diff = Date.now() - d;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return '刚刚';
  if (mins < 60) return `${mins}分钟前`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}小时前`;
  const days = Math.floor(hrs / 24);
  return `${days}天前`;
}

/** Resolve the current step name from workflow definition */
function resolveStepName(stepId: string | null, workflow: Workflow): string {
  if (!stepId) return '—';
  const step = workflow.steps.find((s) => s.id === stepId);
  return step?.name ?? stepId;
}

/** Build a mini progress indicator: which steps are done/current/pending */
function StepProgress({
  workflow,
  currentStepId,
  status,
}: {
  workflow: Workflow;
  currentStepId: string | null;
  status: string;
}) {
  const steps = workflow.steps;
  if (steps.length === 0) return null;

  // Find current step index
  const currentIdx = currentStepId ? steps.findIndex((s) => s.id === currentStepId) : -1;
  const isDone = status === 'done';
  const isFailed = status === 'failed';
  const isReview = status === 'waiting_review';

  return (
    <div className="flex items-center gap-0.5" title={`${isDone ? steps.length : Math.max(0, currentIdx + 1)}/${steps.length} steps`}>
      {steps.map((s, i) => {
        let color: string;
        if (isDone) {
          color = 'bg-green-500';
        } else if (isFailed && i === currentIdx) {
          color = 'bg-red-500';
        } else if (i < currentIdx) {
          color = 'bg-green-500';
        } else if (i === currentIdx) {
          color = isReview ? 'bg-amber-500' : 'bg-blue-500 animate-pulse';
        } else {
          color = 'bg-gray-300 dark:bg-gray-600';
        }
        return (
          <div
            key={s.id}
            className={cn('h-1.5 rounded-full', color)}
            style={{ width: `${Math.max(4, Math.min(16, 80 / steps.length))}px` }}
            title={s.name}
          />
        );
      })}
    </div>
  );
}

/* ────────────── Main Component ────────────── */

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
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchDeleteOpen, setBatchDeleteOpen] = useState(false);
  const [batchDeleting, setBatchDeleting] = useState(false);

  // Dialog states
  const [payloadCase, setPayloadCase] = useState<ServerCase | null>(null);
  const [stepsCase, setStepsCase] = useState<{ c: ServerCase; steps: CaseStepRecord[] } | null>(null);
  const [loadingSteps, setLoadingSteps] = useState<string | null>(null);
  const [continuing, setContinuing] = useState<string | null>(null);
  const [runningAi, setRunningAi] = useState<string | null>(null);

  const loadCases = useCallback(async (cancelled = false) => {
    try {
      const d = await apiClient.get<{ cases: ServerCase[] }>('/api/cases');
      if (!cancelled) setCases(d.cases.filter((c) => c.workflowId === workflow.id));
    } catch { /* ignore polling errors */ }
  }, [workflow.id]);

  // Load cases once on mount (no polling — polling causes Radix Portal/DOM crashes)
  useEffect(() => {
    loadCases();
  }, [loadCases]);

  const filtered = useMemo(() => {
    if (!cases) return null;
    const list = filter === 'all' ? cases : cases.filter((c) => c.status === filter);
    return list;
  }, [cases, filter]);

  /* ── Actions ── */

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
      const { case: detail } = await apiClient.get<{
        case: ServerCase & { steps?: Array<{ id: string; stepId: string; status: string }> };
      }>(`/api/cases/${c.id}`);
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

  const openStepsDialog = async (c: ServerCase) => {
    setLoadingSteps(c.id);
    try {
      const { case: detail } = await apiClient.get<{
        case: { steps?: CaseStepRecord[] };
      }>(`/api/cases/${c.id}`);
      setStepsCase({ c, steps: detail.steps ?? [] });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error('加载运行记录失败', { description: msg });
    } finally {
      setLoadingSteps(null);
    }
  };

  // PLANET-1260: Continue to next step
  const handleContinue = async (c: ServerCase) => {
    setContinuing(c.id);
    try {
      await apiClient.post(`/api/cases/${c.id}/continue`);
      toast.success('已继续到下一步');
      await loadCases();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error('继续失败', { description: msg });
    } finally {
      setContinuing(null);
    }
  };

  // PLANET-1260: Re-run AI for current step
  const handleRunAi = async (c: ServerCase) => {
    setRunningAi(c.id);
    try {
      await apiClient.post(`/api/cases/${c.id}/run-ai`);
      toast.success('AI 已重新生成');
      await loadCases();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error('AI 生成失败', { description: msg });
    } finally {
      setRunningAi(null);
    }
  };

  // Batch continue: advance all selected waiting_review cases
  async function handleBatchContinue() {
    if (!cases) return;
    const targets = cases.filter(c => selectedIds.has(c.id) && c.status === 'waiting_review');
    if (!targets.length) { toast.error('没有可继续的案例（仅待审核状态可继续）'); return; }
    let ok = 0;
    for (const c of targets) {
      try {
        await apiClient.post(`/api/cases/${c.id}/continue`);
        ok++;
      } catch (e) {
        console.warn(`batch continue ${c.id} failed:`, e);
      }
    }
    toast.success(`已批量继续 ${ok} 个案例`);
    setSelectedIds(new Set());
    await loadCases();
  }

  // Batch delete: delete all selected cases
  async function handleBatchDelete() {
    setBatchDeleting(true);
    let ok = 0;
    const ids = Array.from(selectedIds);
    for (const id of ids) {
      try {
        await apiClient.delete(`/api/cases/${id}`);
        ok++;
      } catch (e) {
        console.warn(`batch delete ${id} failed:`, e);
      }
    }
    toast.success(`已批量删除 ${ok} 个案例`);
    setSelectedIds(new Set());
    setBatchDeleteOpen(false);
    setBatchDeleting(false);
    await loadCases();
  }

  // PLANET-1260: Run selected waiting_review case
  const [runningSelected, setRunningSelected] = useState(false);
  const handleRunSelected = async () => {
    if (!cases) return;
    const target = cases.find(c => selectedIds.has(c.id) && c.status === 'waiting_review')
      ?? cases.find(c => c.status === 'waiting_review');
    if (!target) {
      toast.error('没有可运行的案例', { description: '请先创建案例并填写属性' });
      return;
    }
    setRunningSelected(true);
    try {
      await apiClient.post(`/api/cases/${target.id}/continue`);
      toast.success('已继续执行');
      await loadCases();
    } catch (e) {
      toast.error('执行失败', { description: e instanceof Error ? e.message : String(e) });
    } finally {
      setRunningSelected(false);
    }
  };

  return (
    <>
      <div className="flex flex-col h-full overflow-hidden">
        {/* ── Header: create + import + run + filters ── */}
        <div className="px-3 py-2.5 border-b space-y-2">
          {/* Row 1: New case input + Run button */}
          <div className="flex gap-1.5">
            <Input
              placeholder={t('cases.newCasePlaceholder', { defaultValue: '案例标题' })}
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') void createCase(); }}
              className="h-7 text-xs flex-1"
              data-testid="cases-new-title"
            />
            <Button
              size="sm"
              variant="outline"
              className="h-7 px-2 text-xs shrink-0"
              onClick={createCase}
              disabled={creating || !newTitle.trim()}
              data-testid="cases-new-submit"
            >
              <Plus className="h-3 w-3 mr-0.5" />
              新建
            </Button>
            <Button
              size="sm"
              className="h-7 px-2.5 text-xs shrink-0 bg-emerald-600 hover:bg-emerald-700 text-white gap-1"
              onClick={() => void handleRunSelected()}
              disabled={runningSelected || workflow.steps.length === 0}
              data-testid="run-workflow-button"
              title="运行选中的待审核案例"
            >
              {runningSelected
                ? <Loader2 className="h-3 w-3 animate-spin" />
                : <Play className="h-3 w-3" />}
              <span>{runningSelected ? '运行中…' : '▶ 运行'}</span>
            </Button>
          </div>

          {/* Row 2: Batch import */}
          <Button
            size="sm"
            variant="outline"
            className="w-full h-6 text-[10px] gap-1.5 border-dashed"
            onClick={() => setBatchDialogOpen(true)}
            data-testid="cases-batch-import-btn"
          >
            <Upload className="h-3 w-3" />
            批量导入 Excel / CSV
          </Button>

          {/* Row 3: Filters */}
          <div className="flex flex-wrap gap-1">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => { setFilter(f.key); setSelectedIds(new Set()); }}
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

        {/* ── Batch action bar ── */}
        {filtered && selectedIds.size > 0 && (
          <div className="flex items-center gap-2 px-3 py-2 bg-primary/5 border-b text-xs">
            <span className="font-medium">已选 {selectedIds.size} 个案例</span>
            <Button size="sm" variant="outline" className="h-6 text-xs" onClick={() => void handleBatchContinue()}>
              ▶️ 批量继续
            </Button>
            <Button size="sm" variant="outline" className="h-6 text-xs text-destructive" onClick={() => setBatchDeleteOpen(true)}>
              🗑️ 批量删除
            </Button>
            <div className="ml-auto">
              <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => setSelectedIds(new Set())}>
                取消选择
              </Button>
            </div>
          </div>
        )}

        {/* ── Table ── */}
        <ScrollArea className="flex-1">
          {!filtered ? (
            <p className="text-xs text-muted-foreground p-4 text-center">Loading…</p>
          ) : filtered.length === 0 ? (
            <p className="text-xs text-muted-foreground p-4 text-center">
              {t('cases.empty', { defaultValue: 'No cases for this filter.' })}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="text-[10px]">
                  <TableHead className="h-7 w-8 px-2">
                    <input
                      type="checkbox"
                      className="cursor-pointer"
                      checked={filtered!.length > 0 && selectedIds.size === filtered!.length}
                      onChange={(e) => {
                        if (e.target.checked) setSelectedIds(new Set(filtered!.map(c => c.id)));
                        else setSelectedIds(new Set());
                      }}
                    />
                  </TableHead>
                  <TableHead className="h-7 px-2">案例名称</TableHead>
                  <TableHead className="h-7 px-2 w-[72px]">状态</TableHead>
                  <TableHead className="h-7 px-2 w-[90px]">当前步骤</TableHead>
                  <TableHead className="h-7 px-2 w-[70px]">创建时间</TableHead>
                  <TableHead className="h-7 px-2 w-[36px]">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((c) => {
                  const payload = (() => {
                    try { return JSON.parse(c.payload || '{}') as Record<string, unknown>; }
                    catch { return {} as Record<string, unknown>; }
                  })();
                  const isSelected = selectedCaseId === c.id;
                  const isCompleting = completing === c.id;
                  const isLoadingThisSteps = loadingSteps === c.id;
                  const isContinuing = continuing === c.id;
                  const isRunningThisAi = runningAi === c.id;

                  return (
                    <TableRow
                      key={c.id}
                      className={cn(
                        'cursor-pointer text-[11px] hover:bg-accent/40 transition-colors',
                        isSelected && 'bg-primary/5 border-l-2 border-l-primary',
                        selectedIds.has(c.id) && 'bg-primary/5',
                      )}
                      onClick={() => navigate(`/workflows/${workflow.id}/cases/${c.id}`)}
                      data-testid={`case-row-${c.id}`}
                    >
                      {/* checkbox */}
                      <TableCell className="w-8 px-2 py-1.5" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          className="cursor-pointer"
                          checked={selectedIds.has(c.id)}
                          onChange={(e) => {
                            setSelectedIds(prev => {
                              const next = new Set(prev);
                              if (e.target.checked) next.add(c.id);
                              else next.delete(c.id);
                              return next;
                            });
                          }}
                        />
                      </TableCell>
                      {/* 案例名称 + progress */}
                      <TableCell className="px-2 py-1.5 max-w-[160px]">
                        <div className="truncate font-medium text-xs">{c.title}</div>
                        <StepProgress workflow={workflow} currentStepId={c.currentStepId} status={c.status} />
                      </TableCell>

                      {/* 状态 */}
                      <TableCell className="px-2 py-1.5">
                        <Badge
                          variant={STATUS_VARIANT[c.status] ?? 'default'}
                          className="text-[9px] uppercase"
                        >
                          {STATUS_LABEL[c.status] ?? c.status}
                        </Badge>
                      </TableCell>

                      {/* 当前步骤 */}
                      <TableCell className="px-2 py-1.5 text-muted-foreground truncate max-w-[90px]">
                        {resolveStepName(c.currentStepId, workflow)}
                      </TableCell>

                      {/* 创建时间 */}
                      <TableCell className="px-2 py-1.5 text-muted-foreground whitespace-nowrap">
                        {relTime(c.createdAt)}
                      </TableCell>

                      {/* 操作: dropdown menu only */}
                      <TableCell className="px-2 py-1.5" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-0.5">
                        {c.status === 'running' && (
                          <div className="h-6 w-6 flex items-center justify-center">
                            <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                          </div>
                        )}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              data-testid={`case-actions-${c.id}`}
                            >
                              <MoreHorizontal className="h-3.5 w-3.5" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-40">
                            <DropdownMenuItem
                              className="text-xs gap-2"
                              onClick={() => setPayloadCase(c)}
                            >
                              <ClipboardList className="h-3.5 w-3.5" />
                              📋 属性
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-xs gap-2"
                              disabled={isLoadingThisSteps}
                              onClick={() => void openStepsDialog(c)}
                            >
                              <ScrollText className="h-3.5 w-3.5" />
                              📜 运行记录
                            </DropdownMenuItem>
                            {c.status === 'waiting_review' && (
                              <>
                                <DropdownMenuItem
                                  className="text-xs gap-2 text-blue-600"
                                  disabled={isRunningThisAi}
                                  onClick={() => void handleRunAi(c)}
                                >
                                  <Bot className="h-3.5 w-3.5" />
                                  🤖 AI 生成
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  className="text-xs gap-2"
                                  onClick={() => setPayloadCase(c)}
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                  ✏️ 手动编辑
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  className="text-xs gap-2 text-green-600"
                                  disabled={isContinuing}
                                  onClick={() => void handleContinue(c)}
                                >
                                  <FastForward className="h-3.5 w-3.5" />
                                  ▶️ 继续下一步
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                              </>
                            )}
                            {c.status === 'waiting_human' && (
                              <DropdownMenuItem
                                className="text-xs gap-2 text-green-600"
                                disabled={isCompleting}
                                onClick={() => void handleComplete(c)}
                              >
                                <CheckCircle className="h-3.5 w-3.5" />
                                ▶️ 继续执行
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-xs gap-2 text-destructive focus:text-destructive"
                              onClick={() => setDeleteTarget(c)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              🗑️ 删除
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </ScrollArea>
      </div>

      {/* ── Delete confirmation ── */}
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

      {/* ── Payload dialog ── */}
      {payloadCase && (
        <CasePayloadDialog
          open
          onClose={() => {
            setPayloadCase(null);
            void loadCases();
          }}
          caseId={payloadCase.id}
          caseTitle={payloadCase.title}
          payload={(() => {
            try { return JSON.parse(payloadCase.payload || '{}'); }
            catch { return {}; }
          })()}
        />
      )}

      {/* ── Steps dialog ── */}
      {stepsCase && (
        <CaseStepsDialog
          open
          onClose={() => setStepsCase(null)}
          caseTitle={stepsCase.c.title}
          steps={stepsCase.steps}
        />
      )}

      {/* ── Batch delete confirmation ── */}
      <AlertDialog open={batchDeleteOpen} onOpenChange={(v) => { if (!v) setBatchDeleteOpen(false); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>批量删除案例？</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除选中的 {selectedIds.size} 个案例吗？此操作不可撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={batchDeleting}>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBatchDelete}
              disabled={batchDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {batchDeleting ? '删除中…' : '确认删除'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Batch import ── */}
      <BatchImportDialog
        open={batchDialogOpen}
        onClose={() => setBatchDialogOpen(false)}
        workflowId={workflow.id}
        onSuccess={() => void loadCases()}
      />
    </>
  );
}
