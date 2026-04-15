export type StepType = 'human' | 'agent' | 'subflow';

export interface WorkflowStep {
  id: string;
  name: string;
  type: StepType;
  assignee: string;
  description: string;
  estimatedTime?: string;
  tools?: string[];
  subflow?: Workflow;
}

export interface Workflow {
  id: string;
  name: string;
  description: string;
  icon: string;
  steps: WorkflowStep[];
  category: string;
}

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
