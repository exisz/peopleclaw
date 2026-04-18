import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import type { Workflow, Case, WorkflowStep } from '../types';
import Sidebar from '../components/workflow/Sidebar';
import TopBar from '../components/workflow/TopBar';
import WorkflowView from '../components/workflow/WorkflowView';
import CasesView from '../components/workflow/CasesView';
import { Skeleton } from '../components/ui/skeleton';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../components/ui/alert-dialog';
import { Plus, Trash2 } from 'lucide-react';
import { apiClient } from '../lib/api';

// Server returns:
//   { id, name, category, definition: { description, icon, steps, nodes, edges } }
// Hydrate that into the rich UI `Workflow` shape the rest of the app uses.
interface ServerWorkflow {
  id: string;
  name: string;
  category: string | null;
  definition: {
    description?: string;
    icon?: string;
    steps?: WorkflowStep[];
    nodes?: unknown[];
    edges?: unknown[];
  } | null;
}

function hydrate(w: ServerWorkflow): Workflow {
  const def = w.definition ?? {};
  return {
    id: w.id,
    name: w.name,
    category: w.category ?? '',
    description: def.description ?? '',
    icon: def.icon ?? '📋',
    steps: def.steps ?? [],
  };
}

function dehydrate(w: Workflow): ServerWorkflow['definition'] {
  return {
    description: w.description,
    icon: w.icon,
    steps: w.steps,
    nodes: [],
    edges: [],
  };
}

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

// Map server case → legacy UI `Case` (used by CasesView)
function hydrateCase(c: ServerCase): Case {
  let payload: Record<string, unknown> = {};
  try { payload = JSON.parse(c.payload || '{}'); } catch { /* ignore */ }
  const stepStatuses = (payload.stepStatuses as Case['stepStatuses']) ?? {};
  const notes = (payload.notes as Case['notes']) ?? undefined;
  const startedAt = (payload.startedAt as string) ?? c.createdAt;
  const uiStatus: Case['status'] =
    c.status === 'done' ? 'completed' :
    c.status === 'waiting_human' ? 'paused' :
    'active';
  return {
    id: c.id,
    workflowId: c.workflowId,
    name: c.title,
    status: uiStatus,
    currentStepId: c.currentStepId ?? '',
    startedAt,
    stepStatuses,
    notes,
  };
}

