/**
 * PLANET-1385: Canvas table renderer — full CRUD table with fixed header,
 * status badges, image placeholders, actions column, and bottom toolbar.
 */
import { Table2, Plus, Eye, Trash2, Link2 } from 'lucide-react';
import { toast } from 'sonner';
import type { Block, TableColumn } from './canvasElements';
import { AI_FACESWAP_BLOCKS } from './canvasElements';

interface CanvasTableViewProps {
  block: Block;
}

function StatusBadge({ value }: { value: string }) {
  const colors: Record<string, string> = {
    '完成': 'bg-green-500/15 text-green-400 border-green-500/25',
    '处理中': 'bg-blue-500/15 text-blue-400 border-blue-500/25',
    '排队中': 'bg-gray-500/15 text-gray-400 border-gray-500/25',
  };
  const cls = colors[value] || 'bg-white/[0.06] text-white/60 border-white/[0.1]';
  return (
    <span className={`inline-block text-[10px] px-2 py-0.5 rounded-full border ${cls}`}>
      {value}
    </span>
  );
}

function CellContent({ column, value }: { column: TableColumn; value: any }) {
  switch (column.type) {
    case 'status':
      return <StatusBadge value={String(value || '-')} />;
    case 'image':
      return (
        <div className="w-8 h-8 rounded bg-white/[0.06] border border-white/[0.1] flex items-center justify-center text-xs">
          {value || '—'}
        </div>
      );
    case 'date':
      return <span className="text-white/50 text-xs">{value || '-'}</span>;
    case 'actions':
      return (
        <div className="flex items-center gap-1">
          <button
            onClick={() => toast.info('查看详情 — 功能开发中')}
            className="p-1 rounded hover:bg-white/[0.08] text-white/50 hover:text-white transition-colors"
          >
            <Eye className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => toast.info('删除 — 功能开发中')}
            className="p-1 rounded hover:bg-red-500/10 text-white/50 hover:text-red-400 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      );
    default:
      return <span className="text-white/70">{value != null ? String(value) : '-'}</span>;
  }
}

export function CanvasTableView({ block }: CanvasTableViewProps) {
  const columns = block.columns || [];
  const rows = block.rows || [];
  const sourceBlock = block.sourceBlockId
    ? AI_FACESWAP_BLOCKS.find(b => b.id === block.sourceBlockId)
    : null;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 pb-3 shrink-0">
        <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
          <Table2 className="w-5 h-5 text-amber-400" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-white">{block.name}</h2>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20">
              📊 Table
            </span>
            {sourceBlock && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/[0.05] text-white/40 border border-white/[0.08] flex items-center gap-1">
                <Link2 className="w-2.5 h-2.5" />
                数据来源: {sourceBlock.name}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Table */}
      {columns.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
          <Table2 className="w-8 h-8 text-white/20 mb-3" />
          <p className="text-sm text-white/40">暂无数据列</p>
        </div>
      ) : (
        <div className="flex-1 overflow-auto mx-4 rounded-lg border border-white/[0.08]">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-[#1a1a1a] z-10">
              <tr className="border-b border-white/[0.08]">
                {columns.map(col => (
                  <th
                    key={col.id}
                    className="text-left px-4 py-3 text-xs font-medium text-white/50"
                    style={col.width ? { width: col.width } : undefined}
                  >
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={columns.length} className="px-4 py-8 text-center text-white/30 text-xs">
                    暂无数据
                  </td>
                </tr>
              ) : (
                rows.map((row, i) => (
                  <tr key={i} className="border-b border-white/[0.04] hover:bg-white/[0.03]">
                    {columns.map(col => (
                      <td key={col.id} className="px-4 py-2.5">
                        <CellContent column={col} value={row[col.id]} />
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Bottom toolbar */}
      <div className="flex items-center justify-between px-4 py-3 border-t border-white/[0.06] shrink-0">
        <span className="text-xs text-white/40">共 {rows.length} 条记录</span>
        <button
          onClick={() => toast.info('新增 — 功能开发中')}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-medium hover:bg-amber-500/20 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          新增
        </button>
      </div>
    </div>
  );
}
