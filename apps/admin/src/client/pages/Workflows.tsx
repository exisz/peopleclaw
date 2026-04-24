import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { toast } from 'sonner';
import type { Workflow, WorkflowStep } from '../types';
import Sidebar, { type StepTemplate } from '../components/workflow/Sidebar';
import WorkflowEditor from '../components/workflow/WorkflowEditor';
import { Skeleton } from '../components/ui/skeleton';
import { Button } from '../components/ui/button';
import { LanguageToggle } from '../components/language-toggle';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Plus, Trash2, LayoutDashboard, Settings, Workflow as WorkflowIcon, BookOpen, GitBranch, LibraryBig, Briefcase } from 'lucide-react';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { apiClient, ApiError } from '../lib/api';
import UserMenu from '../components/UserMenu';
import { ThemeToggle } from '../components/theme-toggle';
import TenantSwitcher from '../components/TenantSwitcher';

interface ServerWorkflow {
  id: string;
  name: string;
  category: string | null;
  definition: {
    description?: string;
    icon?: string;
    steps?: WorkflowStep[];
    nodes?: Array<{ id: string; position?: { x: number; y: number } }>;
    edges?: unknown[];
  } | null;
}

function hydrate(w: ServerWorkflow): Workflow {
  const def = w.definition ?? {};
  // Restore positions: lookup nodes[].position by id and merge into steps[]
  const posMap = new Map<string, { x: number; y: number }>();
  for (const n of def.nodes ?? []) {
    if (n?.id && n.position) posMap.set(n.id, n.position);
  }
  const steps = (def.steps ?? []).map((s) => ({
    ...s,
    // Prefer step-embedded position (newer), fall back to nodes[] mapping
    position: s.position ?? posMap.get(s.id),
  }));
  return {
    id: w.id,
    name: w.name,
    category: w.category ?? '',
    description: def.description ?? '',
    icon: def.icon ?? '📋',
    steps,
  };
}