export default function Workflows() {
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();

  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [cases, setCases] = useState<Case[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedWorkflow, setSelectedWorkflow] = useState<Workflow | null>(null);
  const [activeTab, setActiveTab] = useState<'workflow' | 'cases'>('workflow');
  const [selectedCase, setSelectedCase] = useState<Case | null>(null);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Initial load
  const reload = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [wfData, caseData] = await Promise.all([
        apiClient.get<{ workflows: ServerWorkflow[] }>('/api/workflows'),
        apiClient.get<{ cases: ServerCase[] }>('/api/cases').catch(() => ({ cases: [] })),
      ]);
      const hydrated = wfData.workflows.map(hydrate);
      setWorkflows(hydrated);
      setCases(caseData.cases.map(hydrateCase));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setLoadError(msg);
      toast.error('Failed to load workflows', { description: msg });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { reload(); }, [reload]);

  // Sync URL → selection when workflows arrive or :id changes
  useEffect(() => {
    if (workflows.length === 0) {
      setSelectedWorkflow(null);
      return;
    }
    const target = id ? workflows.find((w) => w.id === id) : workflows[0];
    const next = target ?? workflows[0];
    if (!selectedWorkflow || selectedWorkflow.id !== next.id) {
      setSelectedWorkflow(next);
      setSelectedCase(null);
      setActiveTab('workflow');
    }
  }, [id, workflows, selectedWorkflow]);

  const handleSelect = useCallback(
    (w: Workflow) => {
      setSelectedWorkflow(w);
      setSelectedCase(null);
      setActiveTab('workflow');
      navigate(`/workflows/${w.id}`);
    },
    [navigate],
  );

  const handleWorkflowUpdate = useCallback(
    async (updated: Workflow) => {
      setWorkflows((prev) => prev.map((w) => (w.id === updated.id ? updated : w)));
      setSelectedWorkflow(updated);
      try {
        await apiClient.put(`/api/workflows/${updated.id}`, {
          name: updated.name,
          category: updated.category,
          definition: dehydrate(updated),
        });
        toast.success('Workflow saved');
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        toast.error('Failed to save workflow', { description: msg });
        // Reload to roll back optimistic state
        reload();
      }
    },
    [reload],
  );

  const handleCreate = useCallback(async () => {
    const name = window.prompt('New workflow name?');
    if (!name) return;
    try {
      const { workflow } = await apiClient.post<{ workflow: ServerWorkflow }>(
        '/api/workflows',
        {
          name,
          category: 'General',
          definition: { description: '', icon: '📋', steps: [], nodes: [], edges: [] },
        },
      );
      const hydrated = hydrate(workflow);
      setWorkflows((prev) => [hydrated, ...prev]);
      navigate(`/workflows/${hydrated.id}`);
      toast.success('Workflow created');
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error('Failed to create workflow', { description: msg });
    }
  }, [navigate]);

  const handleDelete = useCallback(async () => {
    if (!selectedWorkflow) return;
    setDeleting(true);
    try {
      await apiClient.delete(`/api/workflows/${selectedWorkflow.id}`);
      const remaining = workflows.filter((w) => w.id !== selectedWorkflow.id);
      setWorkflows(remaining);
      setConfirmDeleteOpen(false);
      toast.success('Workflow deleted');
      if (remaining.length > 0) {
        navigate(`/workflows/${remaining[0].id}`);
      } else {
        navigate('/workflows');
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error('Failed to delete workflow', { description: msg });
    } finally {
      setDeleting(false);
    }
  }, [selectedWorkflow, workflows, navigate]);

  // ---- States ----
  if (loading) {
    return (
      <div className="flex h-screen overflow-hidden bg-background text-foreground">
        <aside className="w-64 border-r p-4 space-y-3">
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

  if (workflows.length === 0 || !selectedWorkflow) {
    return (
      <div className="flex h-screen items-center justify-center bg-background text-foreground p-6">
        <Card className="max-w-md text-center">
          <CardHeader>
            <CardTitle>No workflows yet</CardTitle>
            <CardDescription>Create your first workflow to get started.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={handleCreate}>
              <Plus className="h-4 w-4 mr-2" /> Create workflow
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const workflowCases = cases.filter((c) => c.workflowId === selectedWorkflow.id);

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      <Sidebar workflows={workflows} selected={selectedWorkflow} onSelect={handleSelect} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar
          workflow={selectedWorkflow}
          caseCount={workflowCases.length}
          activeTab={activeTab}
          onTabChange={(t) => {
            setActiveTab(t);
            if (t === 'workflow') setSelectedCase(null);
          }}
        />
        <div className="flex items-center gap-2 px-4 py-2 border-b">
          <Button size="sm" variant="outline" onClick={handleCreate}>
            <Plus className="h-4 w-4 mr-1" /> New
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="text-destructive hover:text-destructive"
            onClick={() => setConfirmDeleteOpen(true)}
          >
            <Trash2 className="h-4 w-4 mr-1" /> Delete
          </Button>
        </div>
        <main className="flex-1 overflow-hidden bg-muted/30">
          {activeTab === 'workflow' ? (
            <WorkflowView
              workflow={selectedWorkflow}
              selectedCase={selectedCase}
              onWorkflowUpdate={handleWorkflowUpdate}
            />
          ) : (
            <CasesView
              cases={workflowCases}
              workflow={selectedWorkflow}
              selectedCase={selectedCase}
              onSelectCase={(c) => {
                setSelectedCase(c);
                setActiveTab('workflow');
              }}
            />
          )}
        </main>
      </div>

      <AlertDialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete workflow?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete &ldquo;{selectedWorkflow.name}&rdquo;. The server will
              refuse the delete if any cases still reference it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDelete();
              }}
              disabled={deleting}
            >
              {deleting ? 'Deleting…' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
