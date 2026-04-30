/**
 * PLANET-1385: Right-side components/resources drawer.
 * Lists existing workflows + placeholder categories.
 * Clicking a component pushes it to the Canvas via useCanvas().
 */
import { useState, useEffect } from 'react';
import { X, Workflow, FileText, Table2, Box, Code2, Loader2 } from 'lucide-react';
import { useCanvas } from '../CanvasContext';

interface WorkflowItem {
  id: string;
  name: string;
  status?: string;
  updatedAt?: string;
}

interface ComponentsDrawerProps {
  open: boolean;
  onClose: () => void;
}

export function ComponentsDrawer({ open, onClose }: ComponentsDrawerProps) {
  const { setCanvas } = useCanvas();
  const [workflows, setWorkflows] = useState<WorkflowItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setLoading(true);
      fetch('/api/workflows')
        .then(r => r.ok ? r.json() : [])
        .then(data => setWorkflows(Array.isArray(data) ? data : []))
        .catch(() => setWorkflows([]))
        .finally(() => setLoading(false));
    }
  }, [open]);

  const handleWorkflowClick = (wf: WorkflowItem) => {
    setCanvas(
      <div className="p-6">
        <h2 className="text-lg font-semibold text-white mb-2">{wf.name}</h2>
        <p className="text-sm text-white/50">工作流 ID: {wf.id}</p>
        {wf.status && <p className="text-sm text-white/50 mt-1">状态: {wf.status}</p>}
      </div>,
      wf.name
    );
    onClose();
  };

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed top-0 right-0 h-full w-[320px] bg-[#1a1a1a] border-l border-white/10 z-50 flex flex-col animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="h-12 flex items-center justify-between px-4 border-b border-white/10 shrink-0">
          <span className="text-sm font-medium text-white">已有组件</span>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-white/10 text-white/60 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-3 space-y-4">
          {/* Workflows */}
          <Section
            icon={<Workflow className="w-4 h-4 text-amber-400" />}
            title="工作流 Workflows"
          >
            {loading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="w-4 h-4 text-white/40 animate-spin" />
              </div>
            ) : workflows.length > 0 ? (
              workflows.map(wf => (
                <button
                  key={wf.id}
                  onClick={() => handleWorkflowClick(wf)}
                  className="w-full text-left px-3 py-2 rounded-lg hover:bg-white/5 transition-colors group"
                >
                  <p className="text-sm text-white/80 group-hover:text-white truncate">{wf.name}</p>
                  {wf.status && (
                    <p className="text-xs text-white/30 mt-0.5">{wf.status}</p>
                  )}
                </button>
              ))
            ) : (
              <p className="text-xs text-white/30 px-3 py-2">暂无工作流</p>
            )}
          </Section>

          {/* Placeholder categories */}
          <Section icon={<FileText className="w-4 h-4 text-blue-400" />} title="表单 Forms">
            <p className="text-xs text-white/30 px-3 py-2">即将推出</p>
          </Section>

          <Section icon={<Table2 className="w-4 h-4 text-green-400" />} title="表格 Tables">
            <p className="text-xs text-white/30 px-3 py-2">即将推出</p>
          </Section>

          <Section icon={<Box className="w-4 h-4 text-purple-400" />} title="模块 Modules">
            <p className="text-xs text-white/30 px-3 py-2">即将推出</p>
          </Section>

          <Section icon={<Code2 className="w-4 h-4 text-rose-400" />} title="代码块 Code">
            <p className="text-xs text-white/30 px-3 py-2">即将推出</p>
          </Section>
        </div>
      </div>
    </>
  );
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-2 px-2 mb-1">
        {icon}
        <span className="text-xs font-medium text-white/60 uppercase tracking-wide">{title}</span>
      </div>
      {children}
    </div>
  );
}
