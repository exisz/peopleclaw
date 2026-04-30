/**
 * PLANET-1385: Dialog to create a new form block.
 */
import { useState } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';
import type { Block, FormField } from './canvasElements';
import { addStoredBlock } from './canvasElements';

interface CreateFormDialogProps {
  open: boolean;
  onClose: () => void;
  onCreated: (block: Block) => void;
}

export function CreateFormDialog({ open, onClose, onCreated }: CreateFormDialogProps) {
  const [name, setName] = useState('');
  const [fields, setFields] = useState<FormField[]>([
    { id: `f-${Date.now()}`, label: '', type: 'text' },
  ]);

  if (!open) return null;

  function addField() {
    setFields([...fields, { id: `f-${Date.now()}-${fields.length}`, label: '', type: 'text' }]);
  }

  function removeField(index: number) {
    setFields(fields.filter((_, i) => i !== index));
  }

  function updateField(index: number, updates: Partial<FormField>) {
    setFields(fields.map((f, i) => i === index ? { ...f, ...updates } : f));
  }

  function handleCreate() {
    if (!name.trim()) return;
    const block: Block = {
      id: `block-form-${Date.now()}`,
      name: name.trim(),
      type: 'form',
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      fields: fields.filter(f => f.label.trim()),
    };
    addStoredBlock(block);
    onCreated(block);
    setName('');
    setFields([{ id: `f-${Date.now()}`, label: '', type: 'text' }]);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md bg-[#1a1a1a] border border-white/[0.1] rounded-2xl shadow-2xl p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-base font-semibold text-white">新建表单</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-white/10 text-white/60">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form name */}
        <div className="mb-4">
          <label className="block text-xs font-medium text-white/50 mb-1.5">表单名称</label>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="例如：客户信息收集"
            className="w-full bg-white/[0.05] border border-white/[0.12] rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-amber-500/50"
          />
        </div>

        {/* Fields */}
        <div className="mb-4">
          <label className="block text-xs font-medium text-white/50 mb-2">字段</label>
          <div className="space-y-2 max-h-[240px] overflow-y-auto">
            {fields.map((field, index) => (
              <div key={field.id} className="flex items-center gap-2">
                <input
                  value={field.label}
                  onChange={e => updateField(index, { label: e.target.value })}
                  placeholder="字段名"
                  className="flex-1 bg-white/[0.05] border border-white/[0.12] rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-amber-500/50"
                />
                <select
                  value={field.type}
                  onChange={e => updateField(index, { type: e.target.value as FormField['type'] })}
                  className="bg-white/[0.05] border border-white/[0.12] rounded-lg px-2 py-2 text-xs text-white/70 focus:outline-none"
                >
                  <option value="text">文本</option>
                  <option value="textarea">多行文本</option>
                  <option value="number">数字</option>
                  <option value="select">下拉</option>
                  <option value="file">文件</option>
                  <option value="email">邮箱</option>
                  <option value="url">URL</option>
                </select>
                <button
                  onClick={() => removeField(index)}
                  className="p-1.5 rounded hover:bg-red-500/10 text-white/30 hover:text-red-400"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
          <button
            onClick={addField}
            className="mt-2 flex items-center gap-1 text-xs text-amber-400 hover:text-amber-300"
          >
            <Plus className="w-3 h-3" /> 添加字段
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
