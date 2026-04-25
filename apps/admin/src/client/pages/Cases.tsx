import { useEffect, useState, useCallback } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Skeleton } from '../components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { ArrowLeft, Copy, ExternalLink, Upload, Workflow, Bot, Hand, RotateCcw, RefreshCw, Save } from 'lucide-react';
import { apiClient } from '../lib/api';
import CreditsBadge from '../components/CreditsBadge';
import { LanguageToggle } from '../components/language-toggle';
import { ThemeToggle } from '../components/theme-toggle';
import BatchImportDialog from '../components/workflow/BatchImportDialog';

interface CaseStep {
  id: string;
  stepId: string;
  stepType: string;
  kind: string;
  status: string;
  output: string;
  error: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}
interface CaseRow {
  id: string;
  workflowId: string;
  title: string;
  status: string;
  batchId?: string | null;
  currentStepId: string | null;
  payload: string;
  stepModeOverrides?: string; // PLANET-1251
  createdAt: string;
  updatedAt: string;
  steps?: CaseStep[];
  workflow?: { name: string; definition?: string };
}

// Helper: extract DefNode[] from workflow definition (handles nodes[], steps[], or both)
function extractDefNodes(definition?: string): DefNode[] {
  if (!definition) return [];
  try {
    const def = JSON.parse(definition);
    // If nodes[] has full info (type + kind), use them
    if (Array.isArray(def.nodes) && def.nodes.length) {
      const first = def.nodes[0];
      if (first.type && first.kind) return def.nodes;
      // nodes are position-only — merge with steps
      if (Array.isArray(def.steps) && def.steps.length) {
        const stepMap = new Map(def.steps.map((s: Record<string, unknown>) => [s.id, s]));
        return def.nodes.map((n: Record<string, unknown>) => {
          const step = stepMap.get(n.id as string) as Record<string, unknown> | undefined;
          return {
            id: n.id as string,
            type: (n.type as string) || (step?.type as string) || (step?.assignee as string) || 'unknown',
            kind: (n.kind as 'auto' | 'human') || (step?.kind as 'auto' | 'human') || 'auto',
            handler: (n.handler as string) || (step?.handler as string) || (step?.assignee as string) || undefined,
            config: (n.config as Record<string, unknown>) || (step?.config as Record<string, unknown>) || undefined,
          };
        });
      }
      return def.nodes;
    }
    // No nodes — derive from steps
    if (Array.isArray(def.steps) && def.steps.length) {
      return def.steps.map((s: Record<string, unknown>) => ({
        id: s.id as string,
        type: (s.type as string) || (s.assignee as string) || 'unknown',
        kind: (s.kind as 'auto' | 'human') || 'auto',
        handler: (s.handler as string) || (s.assignee as string) || undefined,
        config: (s.config as Record<string, unknown>) || undefined,
      }));
    }
  } catch {}
  return [];
}

// PLANET-1251: workflow definition node shape (from engine)
interface DefNode {
  id: string;
  type: string;
  kind: 'auto' | 'human';
  handler?: string;
  config?: Record<string, unknown>;
}

