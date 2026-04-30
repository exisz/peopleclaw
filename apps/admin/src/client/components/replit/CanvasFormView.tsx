/**
 * PLANET-1385: Canvas form renderer — renders a Block of type 'form'.
 * Full field types, responsive layout, deep dark + amber accent.
 */
import { useState } from 'react';
import { FileText, Upload, CheckCircle, X } from 'lucide-react';
import { toast } from 'sonner';
import type { Block, FormField } from './canvasElements';
import { AI_FACESWAP_BLOCKS } from './canvasElements';

interface CanvasFormViewProps {
  block: Block;
}

function FormFieldInput({ field }: { field: FormField }) {
  const [value, setValue] = useState('');
  const [fileName, setFileName] = useState('');

  const baseClasses =
    'w-full bg-white/[0.05] border border-white/[0.12] rounded-lg px-3 py-2.5 text-sm text-white/90 placeholder:text-white/30 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/20 transition-all';

  switch (field.type) {
    case 'textarea':
      return (
        <textarea
          value={value}
          onChange={e => setValue(e.target.value)}
          placeholder={field.placeholder}
          className={`${baseClasses} min-h-[80px] resize-y`}
        />
      );
    case 'select':
      return (
        <select value={value} onChange={e => setValue(e.target.value)} className={baseClasses}>
          <option value="" className="bg-[#1a1a1a]">选择...</option>
          {field.options?.map(opt => (
            <option key={opt} value={opt} className="bg-[#1a1a1a]">{opt}</option>
          ))}
        </select>
      );
    case 'file':
      return (
        <div
          className={`${baseClasses} flex items-center gap-2 cursor-pointer hover:border-amber-500/40 relative`}
          onClick={() => {
            setFileName(`file_${Date.now().toString(36)}.png`);
          }}
        >
          <Upload className="w-4 h-4 text-white/40" />
          {fileName ? (
            <span className="text-white/70 flex items-center gap-2">
              {fileName}
              <X
                className="w-3 h-3 text-white/40 hover:text-white"
                onClick={e => { e.stopPropagation(); setFileName(''); }}
              />
            </span>
          ) : (
            <span className="text-white/40">{field.placeholder || '点击选择文件'}</span>
          )}
        </div>
      );
    case 'number':
      return (
        <input
          type="number"
          value={value}
          onChange={e => setValue(e.target.value)}
          placeholder={field.placeholder}
          className={baseClasses}
        />
      );
    case 'email':
      return (
        <input
          type="email"
          value={value}
          onChange={e => setValue(e.target.value)}
          placeholder={field.placeholder || '输入邮箱地址'}
          className={baseClasses}
        />
      );
    case 'url':
      return (
        <input
          type="url"
          value={value}
          onChange={e => setValue(e.target.value)}
          placeholder={field.placeholder || 'https://...'}
          className={baseClasses}
        />
      );
    default:
      return (
        <input
          type="text"
          value={value}
          onChange={e => setValue(e.target.value)}
          placeholder={field.placeholder}
          className={baseClasses}
        />
      );
  }
}

export function CanvasFormView({ block }: CanvasFormViewProps) {
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = () => {
    setSubmitted(true);
    if (block.submitAction) {
      const target = AI_FACESWAP_BLOCKS.find(b => b.id === block.submitAction?.targetBlockId);
      toast.success(`已提交到 ${target?.name || block.submitAction.targetBlockId}`);
    } else {
      toast.success('表单已提交');
    }
  };

  if (submitted) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-6">
        <CheckCircle className="w-12 h-12 text-green-400 mb-4" />
        <h3 className="text-lg font-semibold text-white mb-2">已提交</h3>
        <p className="text-sm text-white/50">表单 &ldquo;{block.name}&rdquo; 已成功提交</p>
        <button
          onClick={() => setSubmitted(false)}
          className="mt-4 px-4 py-2 rounded-lg bg-white/[0.06] border border-white/[0.1] text-sm text-white/70 hover:bg-white/[0.1] transition-colors"
        >
          重新填写
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
          <FileText className="w-5 h-5 text-amber-400" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-white">{block.name}</h2>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-500/10 text-green-400 border border-green-500/20">
              📋 Form
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
              {block.status}
            </span>
          </div>
        </div>
      </div>

      {/* Fields — responsive grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {block.fields?.map(field => {
          const isWide = field.type === 'textarea' || field.type === 'file';
          return (
            <div key={field.id} className={isWide ? 'md:col-span-2' : ''}>
              <label className="block text-sm font-medium text-white/70 mb-1.5">
                {field.label}
                {field.required && <span className="text-amber-400 ml-1">*</span>}
              </label>
              <FormFieldInput field={field} />
            </div>
          );
        })}
      </div>

      {/* Submit */}
      <button
        onClick={handleSubmit}
        className="mt-8 w-full py-3 rounded-xl bg-amber-500 text-black font-semibold text-sm hover:bg-amber-400 transition-colors"
      >
        提交
      </button>

      {block.submitAction && (
        <p className="text-center text-[11px] text-white/30 mt-2">
          提交后将触发 → {AI_FACESWAP_BLOCKS.find(b => b.id === block.submitAction?.targetBlockId)?.name || block.submitAction.targetBlockId}
        </p>
      )}
    </div>
  );
}
