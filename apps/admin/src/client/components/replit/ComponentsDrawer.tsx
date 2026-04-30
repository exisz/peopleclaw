/**
 * PLANET-1385: Bottom-up drawer showing all blocks (flow + form + table).
 * Data sources: API workflows → flow blocks, AI_FACESWAP_BLOCKS presets, localStorage blocks.
 */
import { useState, useEffect } from 'react';
import { X, ChevronDown, Loader2, Eye, Plus } from 'lucide-react';
import { useCanvas } from '../CanvasContext';
import type { Block } from './canvasElements';
import { AI_FACESWAP_BLOCKS, getStoredBlocks } from './canvasElements';
import { CanvasFormView } from './CanvasFormView';
import { CanvasTableView } from './CanvasTableView';
import { CanvasFlowView } from './CanvasFlowView';

interface ComponentsDrawerProps {
  open: boolean;
  onClose: () => void;
  onOpenTemplateLibrary: () => void;
}

const TYPE_BADGE: Record<string, { label: string; cls: string }> = {
  flow: { label: '🔄 Flow', cls: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
  form: { label: '📋 Form', cls: 'bg-green-500/10 text-green-400 border-green-500/20' },
  table: { label: '📊 Table', cls: 'bg-purple-500/10 text-purple-400 border-purple-500/20' },
};

export function ComponentsDrawer({ open, onClose, onOpenTemplateLibrary }: ComponentsDrawerProps) {
  const { setCanvas } = useCanvas();
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setLoading(true);
      fetch('/api/workflows')
        .then(r => r.ok ? r.json() : { workflows: [] })
        .then(data => {
          const list = Array.isArray(data) ? data : (data?.workflows || []);
          const flowBlocks: Block[] = list.map((wf: { id: string; name: string; status?: string; updatedAt?: string }) => ({
            id: `wf-${wf.id}`,
            name: wf.name,
            type: 'flow' as const,
            status: (wf.status as Block['status']) || 'active',
            createdAt: wf.updatedAt || new Date().toISOString(),
            updatedAt: wf.updatedAt || new Date().toISOString(),
            workflowId: wf.id,
            input: { schema: {} },
            output: { schema: {} },
          }));
          const stored = getStoredBlocks();
          setBlocks([...flowBlocks, ...AI_FACESWAP_BLOCKS, ...stored]);
        })
        .catch(() => setBlocks([...AI_FACESWAP_BLOCKS, ...getStoredBlocks()]))
        .finally(() => setLoading(false));
    }
  }, [open]);

  const handleView = (block: Block) => {
    switch (block.type) {
      case 'form':
        setCanvas(<CanvasFormView block={block} />, block.name);
        break;
      case 'table':
        setCanvas(<CanvasTableView block={block} />, block.name);
        break;
      case 'flow':
        setCanvas(<CanvasFlowView block={block} />, block.name);
        break;
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
        <span className="text-sm font-medium text-white/80">所有块 (Blocks)</span>
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
        ) : blocks.length === 0 ? (
          <div className="flex items-center justify-center py-8">
            <p className="text-xs text-white/30">暂无块</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-[#1a1a1a]">
              <tr className="border-b border-white/[0.08]">
                <th className="text-left px-4 py-2 text-xs font-medium text-white/40">名称</th>
                <th className="text-left px-4 py-2 text-xs font-medium text-white/40">类型</th>
                <th className="text-left px-4 py-2 text-xs font-medium text-white/40">关联</th>
                <th className="text-left px-4 py-2 text-xs font-medium text-white/40">状态</th>
                <th className="text-right px-4 py-2 text-xs font-medium text-white/40">操作</th>
              </tr>
            </thead>
            <tbody>
              {blocks.map(block => {
                const badge = TYPE_BADGE[block.type];
                const relation = block.workflowId || block.sourceBlockId || block.submitAction?.targetBlockId || '-';
                return (
                  <tr key={block.id} className="border-b border-white/[0.04] hover:bg-white/[0.03] transition-colors">
                    <td className="px-4 py-2.5 text-white/80 truncate max-w-[200px]">{block.name}</td>
                    <td className="px-4 py-2.5">
                      <span className={`inline-block text-[10px] px-2 py-0.5 rounded-full border ${badge.cls}`}>
                        {badge.label}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-white/40 text-xs truncate max-w-[120px]">{relation}</td>
                    <td className="px-4 py-2.5">
                      <span className="inline-block text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                        {block.status}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <button
                        onClick={() => handleView(block)}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs text-amber-400 hover:bg-amber-500/10 transition-colors"
                      >
                        <Eye className="w-3 h-3" />
                        查看
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
