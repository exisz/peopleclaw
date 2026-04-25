/** Backend Case record — mirrors Prisma Case model */
export interface CaseRecord {
  id: string;
  workflowId: string;
  title: string;
  status: CaseStatus;
  currentStepId: string | null;
  payload: string; // JSON string
  batchId: string | null;
  createdAt: string;
  updatedAt: string;
  steps?: CaseStepRecord[];
}

export type CaseStatus =
  | 'running'
  | 'waiting_review'
  | 'waiting_human'
  | 'waiting_subflow'
  | 'done'
  | 'failed'
  | 'cancelled'
  | 'awaiting_fix';

export const TERMINAL_STATUSES: CaseStatus[] = ['done', 'failed', 'cancelled'];
export const ACTIVE_STATUSES: CaseStatus[] = ['running', 'waiting_review', 'waiting_human', 'waiting_subflow'];

export interface CaseStepRecord {
  id: string;
  stepId: string;
  stepType: string;
  kind: 'auto' | 'human';
  status: string;
  input: string; // JSON
  output: string; // JSON
  error: string | null;
  startedAt: string | null;
  completedAt: string | null;
}

/** Parsed case payload — the accumulative data object */
export interface CasePayload {
  product_name?: string;
  price?: number;
  stock?: number;
  image_url?: string;
  description?: string;
  category?: string;
  [key: string]: unknown; // extensible
}

/** Parse case.payload JSON string safely */
export function parseCasePayload(raw: string): CasePayload {
  try { return JSON.parse(raw); } catch { return {}; }
}
