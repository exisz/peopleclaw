// Re-export all types from dedicated modules
export type { StepType, WorkflowStep, Workflow } from './workflow';
export type { CaseRecord, CaseStatus, CaseStepRecord, CasePayload } from './case';
export { TERMINAL_STATUSES, ACTIVE_STATUSES, parseCasePayload } from './case';

// Legacy Case type (used by older components — prefer CaseRecord for new code)
export interface Case {
  id: string;
  workflowId: string;
  name: string;
  status: 'active' | 'completed' | 'paused';
  currentStepId: string;
  startedAt: string;
  stepStatuses: Record<string, 'done' | 'in-progress' | 'blocked' | 'pending'>;
  notes?: Record<string, string>;
}
