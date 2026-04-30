/**
 * PLANET-1385: Dynamic Form — generative UI component.
 * Clean form rendered by the AI agent for data collection.
 */
import { useState } from 'react';
import { Button } from '../ui/button';

interface FormField {
  name: string;
  label: string;
  type: string; // text|number|textarea|select|file
  required?: boolean;
  options?: string[];
}

interface DynamicFormProps {
  title: string;
  fields: FormField[];
  onSubmit?: (data: Record<string, any>) => void;
}

export function DynamicForm({ title, fields, onSubmit }: DynamicFormProps) {
  const [values, setValues] = useState<Record<string, any>>({});
  const [submitted, setSubmitted] = useState(false);

  const handleChange = (name: string, value: any) => {
    setValues((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    onSubmit?.(values);
  };

  if (submitted) {
    return (
      <div className="p-6 h-full flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-3">✅</div>
          <h3 className="text-lg font-semibold">Form Submitted</h3>
          <p className="text-sm text-muted-foreground mt-1">Data has been collected.</p>
          <Button variant="outline" size="sm" className="mt-4" onClick={() => setSubmitted(false)}>
            Edit Response
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 h-full overflow-auto">
      <h2 className="text-lg font-semibold mb-6">{title}</h2>
      <form onSubmit={handleSubmit} className="space-y-5 max-w-lg">
        {fields.map((field) => (
          <div key={field.name} className="space-y-1.5">
            <label className="text-sm font-medium flex items-center gap-1">
              {field.label}
              {field.required && <span className="text-red-400">*</span>}
            </label>

            {field.type === 'textarea' ? (
              <textarea
                className="w-full rounded-md border bg-background px-3 py-2 text-sm min-h-[80px] focus:outline-none focus:ring-2 focus:ring-ring"
                value={values[field.name] || ''}
                onChange={(e) => handleChange(field.name, e.target.value)}
                required={field.required}
              />
            ) : field.type === 'select' ? (
              <select
                className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                value={values[field.name] || ''}
                onChange={(e) => handleChange(field.name, e.target.value)}
                required={field.required}
              >
                <option value="">Select...</option>
                {field.options?.map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            ) : field.type === 'file' ? (
              <input
                type="file"
                className="w-full rounded-md border bg-background px-3 py-2 text-sm file:mr-3 file:rounded file:border-0 file:bg-muted file:px-3 file:py-1 file:text-sm"
                onChange={(e) => handleChange(field.name, e.target.files?.[0]?.name)}
              />
            ) : (
              <input
                type={field.type === 'number' ? 'number' : 'text'}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                value={values[field.name] || ''}
                onChange={(e) => handleChange(field.name, field.type === 'number' ? Number(e.target.value) : e.target.value)}
                required={field.required}
              />
            )}
          </div>
        ))}

        <Button type="submit" className="w-full">
          Submit
        </Button>
      </form>
    </div>
  );
}