// PLANET-1251: Step Mode Override toggle component
function StepModeOverrides({
  caseId,
  nodes,
  overrides,
  onUpdate,
}: {
  caseId: string;
  nodes: DefNode[];
  overrides: Record<string, 'auto' | 'human'>;
  onUpdate: (overrides: Record<string, 'auto' | 'human'>) => void;
}) {
  const [saving, setSaving] = useState<string | null>(null);

  const toggle = async (nodeId: string, currentMode: 'auto' | 'human') => {
    const newMode = currentMode === 'auto' ? 'human' : 'auto';
    const next = { ...overrides };
    // Find the node's default kind
    const node = nodes.find((n) => n.id === nodeId);
    if (node && newMode === node.kind) {
      // Toggling back to default — remove the override
      delete next[nodeId];
    } else {
      next[nodeId] = newMode;
    }
    setSaving(nodeId);
    try {
      await apiClient.patch(`/api/cases/${caseId}/step-modes`, { overrides: next });
      onUpdate(next);
      toast.success('步骤模式已更新');
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error('更新失败', { description: msg });
    } finally {
      setSaving(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">步骤执行模式</CardTitle>
        <CardDescription>切换各步骤的执行方式 (AI自动 / 人工)</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {nodes.map((node) => {
          const effectiveMode = overrides[node.id] || node.kind;
          const isOverridden = !!overrides[node.id];
          const isAuto = effectiveMode === 'auto';
          return (
            <div
              key={node.id}
              className="flex items-center justify-between rounded-md border p-2.5 gap-3"
              data-testid={`step-mode-${node.id}`}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium truncate">{node.id}</span>
                  <Badge variant="outline" className="text-[9px] shrink-0">
                    {node.type}
                  </Badge>
                  {isOverridden && (
                    <Badge variant="secondary" className="text-[9px] shrink-0 bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300">
                      已切换
                    </Badge>
                  )}
                </div>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  默认: {node.kind === 'auto' ? '🤖 AI' : '✋ 人工'}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  size="sm"
                  variant={isAuto ? 'default' : 'outline'}
                  className="h-7 text-xs gap-1 px-2"
                  disabled={saving === node.id}
                  onClick={() => !isAuto && toggle(node.id, effectiveMode)}
                  data-testid={`step-mode-auto-${node.id}`}
                >
                  <Bot className="h-3 w-3" />
                  AI
                </Button>
                <Button
                  size="sm"
                  variant={!isAuto ? 'default' : 'outline'}
                  className="h-7 text-xs gap-1 px-2"
                  disabled={saving === node.id}
                  onClick={() => isAuto && toggle(node.id, effectiveMode)}
                  data-testid={`step-mode-human-${node.id}`}
                >
                  <Hand className="h-3 w-3" />
                  人工
                </Button>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

// PLANET-1253: Editable case payload card
function PayloadEditor({ caseId, payload, onUpdate }: { caseId: string; payload: string; onUpdate: () => void }) {
  const [fields, setFields] = useState<Record<string, unknown>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    try { setFields(JSON.parse(payload || '{}')); } catch { setFields({}); }
  }, [payload]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await apiClient.patch(`/api/cases/${caseId}/payload`, { fields });
      toast.success('案例数据已保存');
      onUpdate();
    } catch (e) {
      toast.error('保存失败', { description: e instanceof Error ? e.message : String(e) });
    } finally {
      setSaving(false);
    }
  };

  const updateField = (key: string, value: unknown) => {
    setFields((prev) => ({ ...prev, [key]: value }));
  };

  const highlight = ['product_name', 'title', 'price', 'stock', 'image_url', 'description'];
  const sortedKeys = Object.keys(fields).sort((a, b) => {
    const aH = highlight.includes(a) ? 0 : 1;
    const bH = highlight.includes(b) ? 0 : 1;
    return aH - bH || a.localeCompare(b);
  });

  // Skip internal/complex fields
  const editableKeys = sortedKeys.filter((k) => !k.startsWith('_') && typeof fields[k] !== 'object');

  if (editableKeys.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">编辑案例数据</CardTitle>
        <CardDescription>修改案例的字段数据，保存后可用于后续步骤</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {editableKeys.map((key) => {
          const val = fields[key];
          const isImage = key === 'image_url' || (typeof val === 'string' && /^https?:\/\/.+\.(jpg|jpeg|png|gif|webp)/i.test(val));
          const isNumber = typeof val === 'number';
          return (
            <div key={key} className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">{key}</label>
              <div className="flex items-center gap-2">
                <Input
                  type={isNumber ? 'number' : 'text'}
                  value={String(val ?? '')}
                  onChange={(e) => updateField(key, isNumber ? Number(e.target.value) || 0 : e.target.value)}
                  className="h-8 text-sm"
                />
                {isImage && typeof val === 'string' && val && (
                  <img src={val} alt={key} className="h-8 w-8 rounded border object-cover shrink-0" />
                )}
              </div>
            </div>
          );
        })}
        <Button size="sm" onClick={handleSave} disabled={saving} className="gap-1.5">
          <Save className="h-3.5 w-3.5" />
          {saving ? '保存中...' : '保存'}
        </Button>
      </CardContent>
    </Card>
  );
}

function ShopifyPublicUrlCard({ output }: { output: string }) {
  let parsed: Record<string, unknown> = {};
  try { parsed = JSON.parse(output); } catch {}
  const publicUrl = parsed.productPublicUrl as string | undefined;
  const adminUrl = parsed.productAdminUrl as string | undefined;
  if (!publicUrl) return null;
  return (
    <div className="mt-3 rounded-lg border border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950 p-4 space-y-3">
      <div className="font-semibold text-green-800 dark:text-green-300 text-sm">🛍️ 商品已上架</div>
      <div className="flex gap-2">
        <a href={publicUrl} target="_blank" rel="noreferrer" className="flex-1">
          <Button size="sm" className="w-full gap-2 bg-green-600 hover:bg-green-700 text-white">
            <ExternalLink className="h-4 w-4" />
            打开商品页
          </Button>
        </a>
        <Button
          size="sm"
          variant="outline"
          className="gap-2"
          onClick={() => {
            navigator.clipboard.writeText(publicUrl).then(() => toast.success('链接已复制'));
          }}
        >
          <Copy className="h-4 w-4" />
          复制链接
        </Button>
      </div>
      {adminUrl && (
        <p className="text-xs text-muted-foreground">
          后台管理：<a href={adminUrl} target="_blank" rel="noreferrer" className="underline hover:text-foreground">{adminUrl}</a>
        </p>
      )}
    </div>
  );
}

const STATUS_COLORS: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  running: 'default',
  waiting_human: 'secondary',
  awaiting_fix: 'destructive',
  done: 'outline',
  failed: 'destructive',
  cancelled: 'outline',
};

function CaseDetail({ id }: { id: string }) {
  const [c, setC] = useState<CaseRow | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [modeOverrides, setModeOverrides] = useState<Record<string, 'auto' | 'human'>>({});

  const load = useCallback(async () => {
    try {
      const d = await apiClient.get<{ case: CaseRow }>(`/api/cases/${id}`);
      setC(d.case);
      // PLANET-1251: parse step mode overrides
      try {
        const ov = JSON.parse(d.case.stepModeOverrides || '{}');
        setModeOverrides(ov);
      } catch { setModeOverrides({}); }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setErr(msg);
      toast.error('Failed to load case', { description: msg });
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  // Auto-poll while running
  useEffect(() => {
    if (!c) return;
    if (c.status === 'running') {
      const t = setInterval(load, 3000);
      return () => clearInterval(t);
    }
  }, [c, load]);

  if (err) return <div className="p-10">Error: {err}</div>;
  if (!c) {
    return (
      <div className="min-h-screen p-6 md:p-10 max-w-4xl mx-auto space-y-4">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const waitingStep = c.steps?.find((s) => s.status === 'waiting_human');

  async function advance(action: 'approve' | 'reject') {
    if (!waitingStep) return;
    setSubmitting(true);
    try {
      await apiClient.post(`/api/cases/${id}/advance`, {
        stepId: waitingStep.stepId,
        output: { comment, approved: action === 'approve' },
        action,
      });
      setComment('');
      await load();
      toast.success(action === 'approve' ? 'Step approved' : 'Step rejected');
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error('Failed to advance case', { description: msg });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen p-6 md:p-10 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <Button asChild variant="ghost" size="sm">
          <Link to="/cases"><ArrowLeft className="h-4 w-4" /> All cases</Link>
        </Button>
        <CreditsBadge />
      </div>

      <Card data-testid={`case-detail-${c.id}`}>
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <div>
              <CardTitle>{c.title}</CardTitle>
              <CardDescription>
                {c.workflow?.name ?? c.workflowId} · {new Date(c.createdAt).toLocaleString()}
              </CardDescription>
            </div>
            <Badge variant={STATUS_COLORS[c.status] ?? 'default'}>{c.status}</Badge>
          </div>
        </CardHeader>
      </Card>

      {/* PLANET-1251: Step Mode Overrides */}
      {(() => {
        const defNodes = extractDefNodes(c.workflow?.definition);
        if (defNodes.length === 0) return null;
        return (
          <StepModeOverrides
            caseId={c.id}
            nodes={defNodes}
            overrides={modeOverrides}
            onUpdate={setModeOverrides}
          />
        );
      })()}

      {/* PLANET-1253: Payload Editor */}
      <PayloadEditor caseId={c.id} payload={c.payload} onUpdate={load} />

      {/* PLANET-1254: Retreat + PLANET-1255: Retry action bar */}
      {(() => {
        const defNodes = extractDefNodes(c.workflow?.definition);
        const def = c.workflow?.definition ? (() => { try { return JSON.parse(c.workflow.definition!); } catch { return null; } })() : null;
        const isAtFirst = !def?.edges?.some((e: { target: string }) => e.target === c.currentStepId);
        const canRetreat = !isAtFirst && ['waiting_human', 'failed', 'done'].includes(c.status);
        const canRetry = c.status === 'failed';
        const failedStep = c.steps?.find((s) => s.status === 'failed');

        if (!canRetreat && !canRetry) return null;

        return (
          <Card>
            <CardContent className="pt-4 space-y-3">
              {failedStep?.error && (
                <div className="text-sm text-red-600 bg-red-50 dark:bg-red-950 dark:text-red-400 p-3 rounded-md">
                  <span className="font-medium">错误信息：</span> {failedStep.error}
                </div>
              )}
              <div className="flex gap-2">
                {canRetreat && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={c.status === 'running'}
                    onClick={async () => {
                      try {
                        await apiClient.post(`/api/cases/${c.id}/retreat`);
                        toast.success('已回退一步');
                        await load();
                      } catch (e) {
                        toast.error('回退失败', { description: e instanceof Error ? e.message : String(e) });
                      }
                    }}
                    data-testid="case-retreat-btn"
                  >
                    <RotateCcw className="h-3.5 w-3.5 mr-1" />
                    ⬅️ 回退一步
                  </Button>
                )}
                {canRetry && (
                  <Button
                    size="sm"
                    variant="default"
                    onClick={async () => {
                      try {
                        await apiClient.post(`/api/cases/${c.id}/retry`);
                        toast.success('正在重试...');
                        await load();
                      } catch (e) {
                        toast.error('重试失败', { description: e instanceof Error ? e.message : String(e) });
                      }
                    }}
                    data-testid="case-retry-btn"
                  >
                    <RefreshCw className="h-3.5 w-3.5 mr-1" />
                    🔄 重试
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })()}

      {waitingStep && (
        <Card className="border-yellow-500/40">
          <CardHeader>
            <CardTitle>Action required: {waitingStep.stepType}</CardTitle>
            <CardDescription>Step id: {waitingStep.stepId}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input
              placeholder="Optional comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />
            <div className="flex gap-2">
              <Button onClick={() => advance('approve')} disabled={submitting} data-testid="human-action-approve">
                Approve & continue
              </Button>
              <Button
                onClick={() => advance('reject')}
                variant="outline"
                disabled={submitting}
                data-testid="human-action-reject"
              >
                Reject
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card data-testid="case-step-timeline">
        <CardHeader>
          <CardTitle>Step timeline</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {(c.steps ?? []).map((s) => {
            let outPreview = s.output;
            try {
              const parsed = JSON.parse(s.output);
              outPreview = JSON.stringify(parsed, null, 2);
            } catch {}
            const dur =
              s.startedAt && s.completedAt
                ? Math.round((new Date(s.completedAt).getTime() - new Date(s.startedAt).getTime()) / 100) / 10 + 's'
                : '—';
            return (
              <div key={s.id} className="border rounded-md p-3" data-testid={`case-step-${s.stepId}-status`}>
                <div className="flex items-center justify-between text-sm">
                  <div className="font-medium">
                    {s.stepId} <span className="text-muted-foreground font-normal">({s.stepType})</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{s.kind}</Badge>
                    <Badge variant={STATUS_COLORS[s.status] ?? 'default'}>{s.status}</Badge>
                    <span className="text-xs text-muted-foreground">{dur}</span>
                  </div>
                </div>
                {s.error && <p className="mt-2 text-xs text-red-600">{s.error}</p>}
                <ShopifyPublicUrlCard output={s.output} />
                {outPreview && outPreview !== '{}' && (
                  <pre className="mt-2 text-xs bg-muted p-2 rounded overflow-auto max-h-48">{outPreview}</pre>
                )}
              </div>
            );
          })}
          {(!c.steps || c.steps.length === 0) && (
            <p className="text-sm text-muted-foreground">No steps yet.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

const FILTERS = ['all', 'running', 'waiting_human', 'awaiting_fix', 'done', 'failed', 'cancelled'] as const;

interface WorkflowSummary {
  id: string;
  name: string;
}

function CasesList() {
  const navigate = useNavigate();
  const [cases, setCases] = useState<CaseRow[]>([]);
  const [filter, setFilter] = useState<typeof FILTERS[number]>('all');
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [batchDialogOpen, setBatchDialogOpen] = useState(false);
  const [batchWorkflowId, setBatchWorkflowId] = useState<string>('');
  const [workflows, setWorkflows] = useState<WorkflowSummary[]>([]);
  const [showWorkflowPicker, setShowWorkflowPicker] = useState(false);

  useEffect(() => {
    apiClient
      .get<{ workflows: WorkflowSummary[] }>('/api/workflows')
      .then((d) => { setWorkflows(d.workflows ?? []); })
      .catch(() => {});
  }, []);

  function openBatchImport() {
    if (workflows.length === 0) {
      toast.error('暂无可用工作流', {
        description: '请先创建一个工作流，再进行批量导入',
        action: {
          label: '去创建工作流',
          onClick: () => navigate('/workflows'),
        },
        duration: 8000,
      });
      return;
    }
    // F207 (PLANET-1206): Auto-select the Shopify direct listing template
    // when a matching workflow exists (name contains "上架" or "Shopify").
    // If found, skip the picker and open the batch dialog directly.
    const shopifyWorkflow = workflows.find((wf) =>
      wf.name.includes('上架') || /shopify/i.test(wf.name),
    );
    if (shopifyWorkflow) {
      setBatchWorkflowId(shopifyWorkflow.id);
      setBatchDialogOpen(true);
      return;
    }
    if (workflows.length === 1) {
      setBatchWorkflowId(workflows[0].id);
      setBatchDialogOpen(true);
      return;
    }
    setShowWorkflowPicker(true);
  }

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setErr(null);
    const url = filter === 'all' ? '/api/cases' : `/api/cases?status=${filter}`;
    apiClient
      .get<{ cases: CaseRow[] }>(url)
      .then((d) => { if (!cancelled) setCases(d.cases); })
      .catch((e) => {
        const msg = e instanceof Error ? e.message : String(e);
        if (!cancelled) {
          setErr(msg);
          toast.error('Failed to load cases', { description: msg });
        }
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [filter]);

  return (
    <div className="min-h-screen p-6 md:p-10 max-w-6xl mx-auto space-y-6">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="sm" data-testid="cases-back-home">
            <Link to="/workflows">
              <Workflow className="h-4 w-4" />
              <ArrowLeft className="h-3 w-3 -ml-1" />
              工作流
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Cases</h1>
            <p className="text-sm text-muted-foreground mt-1">{cases.length} cases</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <LanguageToggle />
          <CreditsBadge />
          <Button
            size="sm"
            variant="outline"
            onClick={openBatchImport}
            data-testid="cases-batch-import-btn"
          >
            <Upload className="h-4 w-4 mr-1.5" />
            批量导入
          </Button>
        </div>
      </header>

      {/* Workflow picker overlay when multiple workflows exist */}
      {showWorkflowPicker && (
        <Card className="border-primary/40">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">选择 Workflow 进行批量导入</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center gap-3">
            <Select
              value={batchWorkflowId}
              onValueChange={setBatchWorkflowId}
            >
              <SelectTrigger className="w-64">
                <SelectValue placeholder="选择 Workflow…" />
              </SelectTrigger>
              <SelectContent>
                {workflows.map((wf) => (
                  <SelectItem key={wf.id} value={wf.id}>{wf.name || wf.id}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              size="sm"
              disabled={!batchWorkflowId}
              onClick={() => {
                setShowWorkflowPicker(false);
                setBatchDialogOpen(true);
              }}
            >
              继续
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setShowWorkflowPicker(false)}>
              取消
            </Button>
          </CardContent>
        </Card>
      )}

      <BatchImportDialog
        open={batchDialogOpen}
        onClose={() => { setBatchDialogOpen(false); setBatchWorkflowId(''); }}
        workflowId={batchWorkflowId}
        onSuccess={() => {
          // Reload cases after import
          const url = filter === 'all' ? '/api/cases' : `/api/cases?status=${filter}`;
          apiClient.get<{ cases: CaseRow[] }>(url).then((d) => setCases(d.cases)).catch(() => {});
        }}
      />

      <div className="flex gap-2 flex-wrap">
        {FILTERS.map((f) => (
          <Badge
            key={f}
            variant={filter === f ? 'default' : 'outline'}
            className="cursor-pointer"
            onClick={() => setFilter(f)}
          >
            {f}
          </Badge>
        ))}
      </div>

      {err && <p className="text-red-600 text-sm">{err}</p>}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" data-testid="cases-table">
        {loading && Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-32 w-full" />)}
        {!loading && cases.map((c) => (
          <div key={c.id} className="relative">
            <Link to={`/cases/${c.id}`} data-testid={`case-row-${c.id}`}>
              <Card className="h-full transition-all hover:shadow-md hover:border-primary/40">
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base leading-snug">{c.title}</CardTitle>
                    <Badge variant={STATUS_COLORS[c.status] ?? 'default'}>{c.status}</Badge>
                  </div>
                  <CardDescription className="text-xs">{c.workflowId}</CardDescription>
                </CardHeader>
                <CardContent>
                  {/* PLANET-1200: "查看商品" link when case has a Shopify public URL */}
                  {(() => {
                    try {
                      const p = JSON.parse(c.payload || '{}');
                      if (p.productPublicUrl) return (
                        <a
                          href={p.productPublicUrl as string}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-1 text-xs text-green-700 dark:text-green-400 hover:underline mb-2"
                          data-testid={`case-shopify-url-${c.id}`}
                        >
                          🛍️ 查看商品
                        </a>
                      );
                    } catch {}
                    return null;
                  })()}
                  <p className="font-mono text-[10px] text-muted-foreground">
                    Updated {new Date(c.updatedAt).toLocaleString()}
                  </p>
                </CardContent>
              </Card>
            </Link>
            <Link
              to={`/workflows/${c.workflowId}/cases/${c.id}`}
              className="absolute bottom-2 right-3 text-[10px] font-mono text-primary hover:underline"
              data-testid={`case-view-in-workflow-${c.id}`}
            >
              View in workflow →
            </Link>
          </div>
        ))}
        {!loading && cases.length === 0 && !err && (
          <Card className="col-span-full">
            <CardHeader>
              <CardTitle>No cases yet</CardTitle>
              <CardDescription>
                Start a workflow run from the Workflows page to create your first case.
              </CardDescription>
            </CardHeader>
          </Card>
        )}
      </div>
    </div>
  );
}

export default function Cases() {
  const { id } = useParams<{ id?: string }>();
  return id ? <CaseDetail id={id} /> : <CasesList />;
}
