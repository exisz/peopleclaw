/**
 * PLANET-1385: Dialog to create a new table canvas element.
 */
import { useState } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';
import type { CanvasElement } from './canvasElements';
import { addStoredElement } from './canvasElements';

interface CreateTableDialogProps {
  open: boolean;
  onClose: () => void;
  onCreated: (element: CanvasElement) => void;
}

export function CreateTableDialog({ open, onClose, onCreated }: CreateTableDialogProps) {
  const [name, setName] = useState('');
  const [columns, setColumns] = useState<string[]>(['']);

  if (!open) return null;

  function addColumn() {
    setColumns([...columns, '']);
  }

  function removeColumn(index: number) {
    setColumns(columns.filter((_, i) => i !== index));
  }

  function updateColumn(index: number, value: string) {
    setColumns(columns.map((c, i) => i === index ? value : c));
  }

  function handleCreate() {
    if (!name.trim()) return;
    const element: CanvasElement = {
      id: `table-${Date.now()}`,
      name: name.trim(),
      type: 'table',
      status: 'active',
      updatedAt: new Date().toISOString(),
      columns: columns.filter(c => c.trim()),
      rows: [],
    };
    addStoredElement(element);
    onCreated(element);
    setName('');
    setColumns(['']);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md bg-[#1a1a1a] border border-white/[0.1] rounded-2xl shadow-2xl p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-base font-semibold text-white">新建表格</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-white/10 text-white/60">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Table name */}
        <div className="mb-4">
          <label className="block text-xs font-medium text-white/50 mb-1.5">表格名称</label>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="例如：产品库存"
            className="w-full bg-white/[0.05] border border-white/[0.12] rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-amber-500/50"
          />
        </div>

        {/* Columns */}
        <div className="mb-4">
          <label className="block text-xs font-medium text-white/50 mb-2">列名</label>
          <div className="space-y-2 max-h-[240px] overflow-y-auto">
            {columns.map((col, index) => (
              <div key={index} className="flex items-center gap-2">
                <input
                  value={col}
                  onChange={e => updateColumn(index, e.target.value)}
                  placeholder={`列 ${index + 1}`}
                  className="flex-1 bg-white/[0.05] border border-white/[0.12] rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-amber-500/50"
                />
                <button
                  onClick={() => removeColumn(index)}
                  className="p-1.5 rounded hover:bg-red-500/10 text-white/30 hover:text-red-400"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
          <button
            onClick={addColumn}
            className="mt-2 flex items-center gap-1 text-xs text-amber-400 hover:text-amber-300"
          >
            <Plus className="w-3 h-3" /> 添加列
          </button>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm text-white/60 hover:bg-white/[0.06]"
          >
            取消
          </button>
          <button
            onClick={handleCreate}
            disabled={!name.trim()}
            className="px-4 py-2 rounded-lg bg-amber-500 text-black text-sm font-medium hover:bg-amber-400 disabled:opacity-40 transition-colors"
          >
            创建
          </button>
        </div>
      </div>
    </div>
  );
}
