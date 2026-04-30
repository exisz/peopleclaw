/**
 * PLANET-1385: Create Flow Dialog — create a new flow block with input/output ports.
 */
import { useState } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';
import type { Block, BlockPort } from './canvasElements';
import { addStoredBlock } from './canvasElements';

interface CreateFlowDialogProps {
  open: boolean;
  onClose: () => void;
  onCreated: (block: Block) => void;
}

interface PortField {
  name: string;
  type: 'string' | 'number' | 'file' | 'object';
}

export function CreateFlowDialog({ open, onClose, onCreated }: CreateFlowDialogProps) {
  const [name, setName] = useState('');
  const [inputFields, setInputFields] = useState<PortField[]>([{ name: '', type: 'string' }]);
  const [outputFields, setOutputFields] = useState<PortField[]>([{ name: '', type: 'string' }]);

  if (!open) return null;

  const addField = (list: PortField[], setter: (v: PortField[]) => void) => {
    setter([...list, { name: '', type: 'string' }]);
  };

  const removeField = (list: PortField[], setter: (v: PortField[]) => void, idx: number) => {
    setter(list.filter((_, i) => i !== idx));
  };

  const updateField = (list: PortField[], setter: (v: PortField[]) => void, idx: number, field: Partial<PortField>) => {
    const updated = [...list];
    updated[idx] = { ...updated[idx], ...field };
    setter(updated);
  };

  const fieldsToSchema = (fields: PortField[]): BlockPort['schema'] => {
    const schema: BlockPort['schema'] = {};
    for (const f of fields) {
      if (f.name.trim()) {
        schema[f.name.trim()] = f.type;
      }
    }
    return schema;
  };

  const handleCreate = () => {
    if (!name.trim()) return;
    const block: Block = {
      id: `block-flow-${Date.now()}`,
      name: name.trim(),
      type: 'flow',
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      input: { schema: fieldsToSchema(inputFields) },
      output: { schema: fieldsToSchema(outputFields) },
    };
    addStoredBlock(block);
    onCreated(block);
    onClose();
    setName('');
    setInputFields([{ name: '', type: 'string' }]);
    setOutputFields([{ name: '', type: 'string' }]);
  };

  const renderPortFields = (
    title: string,
    fields: PortField[],
    setter: (v: PortField[]) => void
  ) => (
    <div>
      <label className="block text-xs font-medium text-white/60 mb-2">{title}</label>
      <div className="space-y-2">
        {fields.map((f, i) => (
          <div key={i} className="flex items-center gap-2">
            <input
              value={f.name}
              onChange={e => updateField(fields, setter, i, { name: e.target.value })}
              placeholder="字段名"
              className="flex-1 bg-white/[0.05] border border-white/[0.12] rounded-lg px-3 py-2 text-sm text-white/90 placeholder:text-white/30 focus:outline-none focus:border-amber-500/50"
            />
            <select
              value={f.type}
              onChange={e => updateField(fields, setter, i, { type: e.target.value as PortField['type'] })}
              className="bg-white/[0.05] border border-white/[0.12] rounded-lg px-2 py-2 text-sm text-white/90 focus:outline-none focus:border-amber-500/50"
            >
              <option value="string" className="bg-[#1a1a1a]">string</option>
              <option value="number" className="bg-[#1a1a1a]">number</option>
              <option value="file" className="bg-[#1a1a1a]">file</option>
              <option value="object" className="bg-[#1a1a1a]">object</option>
            </select>
            <button
              onClick={() => removeField(fields, setter, i)}
              className="p-1.5 rounded hover:bg-red-500/10 text-white/40 hover:text-red-400 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
      <button
        onClick={() => addField(fields, setter)}
        className="mt-2 flex items-center gap-1 text-xs text-amber-400 hover:text-amber-300 transition-colors"
      >
        <Plus className="w-3 h-3" /> 添加字段
      </button>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md bg-[#1a1a1a] border border-white/[0.1] rounded-2xl p-6 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-base font-semibold text-white">新建 Flow 块</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-white/[0.08] text-white/50 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Name */}
        <div className="mb-5">
          <label className="block text-xs font-medium text-white/60 mb-1.5">名称</label>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="例如: 图片处理流程"
            className="w-full bg-white/[0.05] border border-white/[0.12] rounded-lg px-3 py-2.5 text-sm text-white/90 placeholder:text-white/30 focus:outline-none focus:border-amber-500/50"
          />
        </div>

        {/* Input ports */}
        <div className="mb-5">
          {renderPortFields('输入端口', inputFields, setInputFields)}
        </div>

        {/* Output ports */}
        <div className="mb-6">
          {renderPortFields('输出端口', outputFields, setOutputFields)}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-white/[0.1] text-sm text-white/60 hover:bg-white/[0.05] transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleCreate}
            disabled={!name.trim()}
            className="flex-1 py-2.5 rounded-xl bg-amber-500 text-black font-semibold text-sm hover:bg-amber-400 disabled:opacity-40 transition-colors"
          >
            创建
          </button>
        </div>
      </div>
    </div>
  );
}