export default function Workflows() {
  const navigate = useNavigate();
  const { t } = useTranslation('common');
  const { id, caseId } = useParams<{ id?: string; caseId?: string }>();

  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [templates, setTemplates] = useState<StepTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedWorkflow, setSelectedWorkflow] = useState<Workflow | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');

  const reload = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [wfData, tplData] = await Promise.all([
        apiClient.get<{ workflows: ServerWorkflow[] }>('/api/workflows'),
        apiClient.get<{ templates: StepTemplate[] }>('/api/step-templates').catch(() => ({ templates: [] })),
      ]);
      setWorkflows(wfData.workflows.map(hydrate));
      setTemplates(tplData.templates);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setLoadError(msg);
      toast.error('Failed to load workflows', { description: msg });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { reload(); }, [reload]);

  // Sync URL → selection
  // PLANET-1098: No auto-select on initial load — only select when an :id is present in the URL.
  useEffect(() => {
    if (workflows.length === 0) {
      setSelectedWorkflow(null);
      return;
    }
    if (!id) {
      // No workflow ID in URL → show empty state; don't auto-select the first workflow.
      setSelectedWorkflow(null);
      return;
    }
    const target = workflows.find((w) => w.id === id);
    if (target && (!selectedWorkflow || selectedWorkflow.id !== target.id)) {
      setSelectedWorkflow(target);
    }
  }, [id, workflows, selectedWorkflow]);

  // After commits, refetch full workflow occasionally? Editor handles its own state — no reload needed.

  const handleSelect = useCallback(
    (w: Workflow) => {
      setSelectedWorkflow(w);
      navigate(`/workflows/${w.id}`);
    },
    [navigate],
  );

  // Adding step from sidebar click (non-drag fallback)
  const handleAddStepFromTemplate = useCallback(
    (template: StepTemplate) => {
      // The new editor is the source of truth; this adds via API with a centered position.
      if (!selectedWorkflow) return;
      const stepId = `s_${Math.random().toString(36).slice(2, 8)}`;
      const labelEn = template.label?.en ?? template.id;
      const uiType: WorkflowStep['type'] =
        template.kind === 'human' ? 'human' : template.kind === 'subflow' ? 'subflow' : 'agent';
      const newStep: WorkflowStep = {
        id: stepId,
        name: labelEn,
        type: uiType,
        assignee: template.handler,
        description: template.description?.en ?? '',
        tools: [`handler:${template.handler}`],
        position: { x: 0, y: (selectedWorkflow.steps.length) * 160 },
        iconName: template.icon,
        templateId: template.id,
        fromTemplate: true,
      };
      const updated: Workflow = { ...selectedWorkflow, steps: [...selectedWorkflow.steps, newStep] };
      setSelectedWorkflow(updated);
      setWorkflows((prev) => prev.map((w) => (w.id === updated.id ? updated : w)));
      // Persist
      apiClient
        .put(`/api/workflows/${updated.id}`, {
          name: updated.name,
          category: updated.category,
          definition: {
            description: updated.description,
            icon: updated.icon,
            steps: updated.steps,
            nodes: updated.steps.map((s) => ({ id: s.id, position: s.position ?? { x: 0, y: 0 } })),
            edges: [],
          },
        })
        .catch((e) => toast.error('Save failed', { description: e instanceof Error ? e.message : String(e) }));
      toast.success(`Added: ${labelEn}`);
    },
    [selectedWorkflow],
  );

  const handleCreate = useCallback(async () => {
    if (!newName.trim()) return;
    try {
      const { workflow } = await apiClient.post<{ workflow: ServerWorkflow }>(
        '/api/workflows',
        {
          name: newName.trim(),
          category: 'product',
          definition: { description: newDesc.trim(), icon: '📋', steps: [], nodes: [], edges: [] },
        },
      );
      const hydrated = hydrate(workflow);
      setWorkflows((prev) => [hydrated, ...prev]);
      setCreateOpen(false);
      setNewName('');
      setNewDesc('');
      navigate(`/workflows/${hydrated.id}`);
      toast.success('Workflow created');
    } catch (e) {
      // PLANET-930: Show explicit error on slug collision; keep modal open so user can retry.
      if (e instanceof ApiError && (e.code === 'WORKFLOW_SLUG_CONFLICT' || e.status === 409)) {
        toast.error('A workflow with this name already exists. Try a different name.', {
          description: e.message,
        });
        return; // modal stays open, name preserved
      }
      const msg = e instanceof Error ? e.message : String(e);
      toast.error('Failed to create workflow', { description: msg });
    }
  }, [newName, navigate]);

  const handleDelete = useCallback(async () => {
    if (!selectedWorkflow) return;
    const target = selectedWorkflow;
    // Optimistic + toast undo (5s)
    const prev = workflows;
    const remaining = workflows.filter((w) => w.id !== target.id);
    setWorkflows(remaining);
    if (remaining.length > 0) navigate(`/workflows/${remaining[0].id}`);
    else navigate('/workflows');

    let undone = false;
    toast(`Deleted "${target.name}"`, {
      action: {
        label: 'Undo',
        onClick: () => {
          undone = true;
          setWorkflows(prev);
          navigate(`/workflows/${target.id}`);
        },
      },
      duration: 5000,
    });
    setTimeout(async () => {
      if (undone) return;
      try {
        await apiClient.delete(`/api/workflows/${target.id}`);
      } catch (e) {
        setWorkflows(prev);
        navigate(`/workflows/${target.id}`);
        if (e instanceof ApiError && e.status === 409 && e.data && Array.isArray(e.data.cases)) {
          const cases = e.data.cases as Array<{ id: string; name: string; url: string }>;
          if (cases.length === 1) {
            toast.error(`无法删除：以下案例正在使用此工作流`, {
              description: cases[0].name,
              action: { label: '前往查看', onClick: () => navigate(cases[0].url) },
              duration: 8000,
            });
          } else {
            // Multiple cases — show a list in description
            const desc = cases.map((c) => `• ${c.name}`).join('\n');
            toast.error('以下案例正在使用此工作流，请先移除引用再删除：', {
              description: desc,
              duration: 10000,
            });
          }
        } else {
          toast.error('Delete failed; restoring', { description: e instanceof Error ? e.message : String(e) });
        }
      }
    }, 5100);
  }, [selectedWorkflow, workflows, navigate]);

  if (loading) {
    return (
      <div className="flex h-screen overflow-hidden bg-background text-foreground">
        <aside className="w-72 border-r p-4 space-y-3">
          <Skeleton className="h-9 w-full" />
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </aside>
        <div className="flex-1 p-6 space-y-4">
          <Skeleton className="h-10 w-1/3" />
          <Skeleton className="h-[calc(100vh-160px)] w-full" />
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex h-screen items-center justify-center bg-background text-foreground p-6">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Could not load workflows</CardTitle>
            <CardDescription className="break-words">{loadError}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={reload}>Retry</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      <Sidebar
        workflows={workflows}
        selected={selectedWorkflow}
        onSelect={handleSelect}
        onAddStepTemplate={handleAddStepFromTemplate}
        onDeleteWorkflow={(id) => {
          const target = workflows.find((w) => w.id === id);
          if (!target) return;
          const remaining = workflows.filter((w) => w.id !== id);
          setWorkflows(remaining);
          if (selectedWorkflow?.id === id) {
            if (remaining.length > 0) navigate(`/workflows/${remaining[0].id}`);
            else navigate('/workflows');
          }
        }}
      />
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top navigation bar */}
        <div className="flex items-center gap-1 px-4 py-2 border-b bg-background" data-testid="app-topbar">
          <Button asChild size="sm" variant="ghost" className="text-xs gap-1.5">
            <Link to="/dashboard" data-testid="nav-dashboard">
              <LayoutDashboard className="h-4 w-4" /> 我的
            </Link>
          </Button>
          <Button asChild size="sm" variant="ghost" className="text-xs gap-1.5">
            <Link to="/settings" data-testid="nav-settings">
              <Settings className="h-4 w-4" /> {t('common:nav.settings', { defaultValue: 'Settings' })}
            </Link>
          </Button>
          <Button asChild size="sm" variant="ghost" className="text-xs gap-1.5">
            <Link to="/settings/background" data-testid="nav-background-settings">
              <BookOpen className="h-4 w-4" /> 背景设定
            </Link>
          </Button>
          <Button asChild size="sm" variant="ghost" className="text-xs gap-1.5">
            <Link to="/templates" data-testid="nav-templates">
              <LibraryBig className="h-4 w-4" /> 模板库
            </Link>
          </Button>
          <Button asChild size="sm" variant="ghost" className="text-xs gap-1.5">
            <Link to="/cases" data-testid="nav-cases">
              <Briefcase className="h-4 w-4" /> 案例
            </Link>
          </Button>
          <div className="mx-2 h-4 border-l border-border" />
          <Button size="sm" variant="outline" onClick={() => setCreateOpen(true)} data-testid="create-workflow-btn">
            <Plus className="h-4 w-4 mr-1" /> 新工作流
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="text-destructive hover:text-destructive"
            onClick={handleDelete}
            disabled={!selectedWorkflow}
          >
            <Trash2 className="h-4 w-4 mr-1" /> Delete
          </Button>
          {/* Workflow name breadcrumb */}
          <div className="mx-2 h-4 border-l border-border" />
          <span className="text-sm font-medium truncate max-w-[240px]" data-testid="workflow-breadcrumb-name">
            {selectedWorkflow?.name ?? ''}
          </span>
          <div className="ml-auto flex items-center gap-2">
            <TenantSwitcher />
            <LanguageToggle />
            <ThemeToggle />
            <UserMenu />
          </div>
        </div>
        <main className="flex-1 overflow-hidden bg-muted/30">
          {!selectedWorkflow ? (
            <div className="flex h-full flex-col items-center justify-center gap-4 text-center p-6">
              <GitBranch className="h-12 w-12 text-muted-foreground/40" />
              <div className="space-y-1">
                {workflows.length > 0 ? (
                  // PLANET-1098: Workflows exist but none selected — guide user to click one.
                  <>
                    <p className="text-lg font-medium">选择一个工作流开始</p>
                    <p className="text-sm text-muted-foreground">点击左侧工作流列表中的任意工作流以查看或编辑。</p>
                  </>
                ) : (
                  <>
                    <p className="text-lg font-medium">还没有工作流</p>
                    <p className="text-sm text-muted-foreground">创建第一个工作流，开始自动化您的业务流程。</p>
                  </>
                )}
              </div>
              {workflows.length === 0 && (
                <Button onClick={() => setCreateOpen(true)} data-testid="create-first-workflow-btn">
                  <Plus className="h-4 w-4 mr-2" /> 创建第一个工作流
                </Button>
              )}
            </div>
          ) : (
            <ErrorBoundary>
              <WorkflowEditor
                key={selectedWorkflow.id}
                workflow={selectedWorkflow}
                selectedCaseId={caseId ?? null}
                templates={templates}
                onSaved={() => toast.success('工作流已保存', { description: selectedWorkflow.name })}
              />
            </ErrorBoundary>
          )}
        </main>
      </div>

      <CreateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        name={newName}
        onName={setNewName}
        desc={newDesc}
        onDesc={setNewDesc}
        onSubmit={handleCreate}
      />
    </div>
  );
}

function CreateDialog({
  open,
  onOpenChange,
  name,
  onName,
  desc,
  onDesc,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  name: string;
  onName: (s: string) => void;
  desc: string;
  onDesc: (s: string) => void;
  onSubmit: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>New Workflow</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Give your workflow a name to get started. You can add steps after creating it.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="create-wf-name">
              名称 <span className="text-destructive">*</span>
            </Label>
            <Input
              id="create-wf-name"
              placeholder="例如：产品审核流程"
              value={name}
              onChange={(e) => onName(e.target.value)}
              autoFocus
              onKeyDown={(e) => { if (e.key === 'Enter' && name.trim()) onSubmit(); }}
              data-testid="create-workflow-name"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="create-wf-desc">Description <span className="text-muted-foreground text-xs">(optional)</span></Label>
            <Textarea
              id="create-wf-desc"
              placeholder="What does this workflow do?"
              value={desc}
              onChange={(e) => onDesc(e.target.value)}
              rows={3}
              className="resize-none text-sm"
              data-testid="create-workflow-desc"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="create-workflow-cancel">Cancel</Button>
          <Button onClick={onSubmit} disabled={!name.trim()} data-testid="create-workflow-submit">Create</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
// redeploy Tue Apr 21 16:03:40 AEST 2026
