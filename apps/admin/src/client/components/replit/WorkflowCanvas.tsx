/**
 * PLANET-1385: WorkflowCanvas — renders WorkflowEditor inside the Canvas panel.
 * Extracted from Workflows.tsx page: loads workflow by ID, provides save/delete.
 */
import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Loader2, Trash2 } from 'lucide-react';
import type { Workflow, WorkflowStep } from '../../types';
import type { StepTemplate } from '../workflow/Sidebar';
import WorkflowEditor from '../workflow/WorkflowEditor';
import { apiClient } from '../../lib/api';
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

interface ServerWorkflow {
  id: string;
  name: string;
  category: string | null;
  isSystem?: boolean;
  definition: {
    description?: string;
    icon?: string;
    steps?: WorkflowStep[];
    nodes?: Array<{ id: string; position?: { x: number; y: number }; requiredFields?: string[] }>;
    edges?: unknown[];
  } | null;
}

function hydrate(w: ServerWorkflow): Workflow {
  const def = w.definition ?? {};
  const posMap = new Map<string, { x: number; y: number }>();
  const reqMap = new Map<string, string[]>();
  for (const n of def.nodes ?? []) {
    if (n?.id && n.position) posMap.set(n.id, n.position);
    if (n?.id && Array.isArray(n.requiredFields)) reqMap.set(n.id, n.requiredFields);
  }
  const steps = (def.steps ?? []).map((s) => ({
    ...s,
    position: s.position ?? posMap.get(s.id),
    requiredFields: s.requiredFields ?? reqMap.get(s.id),
  }));
  return {
    id: w.id,
    name: w.name,
    category: w.category ?? '',
    description: def.description ?? '',
    icon: def.icon ?? '📋',
    steps,
    isSystem: w.isSystem ?? false,
  };
}

export function WorkflowCanvas() {
  const navigate = useNavigate();
  const { id: workflowId, caseId } = useParams<{ id?: string; caseId?: string }>();

  const [workflow, setWorkflow] = useState<Workflow | null>(null);
  const [templates, setTemplates] = useState<StepTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  const reload = useCallback(async () => {
    if (!workflowId) return;
    setLoading(true);
    setError(null);
    try {
      const [wfData, tplData] = await Promise.all([
        apiClient.get<{ workflows: ServerWorkflow[] }>('/api/workflows'),
        apiClient.get<{ templates: StepTemplate[] }>('/api/step-templates').catch(() => ({ templates: [] as StepTemplate[] })),
      ]);
      const all = wfData.workflows.map(hydrate);
      const target = all.find(w => w.id === workflowId);
      if (target) {
        setWorkflow(target);
      } else {
        setError('工作流不存在');
      }
      setTemplates(tplData.templates);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      toast.error('加载工作流失败', { description: msg });
    } finally {
      setLoading(false);
    }
  }, [workflowId]);

  useEffect(() => { reload(); }, [reload]);

  const handleDelete = async () => {
    if (!workflow) return;
    try {
      await apiClient.delete(`/api/workflows/${workflow.id}`);
      toast.success('工作流已删除');
      navigate('/app');
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error('删除失败', { description: msg });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-5 h-5 text-amber-500/60 animate-spin" />
      </div>
    );
  }

  if (error || !workflow) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-6">
        <p className="text-sm text-white/50">{error || '工作流不存在'}</p>
        <button
          onClick={() => navigate('/app')}
          className="mt-3 text-xs text-amber-400 hover:underline"
        >
          返回首页
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full w-full">
      {/* Toolbar */}
      <div className="h-10 flex items-center justify-between px-4 border-b border-white/[0.08] shrink-0 bg-[#141414]">
        <span className="text-sm font-medium text-white/80 truncate">{workflow.icon} {workflow.name}</span>
        <button
          onClick={() => setDeleteConfirmOpen(true)}
          className="p-1.5 rounded-lg hover:bg-red-500/10 text-white/40 hover:text-red-400 transition-colors"
          title="删除工作流"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* Editor */}
      <div className="flex-1 min-h-0">
        <WorkflowEditor
          workflow={workflow}
          selectedCaseId={caseId || null}
          templates={templates}
          onSaved={reload}
        />
      </div>

      {/* Delete Confirm */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除工作流「{workflow.name}」吗？此操作无法撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
