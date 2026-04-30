/**
 * PLANET-1385: Block system — all canvas elements are "blocks".
 * Block types: flow (workflow), form (user input), table (CRUD data).
 */

export type BlockType = 'flow' | 'form' | 'table';

export interface Block {
  id: string;
  name: string;
  type: BlockType;
  status: 'active' | 'draft' | 'archived';
  createdAt: string;
  updatedAt: string;

  // Flow block
  workflowId?: string;
  input?: BlockPort;
  output?: BlockPort;

  // Form block
  fields?: FormField[];
  submitAction?: { targetBlockId: string; mapping?: Record<string, string> };

  // Table block
  columns?: TableColumn[];
  rows?: Record<string, any>[];
  sourceBlockId?: string;
}

export interface BlockPort {
  schema: Record<string, 'string' | 'number' | 'file' | 'object'>;
}

export interface FormField {
  id: string;
  label: string;
  type: 'text' | 'textarea' | 'number' | 'select' | 'file' | 'email' | 'url';
  placeholder?: string;
  required?: boolean;
  options?: string[];
}

export interface TableColumn {
  id: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'status' | 'image' | 'actions';
  width?: number;
}

// ─── AI Faceswap Preset (3 blocks) ───────────────────────────────────

export const AI_FACESWAP_BLOCKS: Block[] = [
  {
    id: 'block-faceswap-form',
    name: 'AI 换脸 - 提交表单',
    type: 'form',
    status: 'active',
    createdAt: '2026-04-30T00:00:00.000Z',
    updatedAt: '2026-04-30T00:00:00.000Z',
    fields: [
      { id: 'source_image', label: '源图片', type: 'file', required: true, placeholder: '上传要换脸的原图' },
      { id: 'target_face', label: '目标人脸', type: 'file', required: true, placeholder: '上传目标人脸照片' },
      { id: 'style', label: '风格', type: 'select', options: ['自然', '卡通', '素描', '油画', '3D'] },
      { id: 'quality', label: '质量', type: 'select', options: ['标准', '高清', '超清'] },
      { id: 'notes', label: '备注', type: 'textarea', placeholder: '特殊要求...' },
    ],
    submitAction: { targetBlockId: 'block-faceswap-flow' },
    input: { schema: {} },
    output: { schema: { source_image: 'file', target_face: 'file', style: 'string', quality: 'string', notes: 'string' } },
  },
  {
    id: 'block-faceswap-flow',
    name: 'AI 换脸 - 处理流程',
    type: 'flow',
    status: 'active',
    createdAt: '2026-04-30T00:00:00.000Z',
    updatedAt: '2026-04-30T00:00:00.000Z',
    workflowId: 'ai-faceswap',
    input: { schema: { source_image: 'file', target_face: 'file', style: 'string', quality: 'string' } },
    output: { schema: { result_image: 'file', status: 'string', processing_time: 'number' } },
  },
  {
    id: 'block-faceswap-table',
    name: 'AI 换脸 - 历史记录',
    type: 'table',
    status: 'active',
    createdAt: '2026-04-30T00:00:00.000Z',
    updatedAt: '2026-04-30T00:00:00.000Z',
    sourceBlockId: 'block-faceswap-flow',
    columns: [
      { id: 'id', label: 'ID', type: 'text', width: 80 },
      { id: 'source_image', label: '源图', type: 'image', width: 80 },
      { id: 'result_image', label: '结果', type: 'image', width: 80 },
      { id: 'style', label: '风格', type: 'text', width: 80 },
      { id: 'status', label: '状态', type: 'status', width: 100 },
      { id: 'created_at', label: '时间', type: 'date', width: 120 },
      { id: 'actions', label: '操作', type: 'actions', width: 100 },
    ],
    rows: [
      { id: '001', source_image: '📷', result_image: '🎨', style: '自然', status: '完成', created_at: '2026-04-30' },
      { id: '002', source_image: '📷', result_image: '🎨', style: '卡通', status: '处理中', created_at: '2026-04-30' },
      { id: '003', source_image: '📷', result_image: '⏳', style: '油画', status: '排队中', created_at: '2026-04-29' },
    ],
  },
];

// ─── localStorage helpers ────────────────────────────────────────────

const STORAGE_KEY = 'peopleclaw-blocks';

export function getStoredBlocks(): Block[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveStoredBlocks(blocks: Block[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(blocks));
}

export function addStoredBlock(block: Block): void {
  const existing = getStoredBlocks();
  existing.push(block);
  saveStoredBlocks(existing);
}

// ─── Helper: get all blocks (presets + stored) ───────────────────────

export function getAllLocalBlocks(): Block[] {
  return [...AI_FACESWAP_BLOCKS, ...getStoredBlocks()];
}
