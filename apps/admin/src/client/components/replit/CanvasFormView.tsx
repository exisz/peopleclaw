/**
 * PLANET-1385: Canvas form renderer — renders a CanvasElement of type 'form'.
 */
import { useState } from 'react';
import { FileText, Upload, CheckCircle } from 'lucide-react';
import type { CanvasElement, FormField } from './canvasElements';

interface CanvasFormViewProps {
  element: CanvasElement;
}

function FormFieldInput({ field }: { field: FormField }) {
  const [value, setValue] = useState('');

  const baseClasses = "w-full bg-white/[0.05] border border-white/[0.12] rounded-lg px-3 py-2.5 text-sm text-white/90 placeholder:text-white/30 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/20 transition-all";

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
        <select
          value={value}
          onChange={e => setValue(e.target.value)}
          className={baseClasses}
        >
          <option value="" className="bg-[#1a1a1a]">选择...</option>
          {field.options?.map(opt => (
            <option key={opt} value={opt} className="bg-[#1a1a1a]">{opt}</option>
          ))}
        </select>
      );
    case 'file':
      return (
        <label className={`${baseClasses} flex items-center gap-2 cursor-pointer hover:border-amber-500/40`}>
          <Upload className="w-4 h-4 text-white/40" />
          <span className="text-white/40">{field.placeholder || '选择文件'}</span>
          <input type="file" className="hidden" />
        </label>
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

export function CanvasFormView({ element }: CanvasFormViewProps) {
  const [submitted, setSubmitted] = useState(false);

  if (submitted) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-6">
        <CheckCircle className="w-12 h-12 text-green-400 mb-4" />
        <h3 className="text-lg font-semibold text-white mb-2">已提交</h3>
        <p className="text-sm text-white/50">表单 "{element.name}" 已成功提交</p>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto p-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
          <FileText className="w-5 h-5 text-amber-400" />
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

      {/* Fields */}
      <div className="space-y-5">
        {element.fields?.map(field => (
          <div key={field.id}>
            <label className="block text-sm font-medium text-white/70 mb-1.5">
              {field.label}
              {field.required && <span className="text-amber-400 ml-1">*</span>}
            </label>
            <FormFieldInput field={field} />
          </div>
        ))}
      </div>

      {/* Submit */}
      <button
        onClick={() => setSubmitted(true)}
        className="mt-8 w-full py-3 rounded-xl bg-amber-500 text-black font-semibold text-sm hover:bg-amber-400 transition-colors"
      >
        提交
      </button>
    </div>
  );
}
