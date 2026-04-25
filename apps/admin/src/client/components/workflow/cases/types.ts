/* Case types matching actual backend response */

export interface CaseStepRecord {
  id: string;
  stepId: string;
  stepType?: string;
  kind?: string;
  status: string;
  input?: string;
  output?: string;
  error?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  createdAt?: string;
}

/** Backend Case record as returned by GET /api/cases */
export interface CaseRecord {
  id: string;
  workflowId: string;
  title: string;
  status: 'running' | 'waiting_review' | 'waiting_human' | 'waiting_subflow' | 'done' | 'failed' | 'cancelled' | 'awaiting_fix';
  currentStepId: string | null;
  payload: string; // JSON string
  batchId?: string | null;
  createdAt: string;
  updatedAt: string;
  steps?: CaseStepRecord[];
}

export type FilterKey = 'all' | 'running' | 'waiting_review' | 'waiting_human' | 'awaiting_fix' | 'done' | 'failed';

export const FILTERS: ReadonlyArray<{ key: FilterKey; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'running', label: 'Running' },
  { key: 'waiting_review', label: 'Review' },
  { key: 'waiting_human', label: 'Waiting' },
  { key: 'awaiting_fix', label: 'Fix' },
  { key: 'done', label: 'Done' },
  { key: 'failed', label: 'Failed' },
];

export const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  running: 'default',
  waiting_review: 'secondary',
  waiting_human: 'secondary',
  awaiting_fix: 'destructive',
  done: 'outline',
  failed: 'destructive',
  cancelled: 'outline',
};

export const STATUS_LABEL: Record<string, string> = {
  running: '运行中',
  waiting_review: '待审核',
  waiting_human: '等待人工',
  awaiting_fix: '待修复',
  done: '完成',
  failed: '失败',
  cancelled: '已取消',
};
