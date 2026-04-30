/**
 * PLANET-1385: Canvas table renderer — renders a CanvasElement of type 'table'.
 */
import { Table2 } from 'lucide-react';
import type { CanvasElement } from './canvasElements';

interface CanvasTableViewProps {
  element: CanvasElement;
}

export function CanvasTableView({ element }: CanvasTableViewProps) {
  const columns = element.columns || [];
  const rows = element.rows || [];

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
          <Table2 className="w-5 h-5 text-amber-400" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-white">{element.name}</h2>
          {element.status && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
              {element.status}
            </span>
          )}
        </div>
      </div>

      {/* Table */}
      {columns.length === 0 ? (
        <div className="text-center py-12">
          <Table2 className="w-8 h-8 text-white/20 mx-auto mb-3" />
          <p className="text-sm text-white/40">暂无数据列</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-white/[0.08]">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-white/[0.04] border-b border-white/[0.08]">
                {columns.map(col => (
                  <th key={col} className="text-left px-4 py-3 text-xs font-medium text-white/50">
                    {col}
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
                      <td key={col} className="px-4 py-2.5 text-white/70">
                        {row[col] || '-'}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
