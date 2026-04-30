/**
 * PLANET-1385: Bottom-up drawer showing workflows + forms + tables.
 * Positioned absolute within the Canvas panel, slides up from bottom.
 */
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, ChevronDown, Loader2, Eye, Plus } from 'lucide-react';
import { useCanvas } from '../CanvasContext';
import type { CanvasElement } from './canvasElements';
import { PRESET_ELEMENTS, getStoredElements } from './canvasElements';
import { CanvasFormView } from './CanvasFormView';
import { CanvasTableView } from './CanvasTableView';

interface ComponentsDrawerProps {
  open: boolean;
  onClose: () => void;
  onOpenTemplateLibrary: () => void;
}

const TYPE_LABELS: Record<string, string> = {
  workflow: '工作流',
  form: '表单',
  table: '表格',
};

export function ComponentsDrawer({ open, onClose, onOpenTemplateLibrary }: ComponentsDrawerProps) {
  const { setCanvas } = useCanvas();
  const navigate = useNavigate();
  const [elements, setElements] = useState<CanvasElement[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setLoading(true);
      fetch('/api/workflows')
        .then(r => r.ok ? r.json() : { workflows: [] })
        .then(data => {
          const list = Array.isArray(data) ? data : (data?.workflows || []);
          const workflowElements: CanvasElement[] = list.map((wf: { id: string; name: string; status?: string; updatedAt?: string }) => ({
            ...wf,
            type: 'workflow' as const,
          }));
          const stored = getStoredElements();
          setElements([...workflowElements, ...PRESET_ELEMENTS, ...stored]);
        })
        .catch(() => setElements([...PRESET_ELEMENTS, ...getStoredElements()]))
        .finally(() => setLoading(false));
    }
  }, [open]);

  const handleView = (el: CanvasElement) => {
    if (el.type === 'workflow') {
      navigate(`/app/workflow/${el.id}`);
      onClose();
      return;
    }
    if (el.type === 'form') {
      setCanvas(<CanvasFormView element={el} />, el.name);
    } else if (el.type === 'table') {
      setCanvas(<CanvasTableView element={el} />, el.name);
    } else {
      setCanvas(
        <div className="p-6">
          <h2 className="text-lg font-semibold text-white mb-2">{el.name}</h2>
          <p className="text-sm text-white/50">ID: {el.id}</p>
          {el.status && <p className="text-sm text-white/50 mt-1">状态: {el.status}</p>}
        </div>,
        el.name
      );
    }
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
        ) : elements.length === 0 ? (
          <div className="flex items-center justify-center py-8">
            <p className="text-xs text-white/30">暂无组件</p>
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
              {elements.map(el => (
                <tr key={el.id} className="border-b border-white/[0.04] hover:bg-white/[0.03] transition-colors">
                  <td className="px-4 py-2.5 text-white/80 truncate max-w-[200px]">{el.name}</td>
                  <td className="px-4 py-2.5 text-white/50">{TYPE_LABELS[el.type] || el.type}</td>
                  <td className="px-4 py-2.5">
                    <span className="inline-block text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                      {el.status || 'active'}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-white/40 text-xs">
                    {el.updatedAt ? new Date(el.updatedAt).toLocaleDateString('zh-CN') : '-'}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <button
                      onClick={() => handleView(el)}
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
