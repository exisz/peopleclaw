/**
 * PLANET-1385: Bottom-up drawer showing workflows as a table.
 * Positioned absolute within the Canvas panel, slides up from bottom.
 */
import { useState, useEffect } from 'react';
import { X, ChevronDown, Loader2, Eye, Plus } from 'lucide-react';
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
  onOpenTemplateLibrary: () => void;
}

export function ComponentsDrawer({ open, onClose, onOpenTemplateLibrary }: ComponentsDrawerProps) {
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

  const handleView = (wf: WorkflowItem) => {
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
    <div
      className="absolute bottom-0 left-0 right-0 z-30 flex flex-col bg-[#1a1a1a] border-t border-white/10 animate-in slide-in-from-bottom duration-200"
      style={{ maxHeight: '60%' }}
    >
      {/* Header */}
      <div className="h-10 flex items-center justify-between px-4 border-b border-white/[0.08] shrink-0">
        <span className="text-sm font-medium text-white/80">已有组件</span>
        <div className="flex items-center gap-1">
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-white/10 text-white/60 hover:text-white transition-colors"
            title="收起"
          >
            <ChevronDown className="w-4 h-4" />
          </button>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-white/10 text-white/60 hover:text-white transition-colors"
            title="关闭"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="px-4 py-2 border-b border-white/[0.06] shrink-0">
        <button
          onClick={onOpenTemplateLibrary}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-medium hover:bg-amber-500/20 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          从模板添加
        </button>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-4 h-4 text-white/40 animate-spin" />
          </div>
        ) : workflows.length === 0 ? (
          <div className="flex items-center justify-center py-8">
            <p className="text-xs text-white/30">暂无工作流</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-[#1a1a1a]">
              <tr className="border-b border-white/[0.08]">
                <th className="text-left px-4 py-2 text-xs font-medium text-white/40">名称</th>
                <th className="text-left px-4 py-2 text-xs font-medium text-white/40">类型</th>
                <th className="text-left px-4 py-2 text-xs font-medium text-white/40">状态</th>
                <th className="text-left px-4 py-2 text-xs font-medium text-white/40">更新时间</th>
                <th className="text-right px-4 py-2 text-xs font-medium text-white/40">操作</th>
              </tr>
            </thead>
            <tbody>
              {workflows.map(wf => (
                <tr key={wf.id} className="border-b border-white/[0.04] hover:bg-white/[0.03] transition-colors">
                  <td className="px-4 py-2.5 text-white/80 truncate max-w-[200px]">{wf.name}</td>
                  <td className="px-4 py-2.5 text-white/50">工作流</td>
                  <td className="px-4 py-2.5">
                    <span className="inline-block text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                      {wf.status || 'active'}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-white/40 text-xs">
                    {wf.updatedAt ? new Date(wf.updatedAt).toLocaleDateString('zh-CN') : '-'}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <button
                      onClick={() => handleView(wf)}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs text-amber-400 hover:bg-amber-500/10 transition-colors"
                    >
                      <Eye className="w-3 h-3" />
                      查看
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
