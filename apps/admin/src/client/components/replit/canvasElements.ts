/**
 * PLANET-1385: Canvas element types, presets, and localStorage helpers.
 */

export type CanvasElementType = 'workflow' | 'form' | 'table';

export interface CanvasElement {
  id: string;
  name: string;
  type: CanvasElementType;
  status?: string;
  updatedAt?: string;
  // For form type
  fields?: FormField[];
  // For table type
  columns?: string[];
  rows?: Record<string, string>[];
}

export interface FormField {
  id: string;
  label: string;
  type: 'text' | 'textarea' | 'number' | 'select' | 'file';
  placeholder?: string;
  required?: boolean;
  options?: string[]; // for select type
}

export const PRESET_ELEMENTS: CanvasElement[] = [
  {
    id: 'form-ai-faceswap',
    name: 'AI 换脸',
    type: 'form',
    status: 'active',
    fields: [
      { id: 'source', label: '源图片', type: 'file', required: true, placeholder: '上传要换脸的图片' },
      { id: 'target', label: '目标脸', type: 'file', required: true, placeholder: '上传目标人脸' },
      { id: 'style', label: '风格', type: 'select', options: ['自然', '卡通', '素描', '油画'] },
    ],
  },
];

const STORAGE_KEY = 'peopleclaw-canvas-elements';

export function getStoredElements(): CanvasElement[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveStoredElements(elements: CanvasElement[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(elements));
}

export function addStoredElement(element: CanvasElement): void {
  const existing = getStoredElements();
  existing.push(element);
  saveStoredElements(existing);
}
